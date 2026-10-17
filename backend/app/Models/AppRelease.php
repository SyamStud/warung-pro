<?php

namespace App\Models;

use Database\Factories\AppReleaseFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * An APK published for the mobile app.
 *
 * The row with the highest `version_code` is what every installed app is told
 * to update to; older rows are kept so a specific build can still be
 * downloaded (`?version_code=`) after a newer one is published.
 */
#[Fillable([
    'version_code',
    'version_name',
    'notes',
    'file_path',
    'file_name',
    'size_bytes',
    'sha256',
    'downloads',
    'published_at',
])]
class AppRelease extends Model
{
    /** @use HasFactory<AppReleaseFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'version_code' => 'integer',
            'size_bytes' => 'integer',
            'downloads' => 'integer',
            'published_at' => 'datetime',
        ];
    }

    /**
     * Newest build first. Named `newest` rather than `latest` so Eloquent's own
     * `latest()` (which orders by `created_at`) stays available.
     */
    #[Scope]
    protected function newest(Builder $query): Builder
    {
        return $query->orderByDesc('version_code');
    }
}
