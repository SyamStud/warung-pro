<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\CategoryResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class CategoryController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        return CategoryResource::collection(
            $request->user()->categories()->orderBy('name')->get()
        );
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => [
                'required', 'string', 'max:255',
                Rule::unique('categories', 'name')->where('user_id', $request->user()->id),
            ],
        ]);

        $category = $request->user()->categories()->create($data);

        return (new CategoryResource($category))->response()->setStatusCode(201);
    }
}
