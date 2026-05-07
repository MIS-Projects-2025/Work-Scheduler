<?php

use App\Http\Controllers\DemoController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

$app_name = env('APP_NAME', '');

// Authentication routes
require __DIR__ . '/auth.php';

// General routes
require __DIR__ . '/general.php';

// Work schedule routes
require __DIR__ . '/worksched.php';

// Admin routes
require __DIR__ . '/admin.php';

Route::get("/demo", [DemoController::class, 'index'])->name('demo');

// API routes — loaded before fallback so they are matched first
Route::prefix('api')->group(function () {
    require __DIR__ . '/api.php';
});

Route::fallback(function () {
    return Inertia::render('404');
})->name('404');
