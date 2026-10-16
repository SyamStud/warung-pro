<?php

namespace App\Services;

/**
 * Generates internal SKUs in the form `PRD-000042`.
 *
 * The number comes from the shared atomic {@see Counter}, never from a row
 * count, so it stays unique under concurrent product creation.
 */
class SkuGenerator
{
    private const PREFIX = 'PRD-';

    private const PAD_LENGTH = 6;

    private const COUNTER_KEY = 'product_sku';

    public function __construct(private readonly Counter $counter) {}

    public function next(): string
    {
        return $this->format($this->counter->next(self::COUNTER_KEY));
    }

    /**
     * The SKU {@see next()} would produce, without consuming the sequence.
     */
    public function peek(): string
    {
        return $this->format($this->counter->current(self::COUNTER_KEY) + 1);
    }

    private function format(int $sequence): string
    {
        return self::PREFIX.str_pad((string) $sequence, self::PAD_LENGTH, '0', STR_PAD_LEFT);
    }
}
