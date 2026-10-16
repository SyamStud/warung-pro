<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CategoryController;
use App\Http\Controllers\Api\V1\ProductController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::post('/auth/register', [AuthController::class, 'register'])->middleware('throttle:auth');
    Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:auth');

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);

        // Declared before the resource so "lookup" is not captured as {product}.
        Route::get('/products/lookup', [ProductController::class, 'lookup']);
        Route::apiResource('products', ProductController::class);

        Route::get('/categories', [CategoryController::class, 'index']);
        Route::post('/categories', [CategoryController::class, 'store']);
    });
});
