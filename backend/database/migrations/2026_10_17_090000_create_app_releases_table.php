<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Android builds offered to installed apps. One row per `versionCode`; the
     * newest row is what an app compares its own build against.
     */
    public function up(): void
    {
        Schema::create('app_releases', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('version_code')->unique();
            $table->string('version_name');
            $table->text('notes')->nullable();
            $table->string('file_path');
            $table->string('file_name');
            $table->unsignedBigInteger('size_bytes');
            $table->string('sha256', 64);
            $table->unsignedBigInteger('downloads')->default(0);
            $table->timestamp('published_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('app_releases');
    }
};
