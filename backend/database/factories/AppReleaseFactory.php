<?php

namespace Database\Factories;

use App\Models\AppRelease;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AppRelease>
 */
class AppReleaseFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $code = fake()->unique()->numberBetween(1, 5_000);
        $name = '1.0.'.$code;

        return [
            'version_code' => $code,
            'version_name' => $name,
            'notes' => null,
            'file_path' => 'releases/warung-pos-'.$name.'.apk',
            'file_name' => 'warung-pos-'.$name.'.apk',
            'size_bytes' => fake()->numberBetween(1_000_000, 40_000_000),
            'sha256' => hash('sha256', 'release-'.$code),
            'downloads' => 0,
            'published_at' => now(),
        ];
    }
}
