<?php

namespace App\Services\Api;

use App\Models\PayrollCutoffSchedule;
use App\Repositories\Api\PayrollCutoffScheduleApiRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

class PayrollCutoffScheduleApiService
{
    public function __construct(
        private PayrollCutoffScheduleApiRepository $repository
    ) {}

    public function paginate(?int $year, string $search, int $perPage): LengthAwarePaginator
    {
        return $this->repository->paginate($year, $search, $perPage);
    }

    public function all(): Collection
    {
        return $this->repository->all();
    }

    public function getById(int $id): ?PayrollCutoffSchedule
    {
        return $this->repository->findById($id);
    }
}
