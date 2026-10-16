<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('idempotency_key')->nullable()->after('is_active');
        });

        // A retried offline create with the same key must resolve to the same
        // product instead of creating a duplicate.
        DB::statement(
            'CREATE UNIQUE INDEX products_user_id_idempotency_key_unique
             ON products (user_id, idempotency_key)
             WHERE idempotency_key IS NOT NULL'
        );
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('idempotency_key');
        });
    }
};
