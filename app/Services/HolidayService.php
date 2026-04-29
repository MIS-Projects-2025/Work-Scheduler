<?php

namespace App\Services;

use App\Models\Holiday;
use App\Repositories\HolidayRepository;
use Illuminate\Support\Collection;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class HolidayService
{
    public function __construct(
        private HolidayRepository $repository
    ) {}

    public function getAll(): Collection
    {
        return $this->repository->all();
    }

    public function getByYear(int $year): Collection
    {
        return $this->repository->findByYear($year);
    }

    public function getById(int $id): ?Holiday
    {
        return $this->repository->findById($id);
    }


    public function paginate(?int $year, string $search, int $perPage): LengthAwarePaginator
    {
        return $this->repository->paginate($year, $search, $perPage);
    }
    public function create(array $data, int $createdBy): Holiday
    {
        $this->validateDate($data['holiday_date']);

        if ($this->repository->existsOnDate($data['holiday_date'])) {
            throw new \InvalidArgumentException("A holiday already exists on {$data['holiday_date']}.");
        }

        return $this->repository->create([
            'holiday_name' => $data['holiday_name'],
            'holiday_date' => $data['holiday_date'],
            'holiday_type' => $data['holiday_type'],
            'color'        => $data['color'] ?? '#FF5733',
            'created_by'   => $createdBy,
            'created_at'   => now(),
        ]);
    }

    public function update(int $id, array $data): Holiday
    {
        $this->validateDate($data['holiday_date']);

        if ($this->repository->existsOnDate($data['holiday_date'], $id)) {
            throw new \InvalidArgumentException("Another holiday already exists on {$data['holiday_date']}.");
        }

        return $this->repository->update($id, [
            'holiday_name' => $data['holiday_name'],
            'holiday_date' => $data['holiday_date'],
            'holiday_type' => $data['holiday_type'],
            'color'        => $data['color'] ?? '#FF5733',
        ]);
    }

    public function delete(int $id): bool
    {
        return $this->repository->delete($id);
    }

    /**
     * Used by WorkScheduleTemplateExport to get holidays within a cutoff range.
     */
    public function getForCutoff(string $dateStart, string $dateEnd): Collection
    {
        return Holiday::whereBetween('holiday_date', [$dateStart, $dateEnd])
            ->orderBy('holiday_date')
            ->get();
    }

    private function validateDate(string $date): void
    {
        if (!\DateTime::createFromFormat('Y-m-d', $date)) {
            throw new \InvalidArgumentException("Invalid date format: {$date}. Expected Y-m-d.");
        }
    }
}
