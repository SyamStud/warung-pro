<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Product\StoreProductRequest;
use App\Http\Requests\Product\UpdateProductRequest;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use App\Services\SkuGenerator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class ProductController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = $request->user()->products()->with('category');

        $search = $request->string('search')->trim()->toString();
        if ($search !== '') {
            $query->search($search);
        }

        if ($request->filled('category_id')) {
            $query->where('category_id', $request->integer('category_id'));
        }

        $perPage = min(max($request->integer('per_page', 20), 1), 100);

        return ProductResource::collection(
            $query->latest('id')->paginate($perPage)
        );
    }

    public function store(StoreProductRequest $request, SkuGenerator $skus): JsonResponse
    {
        $idempotencyKey = $request->header('Idempotency-Key');

        // Replay of an offline-queued create: return the product already made
        // for this key instead of creating a duplicate.
        if ($idempotencyKey) {
            $existing = $request->user()->products()
                ->where('idempotency_key', $idempotencyKey)
                ->first();

            if ($existing) {
                return (new ProductResource($existing))->response()->setStatusCode(200);
            }
        }

        $data = $request->safe()->only([
            'name', 'barcode', 'unit', 'selling_price', 'category_id', 'notes', 'is_active',
        ]);

        $data['sku'] = $request->filled('sku')
            ? $request->string('sku')->toString()
            : $skus->next();
        $data['idempotency_key'] = $idempotencyKey;

        $product = $request->user()->products()->create($data);

        return (new ProductResource($product))->response()->setStatusCode(201);
    }

    public function show(Request $request, int $product): ProductResource
    {
        return new ProductResource($this->findProduct($request, $product));
    }

    /**
     * Update a product.
     *
     * When the client sends the `version` its edit was based on, a newer server
     * version is reported as a conflict (409) rather than silently overwriting
     * a change made on another device.
     */
    public function update(UpdateProductRequest $request, int $product): ProductResource|JsonResponse
    {
        $model = $this->findProduct($request, $product);

        /** @var array<string, mixed> $attributes */
        $attributes = $request->safe()->only([
            'name', 'sku', 'barcode', 'unit', 'selling_price', 'category_id', 'notes', 'is_active',
        ]);

        $baseVersion = $request->filled('version') ? $request->integer('version') : null;

        if (
            $baseVersion !== null
            && $baseVersion !== $model->version
            && ! $request->boolean('force')
        ) {
            // A retried write that already landed is not a conflict.
            if (! $this->alreadyApplied($model, $attributes)) {
                return $this->conflictResponse($model);
            }

            return new ProductResource($model);
        }

        $model->fill($attributes);
        $model->version = $model->version + 1;
        $model->save();

        return new ProductResource($model);
    }

    /**
     * Archive a product rather than deleting it, so transaction history that
     * references it stays intact.
     */
    public function destroy(Request $request, int $product): Response
    {
        $model = $this->findProduct($request, $product);

        $model->update(['is_active' => false]);
        $model->delete();

        return response()->noContent();
    }

    /**
     * Price-checker lookup: resolve a product from a scanned barcode.
     */
    public function lookup(Request $request): ProductResource
    {
        $barcode = $request->string('barcode')->trim()->toString();

        $product = $request->user()->products()
            ->where('barcode', $barcode)
            ->first();

        abort_if($product === null, 404, 'Produk dengan barcode tersebut tidak ditemukan.');

        return new ProductResource($product);
    }

    /**
     * Resolve a product owned by the authenticated user, or fail with 404 so
     * a different account cannot learn that the record exists.
     */
    private function findProduct(Request $request, int $id): Product
    {
        return $request->user()->products()->findOrFail($id);
    }

    /**
     * Whether the stored row already holds every value the client asked for.
     *
     * A lost response to an earlier successful write looks exactly like this,
     * so it must not be reported to the user as a conflict.
     *
     * @param  array<string, mixed>  $attributes
     */
    private function alreadyApplied(Product $product, array $attributes): bool
    {
        foreach ($attributes as $key => $value) {
            $current = $product->getAttribute($key);

            if ($current === null || $value === null) {
                if ($current !== $value) {
                    return false;
                }

                continue;
            }

            if (is_bool($current) || is_bool($value)) {
                if ((bool) $current !== (bool) $value) {
                    return false;
                }

                continue;
            }

            if ((string) $current !== (string) $value) {
                return false;
            }
        }

        return true;
    }

    /**
     * 409 response carrying the server's current row so the client can show a
     * side-by-side comparison before the user picks a winner.
     */
    private function conflictResponse(Product $product): JsonResponse
    {
        return response()->json([
            'error' => [
                'code' => 'CONFLICT',
                'message' => 'Produk ini sudah diubah di perangkat lain.',
                'details' => ['current' => (new ProductResource($product))->resolve()],
            ],
        ], 409);
    }
}
