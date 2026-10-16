<?php

namespace Database\Factories;

use App\Models\Transaction;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Transaction>
 */
class TransactionFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $subtotal = fake()->numberBetween(5_000, 200_000);
        $paid = $subtotal + fake()->numberBetween(0, 20_000);

        return [
            'user_id' => User::factory(),
            'transaction_number' => 'TRX-'.now()->format('Ymd').'-'.fake()->unique()->numerify('####'),
            'status' => 'paid',
            'subtotal' => $subtotal,
            'discount_amount' => 0,
            'total' => $subtotal,
            'paid_amount' => $paid,
            'change_amount' => $paid - $subtotal,
            'idempotency_key' => null,
        ];
    }
}
