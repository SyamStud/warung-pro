<?php

namespace Tests\Feature\Api\V1;

use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProductImportTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @param  array<int, array<string, mixed>>  $rows
     */
    private function import(array $rows, string $mode = 'create'): TestResponse
    {
        return $this->postJson('/api/v1/products/import', ['rows' => $rows, 'mode' => $mode]);
    }

    /**
     * @return array<string, mixed>
     */
    private function row(string $name, mixed $price, ?string $sku = null): array
    {
        return ['name' => $name, 'selling_price' => $price, 'sku' => $sku];
    }

    public function test_import_requires_authentication(): void
    {
        $this->import([$this->row('Kopi', 3000)])
            ->assertStatus(401)
            ->assertJsonPath('error.code', 'UNAUTHENTICATED');
    }

    public function test_it_creates_products_and_generates_the_missing_skus(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->import([
            ['name' => 'Teh Kotak 200ml', 'selling_price' => 5000, 'sku' => '8991234567891', 'unit' => 'pcs'],
            ['name' => 'Kopi Sachet', 'selling_price' => 2500],
        ])
            ->assertOk()
            ->assertJsonPath('data.created', 2)
            ->assertJsonPath('data.updated', 0)
            ->assertJsonPath('data.skipped', 0);

        $this->assertDatabaseHas('products', [
            'user_id' => $user->id,
            'name' => 'Teh Kotak 200ml',
            'sku' => '8991234567891',
            'selling_price' => 5000,
        ]);

        // A row without a code gets one from the same generator the form uses.
        $this->assertDatabaseHas('products', [
            'user_id' => $user->id,
            'name' => 'Kopi Sachet',
            'sku' => 'PRD-000001',
        ]);
    }

    public function test_unit_defaults_to_pcs(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->import([$this->row('Gula', 14000)])->assertOk();

        $this->assertDatabaseHas('products', ['name' => 'Gula', 'unit' => 'pcs']);
    }

    public function test_one_unreadable_row_does_not_lose_the_others(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $response = $this->import([
            $this->row('', 3000, '8990000000001'),
            ['name' => 'Tanpa harga'],
            $this->row('Mie Instan', 3200),
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('data.created', 1)
            ->assertJsonPath('data.skipped', 2)
            ->assertJsonPath('data.issues.0.row', 2)
            ->assertJsonPath('data.issues.0.name', '8990000000001')
            ->assertJsonPath('data.issues.0.message', 'Nama produk kosong.')
            ->assertJsonPath('data.issues.1.row', 3)
            ->assertJsonPath('data.issues.1.message', 'Harga jual kosong atau tidak terbaca.');

        $this->assertDatabaseHas('products', ['name' => 'Mie Instan']);
        $this->assertDatabaseCount('products', 1);
    }

    public function test_the_sheet_row_number_is_kept_for_messages(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->import([
            ['row' => 7, 'name' => 'Sabun', 'selling_price' => 4500],
            ['row' => 9, 'name' => 'Sampo', 'selling_price' => 100],
        ])
            ->assertOk()
            ->assertJsonPath('data.created', 2);

        $this->import([['row' => 12, 'name' => '', 'selling_price' => 1000]])
            ->assertJsonPath('data.issues.0.row', 12);
    }

    public function test_create_mode_leaves_a_product_whose_sku_already_exists(): void
    {
        $user = User::factory()->create();
        $product = Product::factory()->for($user)->create(['sku' => '8991234567891', 'selling_price' => 5000]);
        Sanctum::actingAs($user);

        $this->import([['name' => 'Teh Kotak', 'selling_price' => 9000, 'sku' => '8991234567891']])
            ->assertOk()
            ->assertJsonPath('data.created', 0)
            ->assertJsonPath('data.updated', 0)
            ->assertJsonPath('data.skipped', 1)
            ->assertJsonPath('data.issues.0.row', 2);

        $this->assertDatabaseHas('products', ['id' => $product->id, 'selling_price' => 5000]);
        $this->assertDatabaseCount('products', 1);
    }

    public function test_upsert_mode_updates_the_product_with_that_sku(): void
    {
        $user = User::factory()->create();
        $product = Product::factory()->for($user)->create([
            'sku' => '8991234567891',
            'name' => 'Teh Kotak 200ml',
            'selling_price' => 5000,
            'notes' => 'catatan lama',
        ]);
        $version = $product->refresh()->version;
        Sanctum::actingAs($user);

        $this->import([
            [
                'name' => 'Teh Kotak 250ml',
                'selling_price' => 6000,
                'sku' => '8991234567891',
                'notes' => 'harga naik',
            ],
        ], 'upsert')
            ->assertOk()
            ->assertJsonPath('data.created', 0)
            ->assertJsonPath('data.updated', 1)
            ->assertJsonPath('data.skipped', 0);

        $product->refresh();

        $this->assertSame('Teh Kotak 250ml', $product->name);
        $this->assertSame(6000, $product->selling_price);
        $this->assertSame('harga naik', $product->notes);
        // Other devices must notice the change.
        $this->assertSame($version + 1, $product->version);
    }

    public function test_a_row_without_a_sku_is_matched_by_name(): void
    {
        $user = User::factory()->create();
        Product::factory()->for($user)->create(['name' => 'Kopi Sachet', 'selling_price' => 2500]);
        Sanctum::actingAs($user);

        $this->import([$this->row('kopi sachet', 3000)])
            ->assertOk()
            ->assertJsonPath('data.created', 0)
            ->assertJsonPath('data.skipped', 1);

        $this->assertDatabaseHas('products', ['name' => 'Kopi Sachet', 'selling_price' => 2500]);
        $this->assertDatabaseCount('products', 1);

        $this->import([$this->row('KOPI SACHET', 3000)], 'upsert')
            ->assertJsonPath('data.updated', 1);

        $this->assertDatabaseHas('products', ['name' => 'Kopi Sachet', 'selling_price' => 3000]);
        $this->assertDatabaseCount('products', 1);
    }

    public function test_missing_categories_are_created_and_existing_ones_reused(): void
    {
        $user = User::factory()->create();
        Category::factory()->for($user)->create(['name' => 'Makanan']);
        Sanctum::actingAs($user);

        $this->import([
            ['name' => 'Mie Instan', 'selling_price' => 3200, 'category' => 'Makanan'],
            ['name' => 'Teh Kotak', 'selling_price' => 5000, 'category' => 'minuman'],
            ['name' => 'Kopi Sachet', 'selling_price' => 2500, 'category' => 'Minuman'],
        ])
            ->assertOk()
            ->assertJsonPath('data.created', 3)
            ->assertJsonPath('data.categories_created', ['minuman']);

        $this->assertDatabaseCount('categories', 2);
        $this->assertDatabaseHas('products', ['name' => 'Mie Instan']);
        $this->assertNotNull(Product::where('name', 'Kopi Sachet')->first()->category_id);
        $this->assertSame(
            Product::where('name', 'Teh Kotak')->first()->category_id,
            Product::where('name', 'Kopi Sachet')->first()->category_id,
        );
    }

    public function test_it_never_touches_another_users_catalog(): void
    {
        $other = User::factory()->create();
        $theirs = Product::factory()->for($other)->create(['sku' => '8991234567891', 'selling_price' => 5000]);

        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->import([['name' => 'Teh Kotak', 'selling_price' => 9000, 'sku' => '8991234567891']])
            ->assertOk()
            ->assertJsonPath('data.created', 1);

        $this->assertSame(5000, $theirs->refresh()->selling_price);
        $this->assertDatabaseHas('products', ['user_id' => $user->id, 'sku' => '8991234567891']);
    }

    public function test_a_row_repeated_inside_the_file_is_reported_once(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->import([
            ['name' => 'Mie Instan', 'selling_price' => 3200, 'sku' => '8991234567891'],
            ['name' => 'Mie Instan lagi', 'selling_price' => 3300, 'sku' => '8991234567891'],
        ])
            ->assertOk()
            ->assertJsonPath('data.created', 1)
            ->assertJsonPath('data.skipped', 1)
            ->assertJsonPath('data.issues.0.message', 'Baris ganda — sama dengan baris 2.');
    }

    public function test_blank_rows_and_short_rows_are_ignored(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->import([
            ['name' => 'Mie Instan', 'selling_price' => 3200],
            ['name' => null, 'selling_price' => null, 'sku' => null, 'category' => null, 'notes' => null],
            [],
        ])
            ->assertOk()
            ->assertJsonPath('data.created', 1)
            ->assertJsonPath('data.skipped', 0);
    }

    public function test_an_archived_product_does_not_hold_on_to_its_sku(): void
    {
        $user = User::factory()->create();
        $archived = Product::factory()->for($user)->create(['sku' => '8991234567891']);
        $archived->delete();
        Sanctum::actingAs($user);

        $this->import([['name' => 'Teh Kotak', 'selling_price' => 5000, 'sku' => '8991234567891']])
            ->assertOk()
            ->assertJsonPath('data.created', 1);

        $this->assertDatabaseCount('products', 2);
    }

    public function test_it_refuses_more_rows_than_the_limit(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $rows = array_map(
            fn (int $i): array => ['name' => "Produk {$i}", 'selling_price' => 1000],
            range(1, 501),
        );

        $this->import($rows)
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR');
    }

    public function test_it_requires_at_least_one_row(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->import([])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR');
    }
}
