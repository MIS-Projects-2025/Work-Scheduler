<?php

namespace App\Services;

use App\Repositories\WorkScheduleRepository;
use Illuminate\Pagination\LengthAwarePaginator;

class WorkScheduleService
{
    private array $nameCache = [];

    public function __construct(
        private readonly WorkScheduleRepository $repo,
        private readonly HrisApiService         $hris,
    ) {}

    // -------------------------------------------------------------------------
    // Shared helpers
    // -------------------------------------------------------------------------

    public function getShiftCodesForManager(string $empId): array
    {
        $prodLine = $this->hris->fetchWorkDetails($empId)['prod_line'] ?? null;
        return $this->repo->getFilteredShiftCodes($prodLine);
    }

    // -------------------------------------------------------------------------
    // Template page
    // -------------------------------------------------------------------------

    public function getTemplatePageData(string $empId): array
    {
        return [
            'cutoffList' => $this->repo->getRecentCutoffs(24),
            'shifts'     => $this->getShiftCodesForManager($empId),
        ];
    }

    // -------------------------------------------------------------------------
    // Download template
    // -------------------------------------------------------------------------

    public function getDownloadContext(string $empId, int $cutoffId): array
    {
        $cutoff        = $this->repo->findCutoff($cutoffId);
        $prodLine      = $this->hris->fetchWorkDetails($empId)['prod_line'] ?? null;
        $directReports = $this->hris->fetchDirectReports($empId);
        $employeeIds   = array_column($directReports, 'emp_id');

        $dateFrom = date('Ymd', strtotime($cutoff->payroll_date_start));
        $dateTo   = date('Ymd', strtotime($cutoff->payroll_date_end));
        $filename = "schedule_template_{$dateFrom}_to_{$dateTo}_{$empId}.xlsx";

        return compact('cutoff', 'employeeIds', 'prodLine', 'filename', 'cutoffId');
    }

    // -------------------------------------------------------------------------
    // Index / listing page with server-side pagination
    // -------------------------------------------------------------------------

    /**
     * Get paginated data for the index page.
     * 
     * @param bool $withTabCounts Pass true only on the initial full-page load
     */
    public function getIndexData(
        string $empId,
        int    $empPosition,
        int    $status,
        string $search,
        string $orderBy,
        string $orderDir,
        int    $perPage,
        int    $page,
        bool   $withTabCounts = false
    ): array {
        // Get paginator from repository
        $paginator = $this->repo->getPaginatedGroups(
            $empId,
            $status,
            $empPosition,
            $search,
            $orderBy,
            $orderDir,
            $perPage,
            $page
        );

        // Transform the items to add created_by_name and status_label
        // Convert Eloquent models to arrays and enrich them
        $enrichedItems = collect($paginator->items())->map(function ($item) {
            // Convert model to array if it's an Eloquent model
            $row = $item instanceof \Illuminate\Database\Eloquent\Model ? $item->toArray() : (array) $item;

            return array_merge($row, [
                'created_by_name' => $this->getCreatorName($row['created_by']),
                'status_label'    => $this->statusLabel((int) $row['work_sched_status']),
            ]);
        });

        // Create a new paginator instance with enriched items
        $enrichedPaginator = new LengthAwarePaginator(
            $enrichedItems,
            $paginator->total(),
            $paginator->perPage(),
            $paginator->currentPage(),
            ['path' => LengthAwarePaginator::resolveCurrentPath()]
        );

        $result = [
            'paginator' => $enrichedPaginator,
            'tabCounts' => [],
        ];

        // Only run the 5 COUNT queries when the full page is being rendered
        if ($withTabCounts) {
            $result['tabCounts'] = $this->repo->countAllStatuses($empId, $empPosition);
        }

        return $result;
    }

    /**
     * Get creator name with caching to avoid repeated API calls
     */
    private function getCreatorName(string $creatorId): string
    {
        if (!isset($this->nameCache[$creatorId])) {
            $this->nameCache[$creatorId] = $this->hris->fetchWorkDetails($creatorId)['emp_name'] ?? $creatorId;
        }

        return $this->nameCache[$creatorId];
    }

    // -------------------------------------------------------------------------
    // View / detail page
    // -------------------------------------------------------------------------

    public function getViewData(
        string $managerEmpId,
        string $createdBy,
        string $dateStart,
        string $dateEnd
    ): array {
        $shiftCodes = $this->getShiftCodesForManager($managerEmpId);
        $schedules  = $this->repo->getSchedulesByGroup($createdBy, $dateStart, $dateEnd);

        $employeeIds    = $schedules->pluck('emp_id')->toArray();
        $employees      = $this->hris->fetchEmployeesBulk($employeeIds);
        $workDetailsMap = [];
        foreach ($employeeIds as $id) {
            $workDetailsMap[$id] = $this->hris->fetchWorkDetails($id);
        }

        $daysInPeriod  = $this->buildDateRange($dateStart, $dateEnd);
        $staticHeaders = ['Emp ID', 'Employee Name', 'Department', 'Production Line', 'Team', 'Shift Type'];
        $dayHeaders    = array_map(function (string $date) {
            $d = new \DateTime($date);
            return $d->format('d-M') . ' ' . strtoupper(substr($d->format('l'), 0, 3));
        }, $daysInPeriod);

        $headers = array_merge($staticHeaders, $dayHeaders);

        $rows = $schedules->map(function ($schedule) use ($employees, $workDetailsMap, $daysInPeriod) {
            $daysMap = [];
            foreach ($schedule->days as $day) {
                $daysMap[$day->work_date] = $day->shiftCode?->shiftcode ?? '';
            }

            $empData  = $employees[$schedule->emp_id] ?? [];
            $workData = $workDetailsMap[$schedule->emp_id] ?? [];

            $row = [
                $schedule->emp_id,
                $empData['emp_name']    ?? '',
                $empData['department']  ?? '',
                $empData['prodline']    ?? '',
                $workData['team']       ?? '',
                $workData['shift_type'] ?? '',
            ];

            foreach ($daysInPeriod as $date) {
                $row[] = $daysMap[$date] ?? '';
            }

            return $row;
        })->values()->all();

        return [
            'groupedData' => [[
                'created_by'         => $createdBy,
                'payroll_date_start' => $dateStart,
                'payroll_date_end'   => $dateEnd,
                'headers'            => $headers,
                'staticHeaders'      => $staticHeaders,
                'schedules'          => $rows,
            ]],
            'shiftCodes'  => $shiftCodes,
            'dateStart'   => $dateStart,
            'dateEnd'     => $dateEnd,
        ];
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private function buildDateRange(string $start, string $end): array
    {
        $days = [];
        $cur  = strtotime($start);
        $end  = strtotime($end);
        while ($cur <= $end) {
            $days[] = date('Y-m-d', $cur);
            $cur    = strtotime('+1 day', $cur);
        }
        return $days;
    }

    public function statusLabel(int $status): string
    {
        return match ($status) {
            0       => 'Draft',
            1       => 'For Approval',
            2       => 'To Acknowledge',
            3       => 'Acknowledged',
            4       => 'Disapproved',
            default => 'Unknown',
        };
    }

    public function statusVariant(int $status): string
    {
        return match ($status) {
            0       => 'secondary',
            1       => 'warning',
            2       => 'info',
            3       => 'success',
            4       => 'destructive',
            default => 'outline',
        };
    }
}
