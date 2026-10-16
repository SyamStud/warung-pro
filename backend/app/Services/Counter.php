<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

/**
 * Atomic, monotonic counter backed by the `counters` table.
 *
 * Used to generate human-readable sequences (SKU, transaction numbers) that
 * must stay unique under concurrent requests. The increment is a single
 * atomic statement, so two parallel callers never observe the same value.
 */
class Counter
{
    /**
     * Reserve and return the next value for the given key.
     */
    public function next(string $key): int
    {
        return DB::transaction(function () use ($key): int {
            DB::table('counters')->insertOrIgnore(['key' => $key, 'value' => 0]);
            DB::table('counters')->where('key', $key)->increment('value');

            return (int) DB::table('counters')->where('key', $key)->value('value');
        });
    }

    /**
     * The highest value handed out so far, without reserving anything.
     */
    public function current(string $key): int
    {
        return (int) (DB::table('counters')->where('key', $key)->value('value') ?? 0);
    }
}
