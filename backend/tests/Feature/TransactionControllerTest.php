<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TransactionControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_store_requires_authentication(): void
    {
        $this->postJson('/api/v1/transactions', ['items' => [], 'paid_amount' => 0])
            ->assertStatus(401)
            ->assertJsonPath('error.code', 'UNAUTHENTICATED');
    }

    public function test_store_computes_totals_from_server_prices(): void
    {
        $user = User::factory()->create();
        $product = Product::factory()->for($user)->create(['selling_price' => 4000]);
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/transactions', [
            'items' => [['product_id' => $product->id, 'quantity' => 2]],
            'paid_amount' => 10000,
        ])
            ->assertCreated()
            ->assertJsonPath('data.subtotal', 8000)
            ->assertJsonPath('data.total', 8000)
            ->assertJsonPath('data.change_amount', 2000)
            ->assertJsonPath('data.status', 'paid')
            ->assertJsonPath('data.items.0.unit_price', 4000)
            ->assertJsonPath('data.items.0.line_total', 8000);

        $this->assertDatabaseHas('transactions', [
            'user_id' => $user->id,
            'subtotal' => 8000,
            'total' => 8000,
            'paid_amount' => 10000,
            'change_amount' => 2000,
        ]);
    }

    public function test_store_applies_a_discount_and_computes_change(): void
    {
        $user = User::factory()->create();
        $product = Product::factory()->for($user)->create(['selling_price' => 5000]);
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/transactions', [
            'items' => [['product_id' => $product->id, 'quantity' => 2]],
            'discount_amount' => 1500,
            'paid_amount' => 10000,
        ])
            ->assertCreated()
            ->assertJsonPath('data.subtotal', 10000)
            ->assertJsonPath('data.discount_amount', 1500)
            ->assertJsonPath('data.total', 8500)
            ->assertJsonPath('data.change_amount', 1500);
    }

    public function test_store_rejects_payment_below_total(): void
    {
        $user = User::factory()->create();
        $product = Product::factory()->for($user)->create(['selling_price' => 4000]);
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/transactions', [
            'items' => [['product_id' => $product->id, 'quantity' => 2]],
            'paid_amount' => 5000,
        ])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR')
            ->assertJsonStructure(['error' => ['details' => ['paid_amount']]]);

        $this->assertDatabaseCount('transactions', 0);
    }

    public function test_store_rejects_a_discount_larger_than_the_subtotal(): void
    {
        $user = User::factory()->create();
        $product = Product::factory()->for($user)->create(['selling_price' => 4000]);
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/transactions', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'discount_amount' => 99999,
            'paid_amount' => 0,
        ])
            ->assertStatus(422)
            ->assertJsonStructure(['error' => ['details' => ['discount_amount']]]);
    }

    public function test_store_rejects_an_archived_product(): void
    {
        $user = User::factory()->create();
        $product = Product::factory()->for($user)->create(['is_active' => false]);
        $product->delete();
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/transactions', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'paid_amount' => 999999,
        ])->assertStatus(422);
    }

    public function test_store_rejects_a_product_owned_by_another_user(): void
    {
        $product = Product::factory()->create();
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/v1/transactions', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'paid_amount' => 999999,
        ])
            ->assertStatus(422)
            ->assertJsonStructure(['error' => ['details' => ['items.0.product_id']]]);
    }

    public function test_store_rejects_an_empty_cart(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/v1/transactions', ['items' => [], 'paid_amount' => 0])
            ->assertStatus(422)
            ->assertJsonStructure(['error' => ['details' => ['items']]]);
    }

    public function test_store_rejects_a_non_positive_quantity(): void
    {
        $user = User::factory()->create();
        $product = Product::factory()->for($user)->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/transactions', [
            'items' => [['product_id' => $product->id, 'quantity' => 0]],
            'paid_amount' => 999999,
        ])
            ->assertStatus(422)
            ->assertJsonStructure(['error' => ['details' => ['items.0.quantity']]]);
    }

    public function test_store_is_idempotent_with_the_same_idempotency_key(): void
    {
        $user = User::factory()->create();
        $product = Product::factory()->for($user)->create(['selling_price' => 4000]);
        Sanctum::actingAs($user);

        $payload = [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'paid_amount' => 4000,
        ];

        $first = $this->withHeader('Idempotency-Key', 'checkout-key-1')
            ->postJson('/api/v1/transactions', $payload)
            ->assertCreated();

        $second = $this->withHeader('Idempotency-Key', 'checkout-key-1')
            ->postJson('/api/v1/transactions', $payload)
            ->assertOk();

        $this->assertSame($first->json('data.id'), $second->json('data.id'));
        $this->assertSame(
            $first->json('data.transaction_number'),
            $second->json('data.transaction_number'),
        );
        $this->assertDatabaseCount('transactions', 1);
        $this->assertDatabaseCount('transaction_items', 1);
    }

    public function test_store_snapshots_product_details(): void
    {
        $user = User::factory()->create();
        $product = Product::factory()->for($user)->create([
            'name' => 'Kopi Susu',
            'selling_price' => 4000,
        ]);
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/transactions', [
            'items' => [['product_id' => $product->id, 'quantity' => 3]],
            'paid_amount' => 12000,
        ])->assertCreated();

        // Later price/name changes must not rewrite history.
        $product->update(['name' => 'Kopi Susu Gula Aren', 'selling_price' => 9999]);

        $this->assertDatabaseHas('transaction_items', [
            'product_id' => $product->id,
            'product_name' => 'Kopi Susu',
            'unit_price' => 4000,
            'quantity' => 3,
            'line_total' => 12000,
        ]);
    }

    public function test_transaction_number_uses_the_daily_sequence(): void
    {
        $user = User::factory()->create();
        $product = Product::factory()->for($user)->create(['selling_price' => 1000]);
        Sanctum::actingAs($user);

        $payload = [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'paid_amount' => 1000,
        ];

        $date = now()->format('Ymd');

        $this->postJson('/api/v1/transactions', $payload)
            ->assertCreated()
            ->assertJsonPath('data.transaction_number', "TRX-{$date}-0001");

        $this->postJson('/api/v1/transactions', $payload)
            ->assertCreated()
            ->assertJsonPath('data.transaction_number', "TRX-{$date}-0002");
    }

    public function test_index_lists_only_the_authenticated_users_transactions_newest_first(): void
    {
        $user = User::factory()->create();
        $mine = Transaction::factory()->for($user)->create();
        Transaction::factory()->create();

        Sanctum::actingAs($user);

        $this->getJson('/api/v1/transactions')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $mine->id);
    }

    public function test_show_returns_404_for_another_users_transaction(): void
    {
        $transaction = Transaction::factory()->create();
        Sanctum::actingAs(User::factory()->create());

        $this->getJson("/api/v1/transactions/{$transaction->id}")
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'NOT_FOUND');
    }

    public function test_receipt_returns_the_transaction_with_items(): void
    {
        $user = User::factory()->create();
        $product = Product::factory()->for($user)->create(['selling_price' => 2000]);
        Sanctum::actingAs($user);

        $id = $this->postJson('/api/v1/transactions', [
            'items' => [['product_id' => $product->id, 'quantity' => 2]],
            'paid_amount' => 4000,
        ])->assertCreated()->json('data.id');

        $this->getJson("/api/v1/transactions/{$id}/receipt")
            ->assertOk()
            ->assertJsonPath('data.id', $id)
            ->assertJsonCount(1, 'data.items')
            ->assertJsonPath('data.items.0.product_name', $product->name);
    }
}
