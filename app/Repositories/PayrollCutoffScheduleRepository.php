<?php

namespace App\Repositories;

use App\Models\PayrollCutoffSchedule;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

class PayrollCutoffScheduleRepository
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

    public function create(array $data): PayrollCutoffSchedule
    {
        return PayrollCutoffSchedule::create($data);
    }

    public function update(int $id, array $data): PayrollCutoffSchedule
    {
        $record = PayrollCutoffSchedule::findOrFail($id);
        $record->update($data);
        return $record->fresh();
    }

    public function delete(int $id): bool
    {
        return PayrollCutoffSchedule::findOrFail($id)->delete();
    }

    public function existsWithSameStart(string $dateStart, ?int $excludeId = null): bool
    {
        return PayrollCutoffSchedule::query()
            ->whereDate('payroll_date_start', $dateStart)
            ->when($excludeId, fn($q) => $q->where('ID', '!=', $excludeId))
            ->exists();
    }

    public function hasOverlap(string $dateStart, string $dateEnd, ?int $excludeId = null): bool
    {
        return PayrollCutoffSchedule::query()
            ->where(
                fn($q) => $q
                    ->whereDate('payroll_date_start', '<=', $dateEnd)
                    ->whereDate('payroll_date_end',   '>=', $dateStart)
            )
            ->when($excludeId, fn($q) => $q->where('ID', '!=', $excludeId))
            ->exists();
    }
}
