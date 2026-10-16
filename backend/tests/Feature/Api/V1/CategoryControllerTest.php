<?php

namespace Tests\Feature\Api\V1;

use App\Models\Category;
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
}
