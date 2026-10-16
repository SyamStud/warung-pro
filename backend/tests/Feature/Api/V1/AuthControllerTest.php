<?php

namespace Tests\Feature\Api\V1;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AuthControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_register_creates_user_and_returns_token(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Budi',
            'email' => 'budi@example.com',
            'password' => 'secret-password',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.user.email', 'budi@example.com')
            ->assertJsonStructure(['data' => ['user' => ['id', 'name', 'email'], 'token']]);

        $this->assertDatabaseHas('users', ['email' => 'budi@example.com']);
    }

    public function test_register_rejects_duplicate_email(): void
    {
        User::factory()->create(['email' => 'budi@example.com']);

        $this->postJson('/api/v1/auth/register', [
            'name' => 'Budi',
            'email' => 'budi@example.com',
            'password' => 'secret-password',
        ])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR')
            ->assertJsonPath('error.details.email.0', 'The email has already been taken.');
    }

    public function test_register_requires_name_email_and_password(): void
    {
        $this->postJson('/api/v1/auth/register', [])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR')
            ->assertJsonStructure(['error' => ['details' => ['name', 'email', 'password']]]);
    }

    public function test_login_returns_token_for_valid_credentials(): void
    {
        User::factory()->create([
            'email' => 'budi@example.com',
            'password' => 'secret-password',
        ]);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'budi@example.com',
            'password' => 'secret-password',
        ])
            ->assertOk()
            ->assertJsonStructure(['data' => ['user' => ['id'], 'token']]);
    }

    public function test_login_rejects_invalid_credentials(): void
    {
        User::factory()->create([
            'email' => 'budi@example.com',
            'password' => 'secret-password',
        ]);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'budi@example.com',
            'password' => 'wrong-password',
        ])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR')
            ->assertJsonStructure(['error' => ['details' => ['email']]]);
    }

    public function test_me_returns_authenticated_user(): void
    {
        $user = User::factory()->create();

        Sanctum::actingAs($user);

        $this->getJson('/api/v1/me')
            ->assertOk()
            ->assertJsonPath('data.id', $user->id)
            ->assertJsonPath('data.email', $user->email);
    }

    public function test_me_returns_401_without_token(): void
    {
        $this->getJson('/api/v1/me')
            ->assertStatus(401)
            ->assertJsonPath('error.code', 'UNAUTHENTICATED');
    }

    public function test_logout_revokes_the_current_token(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('android')->plainTextToken;

        $this->withToken($token)->postJson('/api/v1/auth/logout')->assertNoContent();

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }
}
