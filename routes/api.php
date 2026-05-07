<?php

use App\Http\Controllers\Api\PayrollCutoffScheduleApiController;
use App\Http\Middleware\ApiAuthMiddleware;
use Illuminate\Support\Facades\Route;

Route::middleware([ApiAuthMiddleware::class, 'throttle:api-reads'])->group(function () {
    Route::prefix('payroll-cutoff-schedules')->name('api.payroll-cutoff-schedules.')->group(function () {
        Route::get('/',      [PayrollCutoffScheduleApiController::class, 'index'])->name('index');
        Route::get('/{id}',  [PayrollCutoffScheduleApiController::class, 'show'])->name('show');
    });
});
