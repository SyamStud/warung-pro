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

    public function update(UpdateProductRequest $request, int $product): ProductResource
    {
        $model = $this->findProduct($request, $product);

        $model->update($request->validated());

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
}
