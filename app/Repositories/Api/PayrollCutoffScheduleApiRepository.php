<?php

namespace App\Repositories\Api;

use App\Models\PayrollCutoffSchedule;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

class PayrollCutoffScheduleApiRepository
{
    public function paginate(?int $year, string $search, int $perPage): LengthAwarePaginator
    {
        return PayrollCutoffSchedule::query()
            ->when($year, fn($q) => $q->whereYear('payroll_date_start', $year))
            ->when($search, fn($q) => $q->where(function ($q2) use ($search) {
                $q2->whereRaw("DATE_FORMAT(payroll_date_start, '%Y-%m-%d') LIKE ?", ["%{$search}%"])
                    ->orWhereRaw("DATE_FORMAT(payroll_date_end, '%Y-%m-%d') LIKE ?", ["%{$search}%"]);
            }))
            ->orderBy('payroll_date_start', 'desc')
            ->paginate($perPage);
    }

    public function all(): Collection
    {
        return PayrollCutoffSchedule::orderBy('payroll_date_start', 'desc')->get();
    }

    public function findById(int $id): ?PayrollCutoffSchedule
    {
        return PayrollCutoffSchedule::find($id);
    }
}
