<?php

namespace App\Services;

use App\Models\Product;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Creates a paid transaction with immutable item snapshots.
 *
 * All money is computed here — never trusted from the client — and the header
 * plus its items are written in a single database transaction.
 */
class TransactionService
{
    public function __construct(private readonly TransactionNumberGenerator $numbers) {}

    /**
     * @param  array<int, array{product_id: int, quantity: int}>  $items
     */
    public function create(
        User $user,
        array $items,
        int $discountAmount,
        int $paidAmount,
        string $paymentMethod,
        ?string $idempotencyKey,
    ): Transaction {
        return DB::transaction(function () use ($user, $items, $discountAmount, $paidAmount, $paymentMethod, $idempotencyKey): Transaction {
            $products = $user->products()
                ->active()
                ->whereIn('id', array_column($items, 'product_id'))
                ->get()
                ->keyBy('id');

            $lines = [];
            $subtotal = 0;

            foreach ($items as $item) {
                /** @var Product|null $product */
                $product = $products->get($item['product_id']);

                if ($product === null) {
                    throw ValidationException::withMessages([
                        'items' => ["Produk #{$item['product_id']} tidak ditemukan atau sudah diarsipkan."],
                    ]);
                }

                $quantity = (int) $item['quantity'];
                $lineTotal = $product->selling_price * $quantity;
                $subtotal += $lineTotal;

                $lines[] = [
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'sku' => $product->sku,
                    'unit_price' => $product->selling_price,
                    'quantity' => $quantity,
                    'line_total' => $lineTotal,
                ];
            }

            $total = $subtotal - $discountAmount;

            if ($total < 0) {
                throw ValidationException::withMessages([
                    'discount_amount' => ['Diskon melebihi subtotal.'],
                ]);
            }

            if ($paidAmount < $total) {
                throw ValidationException::withMessages([
                    'paid_amount' => ["Pembayaran kurang dari total {$total}."],
                ]);
            }

            $transaction = $user->transactions()->create([
                'transaction_number' => $this->numbers->next(),
                'status' => 'paid',
                'subtotal' => $subtotal,
                'discount_amount' => $discountAmount,
                'total' => $total,
                'paid_amount' => $paidAmount,
                'change_amount' => $paidAmount - $total,
                'payment_method' => $paymentMethod,
                'idempotency_key' => $idempotencyKey,
            ]);

            $transaction->items()->createMany($lines);

            return $transaction->load('items');
        });
    }
}
