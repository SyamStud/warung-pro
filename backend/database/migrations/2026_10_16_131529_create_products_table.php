<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->string('sku');
            $table->string('barcode')->nullable();
            $table->string('unit');
            $table->bigInteger('selling_price');
            $table->text('notes')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            // SKU is unique per owner; archived rows keep their SKU reserved.
            $table->unique(['user_id', 'sku']);
            $table->index('name');
        });

        // Barcode is unique per owner only when present and not archived.
        // Partial indexes are supported by both PostgreSQL and SQLite.
        DB::statement(
            'CREATE UNIQUE INDEX products_user_id_barcode_unique
             ON products (user_id, barcode)
             WHERE barcode IS NOT NULL AND deleted_at IS NULL'
        );

        // Keep prices non-negative at the database level on PostgreSQL.
        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::statement(
                'ALTER TABLE products
                 ADD CONSTRAINT products_selling_price_non_negative
                 CHECK (selling_price >= 0)'
            );
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
