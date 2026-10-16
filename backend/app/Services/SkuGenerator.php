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

    public function __construct(private readonly Counter $counter) {}

    public function next(): string
    {
        $sequence = $this->counter->next('product_sku');

        return self::PREFIX.str_pad((string) $sequence, self::PAD_LENGTH, '0', STR_PAD_LEFT);
    }
}
