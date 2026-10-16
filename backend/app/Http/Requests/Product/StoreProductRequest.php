<?php

namespace App\Http\Requests\Product;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        $userId = $this->user()->id;

        return [
            'name' => ['required', 'string', 'max:255'],
            'sku' => [
                'nullable', 'string', 'max:255',
                // SKU uniqueness is per owner and includes archived rows,
                // matching the products (user_id, sku) unique index.
                Rule::unique('products', 'sku')->where('user_id', $userId),
            ],
            'barcode' => [
                'nullable', 'string', 'max:255',
                // Barcode uniqueness ignores archived rows, matching the
                // partial unique index.
                Rule::unique('products', 'barcode')
                    ->where('user_id', $userId)
                    ->whereNull('deleted_at'),
            ],
            'unit' => ['required', 'string', 'max:50'],
            'selling_price' => ['required', 'integer', 'min:0'],
            'category_id' => [
                'nullable', 'integer',
                Rule::exists('categories', 'id')->where('user_id', $userId),
            ],
            'notes' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
