<?php

namespace App\Http\Requests\Product;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProductRequest extends FormRequest
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
        $productId = $this->route('product');

        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'sku' => [
                'sometimes', 'string', 'max:255',
                Rule::unique('products', 'sku')->where('user_id', $userId)->ignore($productId),
            ],
            'barcode' => [
                'nullable', 'string', 'max:255',
                Rule::unique('products', 'barcode')
                    ->where('user_id', $userId)
                    ->whereNull('deleted_at')
                    ->ignore($productId),
            ],
            'unit' => ['sometimes', 'string', 'max:50'],
            'selling_price' => ['sometimes', 'integer', 'min:0'],
            'category_id' => [
                'nullable', 'integer',
                Rule::exists('categories', 'id')->where('user_id', $userId),
            ],
            'notes' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
