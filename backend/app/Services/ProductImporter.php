<?php

namespace App\Services;

use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Fills the catalog from a parsed spreadsheet.
 *
 * The phone reads the .xlsx and posts plain rows, so this is where the real
 * rules live. Each row is judged on its own — one unreadable line never sinks
 * the rest — and the whole file lands in a single transaction.
 *
 * A row is matched to an existing product by SKU when it has one, and by name
 * when it does not, so re-importing a file without SKUs updates prices instead
 * of piling up duplicates.
 */
class ProductImporter
{
    /** Rows accepted in one file. */
    public const MAX_ROWS = 500;

    /** Highest price accepted, in rupiah. */
    private const MAX_PRICE = 999_999_999_999;

    private const DEFAULT_UNIT = 'pcs';

    public function __construct(private readonly SkuGenerator $skus) {}

    /**
     * @param  array<int, array<string, mixed>>  $rows
     */
    public function import(User $user, array $rows, bool $updateExisting): ProductImportResult
    {
        [$prepared, $issues] = $this->prepare($rows);

        $categoriesCreated = [];
        $created = 0;
        $updated = 0;

        DB::transaction(function () use (
            $user,
            $prepared,
            $updateExisting,
            &$issues,
            &$categoriesCreated,
            &$created,
            &$updated,
        ): void {
            foreach ($prepared as $row) {
                $existing = $this->findProduct($user, $row);

                if ($existing && ! $updateExisting) {
                    $issues[] = $this->issue(
                        $row,
                        'Sudah ada di katalog — centang "Perbarui produk yang ada" untuk mengubahnya.',
                    );

                    continue;
                }

                $attributes = [
                    'name' => $row['name'],
                    'unit' => $row['unit'],
                    'selling_price' => $row['price'],
                    'notes' => $row['notes'],
                    'category_id' => $this->categoryId($user, $row['category'], $categoriesCreated),
                ];

                if ($existing) {
                    // A name that differs only in case is the same name: keep
                    // the spelling the catalog already shows instead of
                    // rewriting every product on every import.
                    if (mb_strtolower($existing->name) === mb_strtolower((string) $row['name'])) {
                        unset($attributes['name']);
                    }

                    $existing->fill($attributes);
                    $existing->version = $existing->version + 1;
                    $existing->save();
                    $updated++;

                    continue;
                }

                $user->products()->create($attributes + ['sku' => $row['sku'] ?? $this->skus->next()]);
                $created++;
            }
        });

        usort($issues, fn (array $a, array $b): int => $a['row'] <=> $b['row']);

        return new ProductImportResult($created, $updated, $issues, $categoriesCreated);
    }

    /**
     * Check every row on its own, and remember the keys already used inside this
     * file. Nothing here touches the database: the whole sheet is understood
     * before the first write, so a bad line cannot leave half an import behind.
     *
     * @param  array<int, array<string, mixed>>  $rows
     * @return array{0: list<array<string, mixed>>, 1: list<array<string, mixed>>}
     */
    private function prepare(array $rows): array
    {
        $prepared = [];
        $issues = [];
        $seen = [];

        foreach (array_values($rows) as $index => $raw) {
            $number = is_array($raw) ? (int) ($raw['row'] ?? 0) : 0;
            $row = $number > 0 ? $number : $index + 2;

            $name = is_array($raw) ? $this->text($raw['name'] ?? null) : null;
            $sku = is_array($raw) ? $this->text($raw['sku'] ?? null) : null;
            $unit = is_array($raw) ? $this->text($raw['unit'] ?? null) : null;
            $category = is_array($raw) ? $this->text($raw['category'] ?? null) : null;
            $notes = is_array($raw) ? $this->text($raw['notes'] ?? null) : null;
            $price = is_array($raw) ? $this->price($raw['selling_price'] ?? null) : null;

            // A trailing row of an empty spreadsheet is not a mistake.
            if ($name === null && $sku === null && $unit === null && $category === null && $notes === null && $price === null) {
                continue;
            }

            $problem = match (true) {
                $name === null => 'Nama produk kosong.',
                mb_strlen($name) > 255 => 'Nama produk lebih dari 255 karakter.',
                $price === null => 'Harga jual kosong atau tidak terbaca.',
                $unit !== null && mb_strlen($unit) > 50 => 'Satuan lebih dari 50 karakter.',
                $sku !== null && mb_strlen($sku) > 255 => 'SKU lebih dari 255 karakter.',
                $category !== null && mb_strlen($category) > 255 => 'Nama kategori lebih dari 255 karakter.',
                $notes !== null && mb_strlen($notes) > 500 => 'Catatan lebih dari 500 karakter.',
                default => null,
            };

            if ($problem !== null) {
                $issues[] = $this->issue(compact('row', 'name', 'sku'), $problem);

                continue;
            }

            $key = $sku !== null
                ? 'sku:'.mb_strtolower($sku)
                : 'name:'.mb_strtolower((string) $name);

            if (isset($seen[$key])) {
                $issues[] = $this->issue(
                    compact('row', 'name', 'sku'),
                    "Baris ganda — sama dengan baris {$seen[$key]}.",
                );

                continue;
            }

            $seen[$key] = $row;

            $prepared[] = [
                'row' => $row,
                'name' => $name,
                'sku' => $sku,
                'unit' => $unit ?? self::DEFAULT_UNIT,
                'price' => $price,
                'category' => $category,
                'notes' => $notes,
            ];
        }

        return [$prepared, $issues];
    }

    /**
     * The live product this row talks about: by SKU when the sheet has one, by
     * name otherwise.
     *
     * @param  array<string, mixed>  $row
     */
    private function findProduct(User $user, array $row): ?Product
    {
        if ($row['sku'] !== null) {
            return $user->products()->where('sku', $row['sku'])->first();
        }

        return $user->products()
            ->whereRaw('lower(name) = ?', [mb_strtolower((string) $row['name'])])
            ->orderBy('id')
            ->first();
    }

    /**
     * Reuse the category with that name, or create it — a sheet that groups its
     * rows under "Minuman" should not need the category to exist beforehand.
     *
     * @param  list<string>  $created
     */
    private function categoryId(User $user, ?string $name, array &$created): ?int
    {
        if ($name === null) {
            return null;
        }

        /** @var Category|null $existing */
        $existing = $user->categories()
            ->whereRaw('lower(name) = ?', [mb_strtolower($name)])
            ->first();

        if ($existing) {
            return $existing->id;
        }

        /** @var Category $category */
        $category = $user->categories()->create(['name' => $name]);
        $created[] = $category->name;

        return $category->id;
    }

    private function text(mixed $value): ?string
    {
        if (is_string($value)) {
            $trimmed = trim($value);

            return $trimmed === '' ? null : $trimmed;
        }

        // A SKU or unit written as a number in the sheet arrives as a number.
        if (is_int($value) || is_float($value)) {
            return (string) $value;
        }

        return null;
    }

    private function price(mixed $value): ?int
    {
        if (is_int($value)) {
            $amount = $value;
        } elseif (is_float($value)) {
            $amount = (int) round($value);
        } elseif (is_string($value) && is_numeric(trim($value))) {
            $amount = (int) round((float) trim($value));
        } else {
            return null;
        }

        return $amount >= 0 && $amount <= self::MAX_PRICE ? $amount : null;
    }

    /**
     * @param  array<string, mixed>  $row
     * @return array{row: int, name: string|null, message: string}
     */
    private function issue(array $row, string $message): array
    {
        return [
            'row' => (int) $row['row'],
            'name' => $row['name'] ?? $row['sku'] ?? null,
            'message' => $message,
        ];
    }
}
