<?php

namespace App\Services;

/**
 * Generates transaction numbers in the form `TRX-20261016-0001`.
 *
 * The daily sequence is per calendar date and reserves its value from the
 * shared atomic {@see Counter}, so parallel checkouts cannot collide.
 */
class TransactionNumberGenerator
{
    private const PAD_LENGTH = 4;

    public function __construct(private readonly Counter $counter) {}

    public function next(): string
    {
        $date = now()->format('Ymd');
        $sequence = $this->counter->next('transaction_number:'.$date);

        return "TRX-{$date}-".str_pad((string) $sequence, self::PAD_LENGTH, '0', STR_PAD_LEFT);
    }
}
