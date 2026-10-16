<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * SKU and barcode are the same identifier in this app: one code per product
     * that may be auto-generated, typed by hand, or filled from a scan.
     *
     * Existing barcodes win over placeholder SKUs, and a SKU is unique per owner
     * only while the product is live, so re-adding a previously archived product
     * (for example by scanning its barcode again) keeps working.
     */
    public function up(): void
    {
        // Drop the strict (user_id, sku) index first: the backfill below may
        // reuse a code held by an archived row, which the new partial index
        // allows but the old one did not.
        DB::statement('DROP INDEX IF EXISTS products_user_id_sku_unique');

        $this->promoteProductBarcodes();
        $this->promoteItemBarcodes();

        DB::statement('DROP INDEX IF EXISTS products_user_id_barcode_unique');

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('barcode');
        });

        Schema::table('transaction_items', function (Blueprint $table) {
            $table->dropColumn('barcode');
        });

        DB::statement(
            'CREATE UNIQUE INDEX products_user_id_sku_unique
             ON products (user_id, sku)
             WHERE deleted_at IS NULL'
        );
    }

    /**
     * Reversal restores the old columns and indexes, but the merge itself cannot
     * be undone: the original barcode values are gone.
     */
    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS products_user_id_sku_unique');

        Schema::table('products', function (Blueprint $table) {
            $table->string('barcode')->nullable();
        });

        Schema::table('transaction_items', function (Blueprint $table) {
            $table->string('barcode')->nullable();
        });

        DB::statement('CREATE UNIQUE INDEX products_user_id_sku_unique ON products (user_id, sku)');
        DB::statement(
            'CREATE UNIQUE INDEX products_user_id_barcode_unique
             ON products (user_id, barcode)
             WHERE barcode IS NOT NULL AND deleted_at IS NULL'
        );
    }

    /**
     * Give every product that carried a scanned barcode that code as its SKU,
     * unless a live product of the same owner already uses it.
     */
    private function promoteProductBarcodes(): void
    {
        $rows = DB::table('products')
            ->whereNotNull('barcode')
            ->whereColumn('barcode', '!=', 'sku')
            ->orderBy('id')
            ->get(['id', 'user_id', 'barcode']);

        foreach ($rows as $row) {
            $taken = DB::table('products')
                ->where('user_id', $row->user_id)
                ->where('sku', $row->barcode)
                ->whereNull('deleted_at')
                ->where('id', '!=', $row->id)
                ->exists();

            if ($taken) {
                continue;
            }

            DB::table('products')->where('id', $row->id)->update(['sku' => $row->barcode]);
        }
    }

    /**
     * Historic line snapshots keep their scanned code, in the SKU column.
     */
    private function promoteItemBarcodes(): void
    {
        DB::table('transaction_items')
            ->whereNotNull('barcode')
            ->where(function ($query): void {
                $query->whereNull('sku')->orWhere('sku', '');
            })
            ->update(['sku' => DB::raw('barcode')]);
    }
};
