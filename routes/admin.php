<?php

use App\Http\Controllers\HolidayController;
use Illuminate\Support\Facades\Route;



Route::get('/admin/holidays',  [HolidayController::class, 'page'])->name('holidays.page');

Route::prefix('holidays')->name('holidays.')->group(function () {
    Route::get('/',        [HolidayController::class, 'index'])->name('index');
    Route::get('/{id}',    [HolidayController::class, 'show'])->name('show');
    Route::post('/',       [HolidayController::class, 'store'])->name('store');
    Route::put('/{id}',    [HolidayController::class, 'update'])->name('update');
    Route::delete('/{id}', [HolidayController::class, 'destroy'])->name('destroy');
});
