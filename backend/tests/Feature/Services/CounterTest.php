<?php

namespace Tests\Feature\Services;

use App\Services\Counter;
use App\Services\SkuGenerator;
use App\Services\TransactionNumberGenerator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CounterTest extends TestCase
{
    use RefreshDatabase;

    public function test_next_returns_sequential_values_per_key(): void
    {
        $counter = app(Counter::class);

        $this->assertSame(1, $counter->next('alpha'));
        $this->assertSame(2, $counter->next('alpha'));
        $this->assertSame(1, $counter->next('beta'));
    }

    public function test_sku_generator_produces_padded_sequence(): void
    {
        $generator = app(SkuGenerator::class);

        $this->assertSame('PRD-000001', $generator->next());
        $this->assertSame('PRD-000002', $generator->next());
    }

    public function test_transaction_number_generator_produces_dated_sequence(): void
    {
        $generator = app(TransactionNumberGenerator::class);
        $date = now()->format('Ymd');

        $this->assertSame("TRX-{$date}-0001", $generator->next());
        $this->assertSame("TRX-{$date}-0002", $generator->next());
    }
}
