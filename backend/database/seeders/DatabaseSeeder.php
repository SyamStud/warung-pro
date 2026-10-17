<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /** Kata sandi awal akun demo — sebaiknya diganti setelah dipakai. */
    private const DEFAULT_PASSWORD = 'password';

    /**
     * Seed the application's database.
     *
     * Akun demo yang dipakai aplikasi dan dokumentasi. Dibuat dengan
     * `firstOrCreate` — bukan factory — supaya seeder ini juga jalan di image
     * produksi, yang memasang Composer tanpa faker.
     */
    public function run(): void
    {
        /** @var array<int, array{name: string, email: string}> $accounts */
        $accounts = [
            ['name' => 'Demo', 'email' => 'demo@warung.test'],
            ['name' => 'Lain', 'email' => 'lain@warung.test'],
        ];

        foreach ($accounts as $account) {
            User::query()->firstOrCreate(
                ['email' => $account['email']],
                [
                    'name' => $account['name'],
                    'password' => self::DEFAULT_PASSWORD,
                ],
            );
        }
    }
}
