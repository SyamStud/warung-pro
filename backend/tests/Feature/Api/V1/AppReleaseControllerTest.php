<?php

namespace Tests\Feature\Api\V1;

use App\Models\AppRelease;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AppReleaseControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_release_check_is_public_and_reports_404_when_nothing_is_published(): void
    {
        $this->getJson('/api/v1/app/release')
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'NOT_FOUND');
    }

    public function test_release_check_returns_the_newest_build_with_a_pinned_download_url(): void
    {
        AppRelease::factory()->create(['version_code' => 1, 'version_name' => '1.0.0']);
        AppRelease::factory()->create([
            'version_code' => 3,
            'version_name' => '1.2.0',
            'notes' => 'Pemindai lebih cepat',
        ]);

        $this->getJson('/api/v1/app/release')
            ->assertOk()
            ->assertJsonPath('data.version_code', 3)
            ->assertJsonPath('data.version_name', '1.2.0')
            ->assertJsonPath('data.notes', 'Pemindai lebih cepat')
            ->assertJsonPath(
                'data.download_url',
                url('/api/v1/app/release/download?version_code=3'),
            );
    }

    public function test_download_serves_the_apk_and_counts_it(): void
    {
        Storage::fake('local');

        $release = AppRelease::factory()->create(['version_code' => 4, 'file_path' => 'releases/app-4.apk']);
        Storage::disk('local')->put('releases/app-4.apk', 'APK-CONTENT');

        $this->get('/api/v1/app/release/download?version_code=4')
            ->assertOk()
            ->assertHeader('content-type', 'application/vnd.android.package-archive')
            ->assertDownload($release->file_name);

        $this->assertSame(1, $release->refresh()->downloads);
    }

    public function test_download_serves_the_newest_build_when_no_version_is_given(): void
    {
        Storage::fake('local');

        AppRelease::factory()->create(['version_code' => 2, 'file_path' => 'releases/app-2.apk']);
        Storage::disk('local')->put('releases/app-2.apk', 'OLD');

        $newest = AppRelease::factory()->create(['version_code' => 9, 'file_path' => 'releases/app-9.apk']);
        Storage::disk('local')->put('releases/app-9.apk', 'NEW');

        $this->get('/api/v1/app/release/download')
            ->assertOk()
            ->assertDownload($newest->file_name);

        $this->assertSame(1, $newest->refresh()->downloads);
    }

    public function test_download_reports_404_for_an_unknown_version(): void
    {
        Storage::fake('local');
        AppRelease::factory()->create(['version_code' => 5]);

        $this->getJson('/api/v1/app/release/download?version_code=6')
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'NOT_FOUND');
    }

    public function test_download_reports_404_when_the_file_is_gone_from_disk(): void
    {
        Storage::fake('local');
        AppRelease::factory()->create(['version_code' => 7, 'file_path' => 'releases/missing.apk']);

        $this->getJson('/api/v1/app/release/download?version_code=7')
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'NOT_FOUND');
    }
}
