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
                // One code per product per owner: SKU is the scanned barcode.
                // Archived rows are excluded, so a code can be reused.
                Rule::unique('products', 'sku')
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
