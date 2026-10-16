<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Monotonic revision of a product row, used for optimistic concurrency:
     * a client sends the version its edit was based on, and the API rejects the
     * write when another device has already moved the row forward.
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->unsignedBigInteger('version')->default(1)->after('idempotency_key');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('version');
        });
    }
};
