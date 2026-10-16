<?php

namespace Tests\Feature\Api\V1;

use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProductControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_index_returns_401_without_token(): void
    {
        $this->getJson('/api/v1/products')
            ->assertStatus(401)
            ->assertJsonPath('error.code', 'UNAUTHENTICATED');
    }

    public function test_index_returns_only_the_authenticated_users_products(): void
    {
        $user = User::factory()->create();
        Product::factory()->for($user)->create(['name' => 'Milik Saya']);
        Product::factory()->create(['name' => 'Milik Orang Lain']);

        Sanctum::actingAs($user);

        $this->getJson('/api/v1/products')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Milik Saya');
    }

    public function test_store_creates_product_with_generated_sku(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/products', [
            'name' => 'Air Mineral 600ml',
            'barcode' => '8991234567890',
            'unit' => 'pcs',
            'selling_price' => 4000,
        ])
            ->assertCreated()
            ->assertJsonPath('data.sku', 'PRD-000001')
            ->assertJsonPath('data.selling_price', 4000);

        $this->assertDatabaseHas('products', [
            'user_id' => $user->id,
            'sku' => 'PRD-000001',
        ]);
    }

    public function test_store_keeps_a_manually_supplied_sku(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/products', [
            'name' => 'Kopi',
            'sku' => 'KOPI-01',
            'unit' => 'sachet',
            'selling_price' => 2500,
        ])
            ->assertCreated()
            ->assertJsonPath('data.sku', 'KOPI-01');
    }

    public function test_store_rejects_a_duplicate_sku_for_the_same_user(): void
    {
        $user = User::factory()->create();
        Product::factory()->for($user)->create(['sku' => 'KOPI-01']);
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/products', [
            'name' => 'Kopi Lain',
            'sku' => 'KOPI-01',
            'unit' => 'sachet',
            'selling_price' => 3000,
        ])
            ->assertStatus(422)
            ->assertJsonStructure(['error' => ['details' => ['sku']]]);
    }

    public function test_store_allows_the_same_sku_for_a_different_user(): void
    {
        Product::factory()->create(['sku' => 'KOPI-01']);
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/products', [
            'name' => 'Kopi Saya',
            'sku' => 'KOPI-01',
            'unit' => 'sachet',
            'selling_price' => 3000,
        ])->assertCreated();
    }

    public function test_store_rejects_a_negative_price(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/v1/products', [
            'name' => 'Rusak',
            'unit' => 'pcs',
            'selling_price' => -1,
        ])
            ->assertStatus(422)
            ->assertJsonStructure(['error' => ['details' => ['selling_price']]]);
    }

    public function test_lookup_returns_a_product_by_barcode(): void
    {
        $user = User::factory()->create();
        Product::factory()->for($user)->create([
            'name' => 'Teh Kotak',
            'barcode' => '8999999999999',
        ]);
        Sanctum::actingAs($user);

        $this->getJson('/api/v1/products/lookup?barcode=8999999999999')
            ->assertOk()
            ->assertJsonPath('data.name', 'Teh Kotak');
    }

    public function test_lookup_returns_404_for_an_unknown_barcode(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/v1/products/lookup?barcode=0000000000000')
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'NOT_FOUND');
    }

    public function test_show_returns_404_for_another_users_product(): void
    {
        $product = Product::factory()->create();
        Sanctum::actingAs(User::factory()->create());

        $this->getJson("/api/v1/products/{$product->id}")
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'NOT_FOUND');
    }

    public function test_update_changes_product_fields(): void
    {
        $user = User::factory()->create();
        $product = Product::factory()->for($user)->create(['selling_price' => 4000]);
        Sanctum::actingAs($user);

        $this->patchJson("/api/v1/products/{$product->id}", ['selling_price' => 5500])
            ->assertOk()
            ->assertJsonPath('data.selling_price', 5500);

        $this->assertDatabaseHas('products', ['id' => $product->id, 'selling_price' => 5500]);
    }

    public function test_destroy_archives_the_product_without_removing_the_row(): void
    {
        $user = User::factory()->create();
        $product = Product::factory()->for($user)->create();
        Sanctum::actingAs($user);

        $this->deleteJson("/api/v1/products/{$product->id}")->assertNoContent();

        $this->assertSoftDeleted('products', ['id' => $product->id]);
        $this->assertDatabaseHas('products', ['id' => $product->id, 'is_active' => false]);
    }

    public function test_search_matches_name_sku_and_barcode(): void
    {
        $user = User::factory()->create();
        Product::factory()->for($user)->create([
            'name' => 'Air Mineral',
            'sku' => 'AIR-01',
            'barcode' => '1111111111111',
        ]);
        Product::factory()->for($user)->withoutBarcode()->create([
            'name' => 'Roti Tawar',
            'sku' => 'ROTI-01',
        ]);
        Sanctum::actingAs($user);

        $this->getJson('/api/v1/products?search=Mineral')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Air Mineral');

        $this->getJson('/api/v1/products?search=ROTI')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.sku', 'ROTI-01');

        $this->getJson('/api/v1/products?search=111111')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.barcode', '1111111111111');
    }

    public function test_store_is_idempotent_with_the_same_idempotency_key(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $payload = ['name' => 'Air Mineral', 'unit' => 'pcs', 'selling_price' => 4000];

        $first = $this->withHeader('Idempotency-Key', 'offline-key-1')
            ->postJson('/api/v1/products', $payload)
            ->assertCreated();

        $second = $this->withHeader('Idempotency-Key', 'offline-key-1')
            ->postJson('/api/v1/products', $payload)
            ->assertOk();

        $this->assertSame($first->json('data.id'), $second->json('data.id'));
        $this->assertDatabaseCount('products', 1);
    }
}
