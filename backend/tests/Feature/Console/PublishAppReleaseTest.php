<?php

namespace Tests\Feature\Console;

use App\Models\AppRelease;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PublishAppReleaseTest extends TestCase
{
    use RefreshDatabase;

    /** @var list<string> */
    private array $temporary = [];

    protected function tearDown(): void
    {
        foreach ($this->temporary as $path) {
            if (is_dir($path)) {
                $this->removeDirectory($path);
            } elseif (is_file($path)) {
                @unlink($path);
            }
        }

        parent::tearDown();
    }

    public function test_it_publishes_an_apk_using_the_version_from_the_mobile_project(): void
    {
        Storage::fake('local');

        $apk = $this->fakeApk('APK-BYTES');
        $appDir = $this->fakeMobileProject(versionCode: 7, versionName: '1.3.0');

        $this->artisan('release:publish', [
            'file' => $apk,
            '--app-dir' => $appDir,
            '--notes' => 'Pemindai lebih cepat',
        ])->assertExitCode(0);

        $release = AppRelease::sole();

        $this->assertSame(7, $release->version_code);
        $this->assertSame('1.3.0', $release->version_name);
        $this->assertSame('Pemindai lebih cepat', $release->notes);
        $this->assertSame(9, $release->size_bytes);
        $this->assertSame(hash_file('sha256', $apk), $release->sha256);
        $this->assertSame('warung-pos-1.3.0-7.apk', $release->file_name);
        Storage::disk('local')->assertExists($release->file_path);
        $this->assertSame('APK-BYTES', Storage::disk('local')->get($release->file_path));
    }

    public function test_publishing_the_same_version_code_replaces_the_previous_row(): void
    {
        Storage::fake('local');

        $appDir = $this->fakeMobileProject(versionCode: 2, versionName: '1.1.0');

        $this->artisan('release:publish', ['file' => $this->fakeApk('FIRST'), '--app-dir' => $appDir])
            ->assertExitCode(0);
        $this->artisan('release:publish', ['file' => $this->fakeApk('SECOND'), '--app-dir' => $appDir])
            ->assertExitCode(0);

        $release = AppRelease::sole();

        $this->assertSame('SECOND', Storage::disk('local')->get($release->file_path));
    }

    public function test_options_override_the_version_from_the_project(): void
    {
        Storage::fake('local');
        $appDir = $this->fakeMobileProject(versionCode: 1, versionName: '1.0.0');

        $this->artisan('release:publish', [
            'file' => $this->fakeApk('APK'),
            '--app-dir' => $appDir,
            '--version-code' => '12',
            '--version-name' => '2.0.0',
        ])->assertExitCode(0);

        $this->assertDatabaseHas('app_releases', ['version_code' => 12, 'version_name' => '2.0.0']);
    }

    public function test_it_fails_when_the_apk_does_not_exist(): void
    {
        Storage::fake('local');

        $this->artisan('release:publish', ['file' => '/tmp/tidak-ada-'.uniqid().'.apk'])
            ->expectsOutputToContain('Berkas APK tidak ditemukan')
            ->assertExitCode(1);

        $this->assertSame(0, AppRelease::count());
    }

    public function test_it_fails_when_the_version_cannot_be_determined(): void
    {
        Storage::fake('local');
        $emptyDir = $this->temporaryDirectory();

        $this->artisan('release:publish', [
            'file' => $this->fakeApk('APK'),
            '--app-dir' => $emptyDir,
        ])->expectsOutputToContain('versionCode/versionName tidak terbaca')
            ->assertExitCode(1);

        $this->assertSame(0, AppRelease::count());
    }

    private function fakeApk(string $contents): string
    {
        $path = tempnam(sys_get_temp_dir(), 'warung-apk');
        file_put_contents($path, $contents);
        $this->temporary[] = $path;

        return $path;
    }

    /** A stand-in for `mobile/` holding just the Gradle file the command reads. */
    private function fakeMobileProject(int $versionCode, string $versionName): string
    {
        $appDir = $this->temporaryDirectory();
        mkdir($appDir.'/android/app', 0o777, true);
        file_put_contents(
            $appDir.'/android/app/build.gradle',
            "android {\n    defaultConfig {\n        versionCode {$versionCode}\n        versionName \"{$versionName}\"\n    }\n}\n",
        );

        return $appDir;
    }

    private function temporaryDirectory(): string
    {
        $path = sys_get_temp_dir().'/warung-mobile-'.uniqid();
        mkdir($path, 0o777, true);
        $this->temporary[] = $path;

        return $path;
    }

    private function removeDirectory(string $path): void
    {
        $entries = scandir($path);

        foreach ($entries === false ? [] : $entries as $entry) {
            if ($entry === '.' || $entry === '..') {
                continue;
            }

            $full = $path.'/'.$entry;

            if (is_dir($full)) {
                $this->removeDirectory($full);
            } else {
                @unlink($full);
            }
        }

        @rmdir($path);
    }
}
