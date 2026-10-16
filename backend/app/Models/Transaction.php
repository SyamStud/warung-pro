<?php

namespace App\Models;

use Database\Factories\TransactionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'transaction_number',
    'status',
    'subtotal',
    'discount_amount',
    'total',
    'paid_amount',
    'change_amount',
    'idempotency_key',
])]
class Transaction extends Model
{
    /** @use HasFactory<TransactionFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'subtotal' => 'integer',
            'discount_amount' => 'integer',
            'total' => 'integer',
            'paid_amount' => 'integer',
            'change_amount' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(TransactionItem::class);
    }

    #[Scope]
    protected function forUser(Builder $query, User $user): Builder
    {
        return $query->whereBelongsTo($user);
    }
}
