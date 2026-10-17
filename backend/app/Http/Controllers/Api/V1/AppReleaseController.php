<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\AppReleaseResource;
use App\Models\AppRelease;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Tells an installed app whether a newer build exists, and serves that APK.
 *
 * Both routes are public on purpose: the check runs while the app starts,
 * before anyone logs in, and an app that cannot reach this endpoint simply
 * carries on without an update notice.
 */
class AppReleaseController extends Controller
{
    /** The newest published build, or 404 when nothing has been published yet. */
    public function show(): AppReleaseResource
    {
        return new AppReleaseResource($this->latestRelease());
    }

    /** Streams one APK (the newest by default) through this host. */
    public function download(Request $request): BinaryFileResponse
    {
        $versionCode = $request->integer('version_code');

        $release = $versionCode > 0
            ? AppRelease::query()->where('version_code', $versionCode)->first()
            : AppRelease::query()->newest()->first();

        if ($release === null) {
            abort(404, $versionCode > 0
                ? 'Versi aplikasi tersebut tidak ditemukan.'
                : 'Belum ada versi aplikasi yang diterbitkan.');
        }

        $disk = Storage::disk('local');

        if (! $disk->exists($release->file_path)) {
            abort(404, 'Berkas aplikasi tidak tersedia di server.');
        }

        $release->increment('downloads');

        return response()->download($disk->path($release->file_path), $release->file_name, [
            'Content-Type' => 'application/vnd.android.package-archive',
            'Cache-Control' => 'no-store',
        ]);
    }

    private function latestRelease(): AppRelease
    {
        $release = AppRelease::query()->newest()->first();

        if ($release === null) {
            abort(404, 'Belum ada versi aplikasi yang diterbitkan.');
        }

        return $release;
    }
}
