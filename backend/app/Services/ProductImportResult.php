<?php

namespace App\Services;

/**
 * What an import did, in the shape the app shows afterwards.
 *
 * `issues` are the rows the user should hear about — a row that could not be
 * read, or one that was left out because the product it names already exists.
 */
final readonly class ProductImportResult
{
    /**
     * @param  list<array{row: int, name: string|null, message: string}>  $issues
     * @param  list<string>  $categoriesCreated
     */
    public function __construct(
        public int $created,
        public int $updated,
        public array $issues = [],
        public array $categoriesCreated = [],
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'created' => $this->created,
            'updated' => $this->updated,
            'skipped' => count($this->issues),
            'categories_created' => $this->categoriesCreated,
            'issues' => $this->issues,
        ];
    }
}
