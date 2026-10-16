<?php

namespace App\Models;

use Database\Factories\ProductFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable(['category_id', 'name', 'sku', 'barcode', 'unit', 'selling_price', 'notes', 'is_active', 'idempotency_key'])]
class Product extends Model
{
    /** @use HasFactory<ProductFactory> */
    use HasFactory, SoftDeletes;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'selling_price' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function transactionItems(): HasMany
    {
        return $this->hasMany(TransactionItem::class);
    }

    /** Only products that can be added to a new transaction. */
    #[Scope]
    protected function active(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /**
     * Match by name, SKU, or barcode using a single term.
     */
    #[Scope]
    protected function search(Builder $query, string $term): Builder
    {
        $like = '%'.str_replace(['%', '_'], ['\\%', '\\_'], $term).'%';

        return $query->where(function (Builder $query) use ($like) {
            $query->where('name', 'like', $like)
                ->orWhere('sku', 'like', $like)
                ->orWhere('barcode', 'like', $like);
        });
    }
}
