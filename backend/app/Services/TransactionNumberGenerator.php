<?php

namespace App\Services;

/**
 * Generates transaction numbers in the form `TRX-20261016-0001`.
 *
 * The daily sequence comes from the shared atomic {@see Counter} (keyed by
 * date, so it restarts each day) rather than a row count, keeping numbers
 * unique under concurrent checkouts.
 */
class TransactionNumberGenerator
{
    private const PREFIX = 'TRX-';

    private const PAD_LENGTH = 4;

    public function __construct(private readonly Counter $counter) {}

    public function next(): string
    {
        $date = now()->format('Ymd');
        $sequence = $this->counter->next("transaction_number:{$date}");

        return self::PREFIX.$date.'-'.str_pad((string) $sequence, self::PAD_LENGTH, '0', STR_PAD_LEFT);
    }
}
