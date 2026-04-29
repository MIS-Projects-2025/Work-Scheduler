<?php

namespace App\Repositories;

use App\Models\Holiday;
use Illuminate\Support\Collection;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class HolidayRepository
{
    public function all(): Collection
    {
        return Holiday::orderBy('holiday_date', 'asc')->get();
    }

    public function findById(int $id): ?Holiday
    {
        return Holiday::find($id);
    }

    public function findByYear(int $year): Collection
    {
        return Holiday::whereYear('holiday_date', $year)
            ->orderBy('holiday_date', 'asc')
            ->get();
    }


    public function paginate(?int $year, string $search, int $perPage): LengthAwarePaginator
    {
        return Holiday::query()
            ->when($year, fn($q) => $q->whereYear('holiday_date', $year))
            ->when($search, fn($q) => $q->where(function ($q2) use ($search) {
                $q2->where('holiday_name', 'like', "%{$search}%")
                    ->orWhere('holiday_type', 'like', "%{$search}%")
                    ->orWhereRaw("DATE_FORMAT(holiday_date, '%Y-%m-%d') like ?", ["%{$search}%"]);
            }))
            ->orderBy('holiday_date', 'asc')
            ->paginate($perPage);
    }
    public function create(array $data): Holiday
    {
        return Holiday::create($data);
    }

    public function update(int $id, array $data): Holiday
    {
        $holiday = Holiday::findOrFail($id);
        $holiday->update($data);
        return $holiday->fresh();
    }

    public function delete(int $id): bool
    {
        return Holiday::findOrFail($id)->delete();
    }

    public function existsOnDate(string $date, ?int $excludeId = null): bool
    {
        $query = Holiday::whereDate('holiday_date', $date);

        if ($excludeId !== null) {
            $query->where('ID', '!=', $excludeId);
        }

        return $query->exists();
    }
}
