<?php

namespace Tests\Feature\Api\V1;

use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CategoryControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_index_returns_401_without_token(): void
    {
        $this->getJson('/api/v1/categories')->assertStatus(401);
    }

    public function test_index_returns_only_the_authenticated_users_categories(): void
    {
        $user = User::factory()->create();
        Category::factory()->for($user)->create(['name' => 'Minuman']);
        Category::factory()->create(['name' => 'Lainnya']);

        Sanctum::actingAs($user);

        $this->getJson('/api/v1/categories')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Minuman');
    }

    public function test_store_creates_a_category(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/v1/categories', ['name' => 'Makanan'])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Makanan');

        $this->assertDatabaseHas('categories', ['name' => 'Makanan']);
    }

    public function test_store_rejects_a_duplicate_name_for_the_same_user(): void
    {
        $user = User::factory()->create();
        Category::factory()->for($user)->create(['name' => 'Makanan']);
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/categories', ['name' => 'Makanan'])
            ->assertStatus(422)
            ->assertJsonStructure(['error' => ['details' => ['name']]]);
    }

    public function test_update_renames_a_category(): void
    {
        $user = User::factory()->create();
        $category = Category::factory()->for($user)->create(['name' => 'Minuman']);
        Sanctum::actingAs($user);

        $this->patchJson("/api/v1/categories/{$category->id}", ['name' => 'Minuman Dingin'])
            ->assertOk()
            ->assertJsonPath('data.name', 'Minuman Dingin');

        $this->assertDatabaseHas('categories', ['id' => $category->id, 'name' => 'Minuman Dingin']);
    }

    public function test_update_keeps_the_current_name_unchanged(): void
    {
        $user = User::factory()->create();
        $category = Category::factory()->for($user)->create(['name' => 'Minuman']);
        Sanctum::actingAs($user);

        $this->patchJson("/api/v1/categories/{$category->id}", ['name' => 'Minuman'])
            ->assertOk()
            ->assertJsonPath('data.name', 'Minuman');
    }

    public function test_update_rejects_a_name_already_used_by_another_category(): void
    {
        $user = User::factory()->create();
        Category::factory()->for($user)->create(['name' => 'Minuman']);
        $target = Category::factory()->for($user)->create(['name' => 'Makanan']);
        Sanctum::actingAs($user);

        $this->patchJson("/api/v1/categories/{$target->id}", ['name' => 'Minuman'])
            ->assertStatus(422)
            ->assertJsonStructure(['error' => ['details' => ['name']]]);
    }

    public function test_update_returns_404_for_another_users_category(): void
    {
        $category = Category::factory()->create(['name' => 'Minuman']);
        Sanctum::actingAs(User::factory()->create());

        $this->patchJson("/api/v1/categories/{$category->id}", ['name' => 'Bukan Milikku'])
            ->assertStatus(404);

        $this->assertDatabaseHas('categories', ['id' => $category->id, 'name' => 'Minuman']);
    }

    public function test_destroy_deletes_a_category_and_uncategorises_its_products(): void
    {
        $user = User::factory()->create();
        $category = Category::factory()->for($user)->create();
        $product = Product::factory()->for($user)->create(['category_id' => $category->id]);
        Sanctum::actingAs($user);

        $this->deleteJson("/api/v1/categories/{$category->id}")->assertNoContent();

        $this->assertDatabaseMissing('categories', ['id' => $category->id]);
        $this->assertDatabaseHas('products', ['id' => $product->id, 'category_id' => null]);
    }

    public function test_destroy_returns_404_for_another_users_category(): void
    {
        $category = Category::factory()->create();
        Sanctum::actingAs(User::factory()->create());

        $this->deleteJson("/api/v1/categories/{$category->id}")->assertStatus(404);

        $this->assertDatabaseHas('categories', ['id' => $category->id]);
    }
}
