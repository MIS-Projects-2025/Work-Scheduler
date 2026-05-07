<?php

namespace App\Http;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;

class RateLimiters
{
    public static function register(): void
    {
        // Identity comes from the request — set by AuthMiddleware via setUserResolver.
        // Falls back to IP if the session hasn't been resolved yet (e.g. mid-login).
        $key = fn (Request $request): string =>
            (string) ($request->user()?->emp_id ?? $request->ip());

        // General API reads — 60 per minute per user.
        // Internal service calls (e.g. Authify login fetching employee data) carry
        // X-Internal-Key and must never be blocked by the IP fallback.
        RateLimiter::for('api-reads', function (Request $r) use ($key) {
            if ($r->header('X-Internal-Key') === config('services.internal.key')) {
                return Limit::none();
            }
            return Limit::perMinute(60)->by($key($r));
        });

        // Change request submissions — 20 per minute per user
        RateLimiter::for('cr-submit', fn (Request $r) =>
            Limit::perMinute(20)->by($key($r))
        );

        // HR approve / reject — 30 per minute per user
        RateLimiter::for('cr-review', fn (Request $r) =>
            Limit::perMinute(30)->by($key($r))
        );

        // Attachment uploads — 10 per minute per user (file I/O is expensive)
        RateLimiter::for('cr-upload', fn (Request $r) =>
            Limit::perMinute(10)->by($key($r))
        );
    }
}
