<?php

namespace App\Services;

use App\Models\PayrollCutoffSchedule;
use App\Repositories\PayrollCutoffScheduleRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class PayrollCutoffScheduleService
{
    public function __construct(
        private PayrollCutoffScheduleRepository $repository
    ) {}

    public function paginate(?int $year, string $search, int $perPage): LengthAwarePaginator
    {
        return $this->repository->paginate($year, $search, $perPage);
    }

    public function getById(int $id): ?PayrollCutoffSchedule
    {
        return $this->repository->findById($id);
    }

    public function create(array $data, int $createdBy): PayrollCutoffSchedule
    {
        $this->validateDates($data['payroll_date_start'], $data['payroll_date_end']);
        $this->checkDuplicateStart($data['payroll_date_start']);
        $this->checkOverlap($data['payroll_date_start'], $data['payroll_date_end']);

        return $this->repository->create([
            'payroll_date_start' => $data['payroll_date_start'],
            'payroll_date_end'   => $data['payroll_date_end'],
            'created_by'         => $createdBy,
        ]);
    }

    public function update(int $id, array $data): PayrollCutoffSchedule
    {
        $this->validateDates($data['payroll_date_start'], $data['payroll_date_end']);
        $this->checkDuplicateStart($data['payroll_date_start'], $id);
        $this->checkOverlap($data['payroll_date_start'], $data['payroll_date_end'], $id);

        return $this->repository->update($id, [
            'payroll_date_start' => $data['payroll_date_start'],
            'payroll_date_end'   => $data['payroll_date_end'],
        ]);
    }

    public function delete(int $id): bool
    {
        return $this->repository->delete($id);
    }

    private function validateDates(string $start, string $end): void
    {
        if ($end <= $start) {
            throw new \InvalidArgumentException('End date must be after the start date.');
        }
    }

    private function checkDuplicateStart(string $dateStart, ?int $excludeId = null): void
    {
        if ($this->repository->existsWithSameStart($dateStart, $excludeId)) {
            throw new \InvalidArgumentException("A cutoff schedule already starts on {$dateStart}.");
        }
    }

    private function checkOverlap(string $dateStart, string $dateEnd, ?int $excludeId = null): void
    {
        if ($this->repository->hasOverlap($dateStart, $dateEnd, $excludeId)) {
            throw new \InvalidArgumentException('This date range overlaps with an existing cutoff schedule.');
        }
    }
}
