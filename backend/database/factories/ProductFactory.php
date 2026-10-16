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
            'unit' => 'pcs',
            'selling_price' => fake()->numberBetween(1_000, 100_000),
            'notes' => null,
            'is_active' => true,
        ];
    }

    /** A product whose SKU is a scanned code rather than a generated one. */
    public function asScannedCode(): static
    {
        return $this->state(['sku' => fake()->unique()->ean13()]);
    }

    /** An archived product. */
    public function archived(): static
    {
        return $this->state(['is_active' => false]);
    }
}
