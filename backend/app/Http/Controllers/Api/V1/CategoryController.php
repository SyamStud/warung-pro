<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Category\StoreCategoryRequest;
use App\Http\Requests\Category\UpdateCategoryRequest;
use App\Http\Resources\CategoryResource;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class CategoryController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        return CategoryResource::collection(
            $request->user()->categories()->orderBy('name')->get()
        );
    }

    public function store(StoreCategoryRequest $request): JsonResponse
    {
        $category = $request->user()->categories()->create(
            $request->safe()->only(['name'])
        );

        return (new CategoryResource($category))->response()->setStatusCode(201);
    }

    public function update(UpdateCategoryRequest $request, int $category): CategoryResource
    {
        $model = $this->findCategory($request, $category);

        $model->update($request->safe()->only(['name']));

        return new CategoryResource($model);
    }

    /**
     * Delete a category. Products keep existing — the foreign key nulls their
     * `category_id`, so nothing disappears from the catalog.
     */
    public function destroy(Request $request, int $category): Response
    {
        $this->findCategory($request, $category)->delete();

        return response()->noContent();
    }

    /**
     * Resolve a category owned by the authenticated user, or fail with 404 so a
     * different account cannot learn that the record exists.
     */
    private function findCategory(Request $request, int $id): Category
    {
        return $request->user()->categories()->findOrFail($id);
    }
}
