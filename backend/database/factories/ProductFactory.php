<?php

namespace Database\Factories;

use App\Models\Product;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Product>
 */
class ProductFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'category_id' => null,
            'name' => ucfirst(fake()->words(2, true)),
            'sku' => 'PRD-'.fake()->unique()->numerify('######'),
            'barcode' => fake()->unique()->ean13(),
            'unit' => 'pcs',
            'selling_price' => fake()->numberBetween(1_000, 100_000),
            'notes' => null,
            'is_active' => true,
        ];
    }

    /** A product without a barcode (SKU-only). */
    public function withoutBarcode(): static
    {
        return $this->state(['barcode' => null]);
    }

    /** An archived product. */
    public function archived(): static
    {
        return $this->state(['is_active' => false]);
    }
}
