<?php

namespace App\Http\Requests\Product;

use App\Services\ProductImporter;
use Illuminate\Foundation\Http\FormRequest;

class ImportProductsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Only the envelope is strict here. Anything wrong with a single row is
     * answered per line in `data.issues`, so one unreadable line never rejects
     * a whole spreadsheet.
     *
     * Every row field still needs a rule: `validated()` keeps nothing it has no
     * rule for, so a missing one would silently drop the column.
     *
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'rows' => ['required', 'array', 'min:1', 'max:'.ProductImporter::MAX_ROWS],
            'rows.*' => ['array'],
            'rows.*.row' => ['nullable'],
            'rows.*.name' => ['nullable'],
            'rows.*.sku' => ['nullable'],
            'rows.*.unit' => ['nullable'],
            'rows.*.selling_price' => ['nullable'],
            'rows.*.category' => ['nullable'],
            'rows.*.notes' => ['nullable'],
            'mode' => ['nullable', 'string', 'in:create,upsert'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        $limit = ProductImporter::MAX_ROWS;

        return [
            'rows.required' => 'Tidak ada baris produk yang dikirim.',
            'rows.min' => 'Tidak ada baris produk yang dikirim.',
            'rows.max' => "Terlalu banyak baris — maksimal {$limit} produk per berkas.",
            'mode.in' => 'Mode impor tidak dikenal.',
        ];
    }
}
