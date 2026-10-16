<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transaction_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('transaction_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->string('product_name');
            $table->string('sku')->nullable();
            $table->string('barcode')->nullable();
            $table->bigInteger('unit_price');
            $table->integer('quantity');
            $table->bigInteger('line_total');
        });

        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::statement(
                'ALTER TABLE transaction_items
                 ADD CONSTRAINT transaction_items_values_valid
                 CHECK (unit_price >= 0 AND quantity > 0 AND line_total >= 0)'
            );
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('transaction_items');
    }
};
