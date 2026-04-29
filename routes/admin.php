<?php

use App\Http\Controllers\HolidayController;
use App\Http\Controllers\PayrollCutoffScheduleController;
use Illuminate\Support\Facades\Route;



Route::get('/admin/holidays',  [HolidayController::class, 'page'])->name('holidays.page');

Route::prefix('holidays')->name('holidays.')->group(function () {
    Route::get('/',        [HolidayController::class, 'index'])->name('index');
    Route::get('/{id}',    [HolidayController::class, 'show'])->name('show');
    Route::post('/',       [HolidayController::class, 'store'])->name('store');
    Route::put('/{id}',    [HolidayController::class, 'update'])->name('update');
    Route::delete('/{id}', [HolidayController::class, 'destroy'])->name('destroy');
});

Route::get('/admin/payroll-cutoff-schedules', [PayrollCutoffScheduleController::class, 'page'])->name('payroll-cutoff-schedules.page');
Route::prefix('payroll-cutoff-schedules')->name('payroll-cutoff-schedules.')->group(function () {
    Route::get('/',        [PayrollCutoffScheduleController::class, 'index'])->name('index');
    Route::get('/{id}',    [PayrollCutoffScheduleController::class, 'show'])->name('show');
    Route::post('/',       [PayrollCutoffScheduleController::class, 'store'])->name('store');
    Route::put('/{id}',    [PayrollCutoffScheduleController::class, 'update'])->name('update');
    Route::delete('/{id}', [PayrollCutoffScheduleController::class, 'destroy'])->name('destroy');
});
