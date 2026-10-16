<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Tight limit on credential endpoints to slow down brute force attempts.
        RateLimiter::for('auth', function (Request $request) {
            return Limit::perMinute(10)->by(Str::transliterate(
                Str::lower($request->string('email')).'|'.$request->ip()
            ));
        });

        // Generous per-user limit on the authenticated API. High enough that an
        // offline-queue flush or quick POS selling never trips it, but low enough
        // to contain a runaway client.
        RateLimiter::for('api', function (Request $request) {
            return $request->user()
                ? Limit::perMinute(120)->by('user:'.$request->user()->getKey())
                : Limit::perMinute(30)->by('ip:'.$request->ip());
        });
    }
}
