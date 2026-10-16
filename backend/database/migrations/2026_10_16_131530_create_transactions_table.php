<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('transaction_number')->unique();
            $table->string('status')->default('paid');
            $table->bigInteger('subtotal');
            $table->bigInteger('discount_amount')->default(0);
            $table->bigInteger('total');
            $table->bigInteger('paid_amount');
            $table->bigInteger('change_amount');
            $table->string('idempotency_key')->nullable();
            $table->timestamps();

            // Replaying the same request must not create a second transaction.
            $table->unique(['user_id', 'idempotency_key']);
            // History is listed newest-first per owner.
            $table->index(['user_id', 'created_at']);
        });

        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::statement(
                'ALTER TABLE transactions
                 ADD CONSTRAINT transactions_amounts_non_negative
                 CHECK (
                     subtotal >= 0 AND discount_amount >= 0 AND total >= 0
                     AND paid_amount >= 0 AND change_amount >= 0
                 )'
            );
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('transactions');
    }
};
