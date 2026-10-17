<?php

namespace App\Http\Resources;

use App\Models\AppRelease;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin AppRelease
 */
class AppReleaseResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'version_code' => $this->version_code,
            'version_name' => $this->version_name,
            'notes' => $this->notes,
            'size_bytes' => $this->size_bytes,
            'sha256' => $this->sha256,
            'published_at' => $this->published_at?->toIso8601String(),
            // Pinned to this exact build, so the app never installs a different
            // version than the one it was told about.
            'download_url' => url('/api/v1/app/release/download?version_code='.$this->version_code),
        ];
    }
}
