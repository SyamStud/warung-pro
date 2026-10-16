<?php

use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Behind a TLS-terminating reverse proxy (nginx/Caddy), set TRUSTED_PROXIES
        // so Laravel sees the original scheme/host. Unset means trust no proxy.
        $trustedProxies = env('TRUSTED_PROXIES');

        if ($trustedProxies) {
            $middleware->trustProxies(at: $trustedProxies === '*'
                ? '*'
                : array_map('trim', explode(',', $trustedProxies)));
        }
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // Every API error uses the same envelope: { error: { code, message, details? } }.

        $exceptions->render(function (ValidationException $e, Request $request) {
            return response()->json([
                'error' => [
                    'code' => 'VALIDATION_ERROR',
                    'message' => $e->getMessage(),
                    'details' => $e->errors(),
                ],
            ], 422);
        });

        $exceptions->render(function (AuthenticationException $e, Request $request) {
            return response()->json([
                'error' => [
                    'code' => 'UNAUTHENTICATED',
                    'message' => 'Tidak terautentikasi.',
                ],
            ], 401);
        });

        $exceptions->render(function (AccessDeniedHttpException $e, Request $request) {
            return response()->json([
                'error' => [
                    'code' => 'FORBIDDEN',
                    'message' => 'Akses ditolak.',
                ],
            ], 403);
        });

        $exceptions->render(function (NotFoundHttpException|ModelNotFoundException $e, Request $request) {
            $message = $e->getMessage() ?: 'Data tidak ditemukan.';

            return response()->json([
                'error' => [
                    'code' => 'NOT_FOUND',
                    'message' => $message,
                ],
            ], 404);
        });

        $exceptions->render(function (ThrottleRequestsException $e, Request $request) {
            return response()->json([
                'error' => [
                    'code' => 'RATE_LIMITED',
                    'message' => 'Terlalu banyak permintaan. Coba lagi nanti.',
                ],
            ], 429);
        });

        $exceptions->render(function (Throwable $e, Request $request) {
            $status = $e instanceof HttpExceptionInterface ? $e->getStatusCode() : 500;

            // Let Laravel's debug renderer handle server errors in local dev.
            if (config('app.debug') && $status >= 500) {
                return null;
            }

            return response()->json([
                'error' => [
                    'code' => $status >= 500 ? 'SERVER_ERROR' : 'REQUEST_ERROR',
                    'message' => $status >= 500
                        ? 'Terjadi kesalahan pada server.'
                        : ($e->getMessage() ?: 'Permintaan tidak dapat diproses.'),
                ],
            ], $status);
        });
    })->create();
