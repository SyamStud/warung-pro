<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * How a sale was paid: `cash` or `non_cash`. Existing rows were all paid in
     * cash, which the column default records.
     */
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->string('payment_method', 20)->default('cash')->after('paid_amount');
        });

        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::statement(
                "ALTER TABLE transactions
                 ADD CONSTRAINT transactions_payment_method_valid
                 CHECK (payment_method IN ('cash', 'non_cash'))"
            );
        }
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropColumn('payment_method');
        });
    }
};
