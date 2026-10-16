<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Transaction\StoreTransactionRequest;
use App\Http\Resources\TransactionResource;
use App\Models\Transaction;
use App\Services\TransactionService;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class TransactionController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $perPage = min(max($request->integer('per_page', 20), 1), 100);

        return TransactionResource::collection(
            $request->user()->transactions()->with('items')->latest('id')->paginate($perPage)
        );
    }

    public function store(StoreTransactionRequest $request, TransactionService $transactions): JsonResponse
    {
        $idempotencyKey = $request->header('Idempotency-Key');

        // Replaying a checkout (e.g. a retried offline request) must return the
        // transaction already stored for this key instead of charging twice.
        if ($idempotencyKey) {
            $existing = $this->findByIdempotencyKey($request, $idempotencyKey);

            if ($existing) {
                return (new TransactionResource($existing))->response()->setStatusCode(200);
            }
        }

        $data = $request->validated();

        try {
            $transaction = $transactions->create(
                $request->user(),
                $data['items'],
                (int) ($data['discount_amount'] ?? 0),
                (int) $data['paid_amount'],
                $idempotencyKey,
            );
        } catch (UniqueConstraintViolationException $e) {
            // Lost a race with a concurrent replay of the same key.
            $existing = $idempotencyKey
                ? $this->findByIdempotencyKey($request, $idempotencyKey)
                : null;

            if ($existing) {
                return (new TransactionResource($existing))->response()->setStatusCode(200);
            }

            throw $e;
        }

        return (new TransactionResource($transaction))->response()->setStatusCode(201);
    }

    public function show(Request $request, int $transaction): TransactionResource
    {
        return new TransactionResource($this->findTransaction($request, $transaction));
    }

    /**
     * Data for printing a receipt. Print status is tracked separately from the
     * transaction status, so a failed print never voids the sale.
     */
    public function receipt(Request $request, int $transaction): TransactionResource
    {
        return new TransactionResource($this->findTransaction($request, $transaction));
    }

    private function findTransaction(Request $request, int $id): Transaction
    {
        return $request->user()->transactions()->with('items')->findOrFail($id);
    }

    private function findByIdempotencyKey(Request $request, string $key): ?Transaction
    {
        return $request->user()->transactions()
            ->with('items')
            ->where('idempotency_key', $key)
            ->first();
    }
}
