<?php

namespace App\Services;

use App\Models\PayrollCutoffSchedule;
use App\Models\WorkSchedule;
use App\Repositories\WorkScheduleRepository;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

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

    public function getShiftCodesForManager(?string $prodLine): Collection
    {
        return $this->repo->getFilteredShiftCodes($prodLine);
    }
    // -------------------------------------------------------------------------
    // Template page
    // -------------------------------------------------------------------------

    public function getTemplatePageData(string $empId): array
    {
        $directReports = $this->hris->fetchDirectReports($empId);

        return [
            'cutoffList' => $this->repo->getRecentCutoffs(24),
            'shifts'     => $this->getShiftCodesForManager($empId),
            'employees'  => $directReports,
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

        $holidays = $this->repo->getHolidaysForPeriod(
            $cutoff->payroll_date_start,
            $cutoff->payroll_date_end
        );

        return compact('cutoff', 'employeeIds', 'prodLine', 'filename', 'cutoffId', 'holidays');
    }

    // -------------------------------------------------------------------------
    // Index / listing page with server-side pagination
    // -------------------------------------------------------------------------

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

        $enrichedPaginator = $this->enrichPaginator($paginator);

        $result = [
            'paginator' => $enrichedPaginator,
            'tabCounts' => [],
        ];

        if ($withTabCounts) {
            $result['tabCounts'] = $this->repo->countAllStatuses($empId, $empPosition);
        }

        return $result;
    }

    // -------------------------------------------------------------------------
    // HR Admin index — all records, no access-scope restriction
    // -------------------------------------------------------------------------

    public function getHrIndexData(
        int    $status,
        string $search,
        string $orderBy,
        string $orderDir,
        int    $perPage,
        int    $page,
        bool   $withTabCounts = false
    ): array {
        $paginator = $this->repo->getPaginatedGroupsForHr(
            $status,
            $search,
            $orderBy,
            $orderDir,
            $perPage,
            $page
        );

        // HR rows are grouped by cutoff only (no created_by), so no name enrichment needed.
        $result = [
            'paginator' => $paginator,
            'tabCounts' => [],
        ];

        if ($withTabCounts) {
            $result['tabCounts'] = $this->repo->countAllStatusesForHr();
        }

        return $result;
    }

    // -------------------------------------------------------------------------
    // HR Admin view — all employees for a cutoff, regardless of creator
    // -------------------------------------------------------------------------

    public function getHrViewData(
        string $dateStart,
        string $dateEnd,
        int    $perPage,
        int    $page,
        string $search,
        int    $status
    ): array {
        $shiftCodes   = $this->repo->getAllActiveShiftCodes();
        $holidayItems = $this->repo->getHolidaysForPeriod($dateStart, $dateEnd);

        $schedulesQuery = $this->repo->getSchedulesByGroupQueryForHr($dateStart, $dateEnd, $status);

        if (!empty($search)) {
            $schedulesQuery->where('emp_id', 'like', "%{$search}%");
        }

        $paginatedSchedules = $schedulesQuery->paginate($perPage, ['*'], 'page', $page);

        $employeeIds = $paginatedSchedules->pluck('emp_id')->toArray();
        $employees   = $this->hris->fetchEmployeesBulk($employeeIds);

        $daysInPeriod  = $this->buildDateRange($dateStart, $dateEnd);
        $staticHeaders = ['Emp ID', 'Employee Name', 'Department', 'Production Line', 'Team', 'Shift Type'];

        $dateHeaders = array_map(fn($d) => (new \DateTime($d))->format('d-M'), $daysInPeriod);
        $dayHeaders  = array_map(fn($d) => strtoupper(substr((new \DateTime($d))->format('l'), 0, 3)), $daysInPeriod);

        $firstRowHeaders  = array_merge($staticHeaders, $dateHeaders);
        $secondRowHeaders = array_merge(array_fill(0, count($staticHeaders), ''), $dayHeaders);

        $scheduleIds = [];
        $rows        = [];

        foreach ($paginatedSchedules->items() as $schedule) {
            $daysMap = [];
            foreach ($schedule->days as $day) {
                $daysMap[$day->work_date] = $day->shiftCode?->shiftcode ?? '';
            }

            $empData = $employees[$schedule->emp_id] ?? [];

            $row = [
                $schedule->emp_id,
                $empData['emp_name']   ?? '',
                $empData['department'] ?? '',
                $empData['prodline']   ?? '',
                $empData['team']       ?? '',
                $empData['shift']      ?? '',
            ];

            foreach ($daysInPeriod as $date) {
                $row[] = $daysMap[$date] ?? '';
            }

            $scheduleIds[] = $schedule->id;
            $rows[]        = $row;
        }

        $paginationMeta = [
            'currentPage' => $paginatedSchedules->currentPage(),
            'lastPage'    => $paginatedSchedules->lastPage(),
            'perPage'     => $paginatedSchedules->perPage(),
            'total'       => $paginatedSchedules->total(),
            'from'        => $paginatedSchedules->firstItem(),
            'to'          => $paginatedSchedules->lastItem(),
        ];

        $holidays = $holidayItems->map(fn($h) => [
            'date'  => $h->holiday_date instanceof \Carbon\Carbon ? $h->holiday_date->format('Y-m-d') : (string) $h->holiday_date,
            'name'  => $h->holiday_name,
            'type'  => $h->holiday_type,
            'color' => $h->color ?? '#FF5733',
        ])->values()->toArray();

        return [
            'groupedData' => [[
                'created_by'         => null,
                'payroll_date_start' => $dateStart,
                'payroll_date_end'   => $dateEnd,
                'headers'            => $firstRowHeaders,
                'subHeaders'         => $secondRowHeaders,
                'staticHeaders'      => $staticHeaders,
                'dateHeaders'        => $dateHeaders,
                'dayHeaders'         => $dayHeaders,
                'schedules'          => $rows,
                'scheduleIds'        => $scheduleIds,
            ]],
            'shiftCodes'    => $shiftCodes,
            'dateStart'     => $dateStart,
            'dateEnd'       => $dateEnd,
            'pagination'    => $paginationMeta,
            'filters'       => [
                'search'  => $search,
                'perPage' => $perPage,
                'status'  => $status,
            ],
            'viewerContext' => [
                'isCreator'   => false,
                'isApprover'  => false,
                'isOwnRecord' => false,
                'canApprove'  => false,
                'isHrAdmin'   => true,
                'status'      => $status,
                'empId'       => null,
            ],
            'holidays' => $holidays,
        ];
    }

    // -------------------------------------------------------------------------
    // Shared enrichment
    // -------------------------------------------------------------------------

    /**
     * Bulk-resolve creator names and return a new LengthAwarePaginator
     * with `created_by_name` added to every row.
     */
    private function enrichPaginator(LengthAwarePaginator $paginator): LengthAwarePaginator
    {
        $items = collect($paginator->items());

        $this->warmNameCache($items->pluck('created_by')->unique()->values()->all());

        $enriched = $items->map(function ($item) {
            $row = $item instanceof \Illuminate\Database\Eloquent\Model ? $item->toArray() : (array) $item;
            return array_merge($row, [
                'created_by_name' => $this->getCreatorName($row['created_by']),
            ]);
        });

        return new LengthAwarePaginator(
            $enriched,
            $paginator->total(),
            $paginator->perPage(),
            $paginator->currentPage(),
            ['path' => LengthAwarePaginator::resolveCurrentPath()]
        );
    }

    private function warmNameCache(array $ids): void
    {
        $uncached = array_values(array_filter(
            $ids,
            fn($id) => !isset($this->nameCache[$id])
        ));

        if (empty($uncached)) {
            return;
        }

        $map = $this->hris->fetchEmployeeNamesBulk($uncached);

        foreach ($uncached as $id) {
            // Store fallback (the raw ID) for any IDs HRIS didn't return
            $this->nameCache[$id] = $map[$id] ?? $id;
        }
    }

    private function getCreatorName(string $creatorId): string
    {
        return $this->nameCache[$creatorId] ?? $creatorId;
    }

    /**
     * Submit schedules from template
     */
    public function submitSchedules(array $data, string $createdBy): array
    {
        $cutoff = $this->getCutoffById((int) $data['cutoff_id']);
        if (!$cutoff) {
            return [
                'status' => 'error',
                'error' => 'Invalid cutoff period'
            ];
        }

        $dateStart = $cutoff->payroll_date_start;
        $dateEnd = $cutoff->payroll_date_end;

        $saved = [];
        $errors = [];
        $overwritten = [];
        $blocked = [];

        foreach ($data['employees'] as $employeeData) {
            try {
                $empId = $employeeData['empId'];
                $supervisorId = $employeeData['supervisorId'] ?? $createdBy;
                $approver2Id = $employeeData['approver2Id'] ?? null;

                $existingSchedule = $this->repo->findScheduleByEmployeeAndCutoff(
                    $empId,
                    $dateStart,
                    $dateEnd
                );

                /**
                 * =========================================
                 * CASE 1: EXISTING SCHEDULE
                 * =========================================
                 */
                if ($existingSchedule) {

                    $status = (int) $existingSchedule->work_sched_status;

                    // ❌ BLOCK IF NOT DRAFT (STATUS != 1)
                    if ($status !== 1) {

                        $statusLabel = match ($status) {
                            2 => 'Approved',
                            3 => 'Aknowledged',
                            4 => 'Disapproved',
                            default => 'Locked'
                        };

                        $blocked[] = [
                            'empId' => $empId,
                            'status' => $status,
                            'reason' => "{$statusLabel} schedule cannot be overwritten"
                        ];

                        continue;
                    }

                    // ✅ OVERWRITE ONLY IF STATUS = 1
                    $scheduleDays = $this->buildScheduleDaysData(
                        $existingSchedule->id,
                        $employeeData['schedule'],
                        $dateStart
                    );

                    $this->repo->updateScheduleWithDays(
                        $existingSchedule,
                        [
                            'supervisor_id' => $supervisorId,
                            'approver2_id' => $approver2Id,
                            'date_updated' => now(),
                        ],
                        $scheduleDays
                    );

                    $overwritten[] = $empId;
                }

                /**
                 * =========================================
                 * CASE 2: NEW SCHEDULE
                 * =========================================
                 */
                else {
                    $scheduleDays = $this->buildScheduleDaysData(
                        null,
                        $employeeData['schedule'],
                        $dateStart
                    );

                    $this->repo->createScheduleWithDays([
                        'emp_id' => $empId,
                        'payroll_date_start' => $dateStart,
                        'payroll_date_end' => $dateEnd,
                        'work_sched_status' => WorkSchedule::STATUS_PENDING_APPROVAL,
                        'supervisor_id' => $supervisorId,
                        'approver2_id' => $approver2Id,
                        'created_by' => $createdBy,
                        'date_created' => now(),
                    ], $scheduleDays);
                }

                $saved[] = $empId;
            } catch (\Exception $e) {
                Log::error("Failed to save schedule for employee {$employeeData['empId']}: " . $e->getMessage());

                $errors[] = [
                    'empId' => $employeeData['empId'],
                    'error' => $e->getMessage()
                ];
            }
        }

        /**
         * =========================================
         * RESPONSE BUILDING
         * =========================================
         */
        $response = [
            'status' => 'success',
            'saved' => $saved,
            'message' => count($saved) . ' schedules submitted successfully'
        ];

        if (!empty($overwritten)) {
            $response['overwritten'] = $overwritten;
            $response['message'] = count($saved) . ' saved (' . count($overwritten) . ' overwritten)';
        }

        if (!empty($blocked)) {
            $response['blocked'] = $blocked;
            $response['status'] = 'warning';
            $response['message'] = count($saved) . ' saved, ' . count($blocked) . ' blocked (approved schedules cannot be overwritten)';
        }

        if (!empty($errors)) {
            $response['errors'] = $errors;
            $response['status'] = 'warning';
            $response['message'] = count($saved) . ' saved, ' . count($errors) . ' failed';
        }

        return $response;
    }

    /**
     * Build schedule days data array
     */
    private function buildScheduleDaysData(?int $workScheduleId, array $schedule, string $dateStart): array
    {
        $daysToCreate = [];
        foreach ($schedule as $dayNumber => $shiftCodeId) {
            $daysToAdd = (int) $dayNumber - 1;
            $workDate = date('Y-m-d', strtotime($dateStart . " +{$daysToAdd} days"));

            $dayData = [
                'work_date' => $workDate,
                'schedule_code' => $shiftCodeId,
            ];

            if ($workScheduleId) {
                $dayData['work_schedule_id'] = $workScheduleId;
            }

            $daysToCreate[] = $dayData;
        }

        return $daysToCreate;
    }


    /**
     * Get cutoff by ID
     */
    public function getCutoffById(int $cutoffId): ?PayrollCutoffSchedule
    {
        return $this->repo->findCutoff($cutoffId);
    }
    // -------------------------------------------------------------------------
    // View / detail page
    // -------------------------------------------------------------------------
    public function getViewData(
        string $managerEmpId,
        string $createdBy,
        string $dateStart,
        string $dateEnd,
        int $perPage = 20,
        int $page = 1,
        string $search = '',
        int $status
    ): array {
        $shiftCodes = $this->getShiftCodesForManager($managerEmpId);
        $holidayItems = $this->repo->getHolidaysForPeriod($dateStart, $dateEnd);

        // Get paginated schedules
        $schedulesQuery = $this->repo->getSchedulesByGroupQuery($createdBy, $dateStart, $dateEnd, $status, $managerEmpId);

        // Apply search filter if needed
        if (!empty($search)) {
            $schedulesQuery->where(function ($q) use ($search) {
                $q->where('emp_id', 'like', "%{$search}%")
                    ->orWhereHas('employee', function ($q2) use ($search) {
                        $q2->where('emp_name', 'like', "%{$search}%");
                    });
            });
        }

        // Paginate
        $paginatedSchedules = $schedulesQuery->paginate($perPage, ['*'], 'page', $page);

        // Get all employee IDs from paginated results
        $employeeIds = $paginatedSchedules->pluck('emp_id')->toArray();
        $employees = $this->hris->fetchEmployeesBulk($employeeIds);

        $daysInPeriod = $this->buildDateRange($dateStart, $dateEnd);
        $staticHeaders = ['Emp ID', 'Employee Name', 'Department', 'Production Line', 'Team', 'Shift Type'];

        // First row: dates (15-Jan, 16-Jan, etc.)
        $dateHeaders = array_map(function (string $date) {
            return (new \DateTime($date))->format('d-M');
        }, $daysInPeriod);

        // Second row: day names (MON, TUE, WED, etc.)
        $dayHeaders = array_map(function (string $date) {
            return strtoupper(substr((new \DateTime($date))->format('l'), 0, 3));
        }, $daysInPeriod);

        // Combine static headers with date headers for the first row
        $firstRowHeaders = array_merge($staticHeaders, $dateHeaders);

        // Create second row with empty strings for static columns, then day names
        $secondRowHeaders = array_merge(
            array_fill(0, count($staticHeaders), ''),
            $dayHeaders
        );

        // Build rows from paginated data.
        // scheduleIds maps rowIndex → WorkSchedule.id so the frontend can send
        // work_schedule_id directly when saving cell edits (avoids an emp_id lookup).
        $scheduleIds = [];
        $rows        = [];

        foreach ($paginatedSchedules->items() as $schedule) {
            $daysMap = [];
            foreach ($schedule->days as $day) {
                $daysMap[$day->work_date] = $day->shiftCode?->shiftcode ?? '';
            }

            $empData = $employees[$schedule->emp_id] ?? [];

            $row = [
                $schedule->emp_id,
                $empData['emp_name']   ?? '',
                $empData['department'] ?? '',
                $empData['prodline']   ?? '',
                $empData['team']       ?? '',
                $empData['shift']      ?? '',
            ];

            foreach ($daysInPeriod as $date) {
                $row[] = $daysMap[$date] ?? '';
            }

            $scheduleIds[] = $schedule->id;
            $rows[]        = $row;
        }

        // Prepare pagination meta
        $paginationMeta = [
            'currentPage' => $paginatedSchedules->currentPage(),
            'lastPage'    => $paginatedSchedules->lastPage(),
            'perPage'     => $paginatedSchedules->perPage(),
            'total'       => $paginatedSchedules->total(),
            'from'        => $paginatedSchedules->firstItem(),
            'to'          => $paginatedSchedules->lastItem(),
        ];

        $isCreator  = $managerEmpId === $createdBy;
        $isApprover = \App\Models\WorkSchedule::where('payroll_date_start', $dateStart)
            ->where('payroll_date_end', $dateEnd)
            ->where('created_by', $createdBy)
            ->where('approver2_id', $managerEmpId)
            ->exists();

        $isOwnRecord = !$isCreator && !$isApprover;
        $canApprove  = ($isApprover && $status === 1);

        $holidays = $holidayItems->map(fn($h) => [
            'date'  => $h->holiday_date instanceof \Carbon\Carbon ? $h->holiday_date->format('Y-m-d') : (string) $h->holiday_date,
            'name'  => $h->holiday_name,
            'type'  => $h->holiday_type,
            'color' => $h->color ?? '#FF5733',
        ])->values()->toArray();

        return [
            'groupedData' => [[
                'created_by'         => $createdBy,
                'payroll_date_start' => $dateStart,
                'payroll_date_end'   => $dateEnd,
                'headers'            => $firstRowHeaders,
                'subHeaders'         => $secondRowHeaders,
                'staticHeaders'      => $staticHeaders,
                'dateHeaders'        => $dateHeaders,
                'dayHeaders'         => $dayHeaders,
                'schedules'          => $rows,
                'scheduleIds'        => $scheduleIds,
            ]],
            'shiftCodes'    => $shiftCodes,
            'dateStart'     => $dateStart,
            'dateEnd'       => $dateEnd,
            'pagination'    => $paginationMeta,
            'filters'       => [
                'search'  => $search,
                'perPage' => $perPage,
                'status'  => $status,
            ],
            'viewerContext' => [
                'isCreator'   => $isCreator,
                'isApprover'  => $isApprover,
                'isOwnRecord' => $isOwnRecord,
                'canApprove'  => $canApprove,
                'status'      => $status,
                'empId'       => $managerEmpId,
            ],
            'holidays' => $holidays,
        ];
    }
    // -------------------------------------------------------------------------
    // Cell-level edits (view page, status=1)
    // -------------------------------------------------------------------------

    /**
     * Persist individual cell edits submitted from the View page.
     *
     * Each change: { emp_id, work_date, shift_code_id }
     * shift_code_id is the PK from shift_codes (resolved on the frontend via shiftMap).
     */
    public function saveScheduleEdits(
        string $dateStart,
        string $dateEnd,
        array  $changes
    ): array {
        $saved  = 0;
        $errors = [];

        foreach ($changes as $change) {
            try {
                $this->repo->updateScheduleDay(
                    (int)    $change['work_schedule_id'],
                    (string) $change['work_date'],
                    isset($change['shift_code_id']) ? (int) $change['shift_code_id'] : null
                );
                $saved++;
            } catch (\Exception $e) {
                Log::error('saveScheduleEdits: ' . $e->getMessage(), $change);
                $errors[] = "Schedule {$change['work_schedule_id']} / {$change['work_date']}: {$e->getMessage()}";
            }
        }

        return ['saved' => $saved, 'errors' => $errors];
    }

    public function acknowledge($empId, $createdBy, $dateStart, $dateEnd)
    {
        return $this->repo->updateAcknowledge(
            $empId,
            $createdBy,
            $dateStart,
            $dateEnd
        );
    }
    public function updateStatus(
        $approverId,
        $createdBy,
        $dateStart,
        $dateEnd,
        $status,
        $empIds = [],
        $remarks = null
    ) {
        $updated = $this->repo->bulkUpdateStatus(
            $approverId,
            $createdBy,
            $dateStart,
            $dateEnd,
            $status,
            $empIds,
            $remarks
        );

        if ($updated === 0) {
            throw new \Exception('No records updated.');
        }

        return $updated;
    }


    public function getRemarksHistoryForHr(string $dateStart, string $dateEnd): array
    {
        // Add debug logging
        Log::info('Fetching remarks history for HR', [
            'date_start' => $dateStart,
            'date_end' => $dateEnd
        ]);

        $schedules = $this->repo->getWorkSchedulesWithRemarksHistory($dateStart, $dateEnd);

        Log::info('Schedules found', [
            'count' => $schedules->count(),
            'schedule_ids' => $schedules->pluck('id')->toArray()
        ]);

        if ($schedules->isEmpty()) {
            return ['total' => 0, 'grouped_by_employee' => [], 'all_history' => []];
        }

        // Check if remarks history is loaded
        foreach ($schedules as $schedule) {
            Log::info('Schedule ID: ' . $schedule->id . ' has remarks history count: ' . $schedule->remarksHistory->count());
        }

        // Collect all unique employee IDs
        $allIds = $schedules->pluck('emp_id')
            ->merge($schedules->flatMap(fn($s) => $s->remarksHistory->pluck('updated_by')))
            ->unique()
            ->values()
            ->toArray();

        Log::info('Employee IDs to fetch', ['ids' => $allIds]);

        // Fetch names once
        $employeeNames = $this->getEmployeeNamesBulk($allIds);

        // Build history array
        $history = [];
        foreach ($schedules as $schedule) {
            foreach ($schedule->remarksHistory as $record) {
                $history[] = [
                    'history_id' => $record->history_id,
                    'emp_id' => $schedule->emp_id,
                    'emp_name' => $employeeNames[$schedule->emp_id] ?? $record->empname ?? 'Unknown',
                    'old_remarks' => $record->old_remarks,
                    'new_remarks' => $record->new_remarks,
                    'operation' => $record->operation,
                    'updated_at' => $record->updated_at,
                    'updated_by' => $record->updated_by,
                    'updated_by_name' => $employeeNames[$record->updated_by] ?? $record->updated_by,
                ];
            }
        }

        Log::info('History entries built', ['count' => count($history)]);

        return [
            'total' => count($history),
            'grouped_by_employee' => $this->groupRemarksHistoryByEmployee($history),
            'all_history' => $history,
        ];
    }
    /**
     * Bulk fetch employee names from HRIS (business logic)
     */
    private function getEmployeeNamesBulk(array $employeeIds): array
    {
        if (empty($employeeIds)) {
            return [];
        }

        try {
            return $this->hris->fetchEmployeeNamesBulk($employeeIds);
        } catch (\Exception $e) {
            Log::error('Failed to fetch employee names from HRIS: ' . $e->getMessage());
            return [];
        }
    }

    /**
     * Group remarks history by employee (business logic)
     */
    private function groupRemarksHistoryByEmployee(array $history): array
    {
        $grouped = [];

        foreach ($history as $item) {
            $empId = $item['emp_id'];
            if (!$empId) continue;

            if (!isset($grouped[$empId])) {
                $grouped[$empId] = [
                    'emp_id' => $empId,
                    'emp_name' => $item['emp_name'],
                    'history' => [],
                ];
            }

            $grouped[$empId]['history'][] = $item;
        }

        // Sort each employee's history by date desc
        foreach ($grouped as &$employee) {
            usort($employee['history'], function ($a, $b) {
                return strtotime($b['updated_at']) - strtotime($a['updated_at']);
            });
        }

        return array_values($grouped);
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
}
