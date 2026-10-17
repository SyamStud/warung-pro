<?php

namespace App\Console\Commands;

use App\Models\AppRelease;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/**
 * Publishes an APK so every installed app is offered the update.
 *
 *   php artisan release:publish ~/Downloads/warung-pos-debug.apk --notes="Perbaikan pemindai"
 *
 * `versionCode` and `versionName` are read from the mobile project
 * (`android/app/build.gradle`), so a release cannot be published under the
 * wrong number by accident. Pass `--version-code` / `--version-name` to
 * override, or `--app-dir` if the mobile project lives elsewhere.
 */
class PublishAppRelease extends Command
{
    protected $signature = 'release:publish
        {file : Path to the .apk to publish (supports ~)}
        {--notes= : Short release notes shown in the app}
        {--version-code= : Override versionCode}
        {--version-name= : Override versionName}
        {--app-dir= : Mobile project directory used to read the version (default: ../mobile)}';

    protected $description = 'Publish an Android build so installed apps see an update';

    public function handle(): int
    {
        $source = $this->resolveSource((string) $this->argument('file'));

        if ($source === null) {
            $this->error('Berkas APK tidak ditemukan. Periksa lagi path-nya.');

            return self::FAILURE;
        }

        [$versionCode, $versionName] = $this->resolveVersion();

        if ($versionCode === null || $versionName === null) {
            $this->error(
                'versionCode/versionName tidak terbaca dari proyek mobile. '.
                'Isi --version-code dan --version-name.'
            );

            return self::FAILURE;
        }

        $fileName = 'warung-pos-'.$this->slug($versionName).'-'.$versionCode.'.apk';
        $path = 'releases/'.$fileName;

        $disk = Storage::disk('local');
        $disk->makeDirectory('releases');
        $disk->put($path, fopen($source, 'r'));

        $size = $disk->size($path);

        $release = AppRelease::updateOrCreate(
            ['version_code' => $versionCode],
            [
                'version_name' => $versionName,
                'notes' => $this->option('notes'),
                'file_path' => $path,
                'file_name' => $fileName,
                'size_bytes' => $size,
                'sha256' => hash_file('sha256', $disk->path($path)),
                'published_at' => now(),
            ],
        );

        $this->info(sprintf(
            'Rilis %s (versionCode %d) diterbitkan.',
            $release->version_name,
            $release->version_code,
        ));
        $this->line('  berkas : '.$disk->path($path));
        $this->line('  ukuran : '.number_format($size / 1_048_576, 1, ',', '.').' MB');
        $this->line('  sha256 : '.$release->sha256);
        $this->line('  unduh  : '.url('/api/v1/app/release/download?version_code='.$release->version_code));
        $this->newLine();
        $this->line('Aplikasi yang sudah terpasang akan menawarkan pembaruan ini saat dibuka.');

        return self::SUCCESS;
    }

    /**
     * The version to publish: explicit options win, otherwise it is read from
     * the mobile project's Gradle file.
     *
     * @return array{0: int|null, 1: string|null}
     */
    private function resolveVersion(): array
    {
        $code = $this->option('version-code');
        $name = $this->option('version-name');

        if ($code !== null && $name !== null) {
            return [(int) $code, (string) $name];
        }

        $appDir = (string) ($this->option('app-dir') ?: base_path('../mobile'));
        $gradle = rtrim($appDir, '/').'/android/app/build.gradle';
        $contents = is_file($gradle) ? (string) file_get_contents($gradle) : '';

        if ($code === null && preg_match('/versionCode\s+(\d+)/', $contents, $matches) === 1) {
            $code = $matches[1];
        }

        if ($name === null && preg_match('/versionName\s+"([^"]+)"/', $contents, $matches) === 1) {
            $name = $matches[1];
        }

        return [
            $code === null ? null : (int) $code,
            $name === null ? null : (string) $name,
        ];
    }

    /** Resolves a path given with `~` or relative to the current directory. */
    private function resolveSource(string $file): ?string
    {
        $candidates = [$file];

        if (str_starts_with($file, '~/')) {
            $home = getenv('HOME');

            if ($home !== false && $home !== '') {
                $candidates[] = rtrim($home, '/').'/'.substr($file, 2);
            }
        }

        $candidates[] = rtrim((string) getcwd(), '/').'/'.$file;

        foreach ($candidates as $candidate) {
            $resolved = realpath($candidate);

            if ($resolved !== false && is_file($resolved)) {
                return $resolved;
            }
        }

        return null;
    }

    /** Keeps the stored file name shell- and URL-friendly. */
    private function slug(string $value): string
    {
        return trim((string) preg_replace('/[^0-9A-Za-z._-]+/', '-', $value), '-');
    }
}
