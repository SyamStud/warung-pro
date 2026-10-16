<?php

namespace Database\Factories;

use App\Models\Transaction;
use App\Models\TransactionItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TransactionItem>
 */
class TransactionItemFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $unitPrice = fake()->numberBetween(1_000, 50_000);
        $quantity = fake()->numberBetween(1, 5);

        return [
            'transaction_id' => Transaction::factory(),
            'product_id' => null,
            'product_name' => ucfirst(fake()->words(2, true)),
            'sku' => 'PRD-'.fake()->unique()->numerify('######'),
            'barcode' => null,
            'unit_price' => $unitPrice,
            'quantity' => $quantity,
            'line_total' => $unitPrice * $quantity,
        ];
    }
}
