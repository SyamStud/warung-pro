<?php

namespace App\Http\Requests\Transaction;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTransactionRequest extends FormRequest
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
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => [
                'required', 'integer',
                // Only the owner's live, active products may be sold.
                Rule::exists('products', 'id')
                    ->where('user_id', $userId)
                    ->where('is_active', true)
                    ->whereNull('deleted_at'),
            ],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:100000'],
            'discount_amount' => ['sometimes', 'integer', 'min:0'],
            'paid_amount' => ['required', 'integer', 'min:0'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'items.required' => 'Keranjang tidak boleh kosong.',
            'items.min' => 'Keranjang tidak boleh kosong.',
            'items.*.product_id.exists' => 'Produk tidak ditemukan atau sudah diarsipkan.',
            'items.*.quantity.min' => 'Jumlah minimal 1.',
            'items.*.quantity.required' => 'Jumlah wajib diisi.',
            'paid_amount.required' => 'Nominal pembayaran wajib diisi.',
            'paid_amount.min' => 'Nominal pembayaran tidak valid.',
            'discount_amount.min' => 'Diskon tidak valid.',
        ];
    }
}
