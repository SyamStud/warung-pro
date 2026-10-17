<?php

use App\Http\Controllers\Api\V1\AppReleaseController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CategoryController;
use App\Http\Controllers\Api\V1\ProductController;
use App\Http\Controllers\Api\V1\TransactionController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::post('/auth/register', [AuthController::class, 'register'])->middleware('throttle:auth');
    Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:auth');

    // Public: an installed app checks for a newer build while it starts, before
    // anyone has logged in.
    Route::get('/app/release', [AppReleaseController::class, 'show'])->middleware('throttle:api');
    Route::get('/app/release/download', [AppReleaseController::class, 'download'])->middleware('throttle:api');

    Route::middleware(['auth:sanctum', 'throttle:api'])->group(function () {
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);

        // Declared before the resource so "lookup" is not captured as {product}.
        Route::get('/products/lookup', [ProductController::class, 'lookup']);
        Route::get('/products/next-sku', [ProductController::class, 'nextSku']);
        Route::apiResource('products', ProductController::class);

        Route::get('/categories', [CategoryController::class, 'index']);
        Route::post('/categories', [CategoryController::class, 'store']);
        Route::patch('/categories/{category}', [CategoryController::class, 'update']);
        Route::delete('/categories/{category}', [CategoryController::class, 'destroy']);

        Route::post('/transactions', [TransactionController::class, 'store']);
        Route::get('/transactions', [TransactionController::class, 'index']);
        Route::get('/transactions/{transaction}', [TransactionController::class, 'show']);
        Route::get('/transactions/{transaction}/receipt', [TransactionController::class, 'receipt']);
    });
});
