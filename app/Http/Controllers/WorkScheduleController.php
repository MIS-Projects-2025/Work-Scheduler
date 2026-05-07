<?php

namespace App\Http\Controllers;

use App\Exports\WorkScheduleTemplateExport;
use App\Exports\RemarksHistoryExport;
use App\Exports\WorkScheduleDataExport;
use App\Exports\WorkScheduleOtExport;
use App\Models\WorkSchedule;
use App\Services\WorkScheduleService;
use Maatwebsite\Excel\Facades\Excel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class WorkScheduleController extends Controller
{
    public function __construct(
        private readonly WorkScheduleService $service,
    ) {}

    // -------------------------------------------------------------------------
    // Index — listing table with server-side pagination
    // -------------------------------------------------------------------------

    public function index(Request $request)
    {
        $empId       = session('emp_data.emp_id');
        $empPosition = (int) session('emp_data.emp_position', 0);
        $isHrAdmin = (string) session('emp_data.emp_system_role') === 'hr_admin';
        // ── TODO: replace with your actual HR admin check ─────────────────────
        // $isHrAdmin = false;
        // ─────────────────────────────────────────────────────────────────────
        // dd($empId, $empPosition, $isHrAdmin);
        $filters = [];
        if ($hash = $request->input('hash')) {
            try {
                $filters = json_decode(base64_decode($hash), true) ?? [];
            } catch (\Exception) {
                $filters = [];
            }
        }

        $status   = (int) ($filters['status'] ?? 1);
        $search   = (string) ($filters['search'] ?? '');
        $orderBy  = (string) ($filters['orderBy'] ?? 'payroll_date_start');
        $orderDir = (string) ($filters['orderDir'] ?? 'desc');
        $perPage  = (int) ($filters['perPage'] ?? 10);
        $page     = (int) ($filters['page'] ?? 1);

        $data = $isHrAdmin
            ? $this->service->getHrIndexData($status, $search, $orderBy, $orderDir, $perPage, $page, withTabCounts: true)
            : $this->service->getIndexData($empId, $empPosition, $status, $search, $orderBy, $orderDir, $perPage, $page, withTabCounts: true);

        $hash = base64_encode(json_encode(compact('status', 'search', 'orderBy', 'orderDir', 'perPage', 'page')));

        return inertia('WorkSchedule/Index', [
            'schedules'   => $data['paginator'],
            'tabCounts'   => $data['tabCounts'],
            'hash'        => $hash,
            'empPosition' => $empPosition,
            'isHrAdmin'   => $isHrAdmin,
            'filters'     => compact('status', 'search', 'orderBy', 'orderDir', 'perPage', 'page'),
        ]);
    }

    // -------------------------------------------------------------------------
    // Template page
    // -------------------------------------------------------------------------

    public function templatePage(Request $request)
    {
        return inertia(
            'WorkSchedule/Template',
            $this->service->getTemplatePageData(session('emp_data.emp_id'))
        );
    }

    // -------------------------------------------------------------------------
    // Download template Excel
    // -------------------------------------------------------------------------

    public function downloadTemplate(Request $request)
    {
        $request->validate([
            'cutoff_id' => 'required|integer|exists:payroll_cutoff_schedule,ID',
        ]);

        $ctx = $this->service->getDownloadContext(
            session('emp_data.emp_id'),
            (int) $request->input('cutoff_id')
        );

        return Excel::download(
            new WorkScheduleTemplateExport($ctx['cutoffId'], $ctx['employeeIds'], $ctx['prodLine'], $ctx['holidays']),
            $ctx['filename']
        );
    }
    /**
     * Submit the filled template
     */
    public function submitTemplate(Request $request)
    {
        try {
            $validated = $request->validate([
                'employees' => 'required|array',
                'employees.*.empId' => 'required|string',
                'employees.*.schedule' => 'required|array',
                'employees.*.supervisorId' => 'nullable|string',
                'employees.*.approver2Id' => 'nullable|string',
                'cutoff_id' => 'required|integer|exists:payroll_cutoff_schedule,ID',
            ]);

            $result = $this->service->submitSchedules($validated, session('emp_data.emp_id'));


            return response()->json($result);
        } catch (\Exception $e) {
            Log::error("Failed to submit schedules: " . $e->getMessage());

            return response()->json([
                'status' => 'error',
                'error' => 'Failed to save schedules: ' . $e->getMessage()
            ], 500);
        }
    }
    // -------------------------------------------------------------------------
    // View / detail
    // -------------------------------------------------------------------------
    public function viewSchedules(Request $request)
    {
        $filters = [];

        if ($hash = $request->input('hash')) {
            try {
                $filters = json_decode(base64_decode($hash), true) ?? [];
            } catch (\Exception) {
                $filters = [];
            }
        }

        $isHrAdmin = (string) session('emp_data.emp_system_role') === 'hr_admin';
        $createdBy = $filters['created_by'] ?? null;
        $dateStart  = $filters['date_start'] ?? null;
        $dateEnd    = $filters['date_end'] ?? null;
        $status     = isset($filters['status']) ? (int) $filters['status'] : null;
        $perPage    = (int) ($filters['perPage'] ?? 20);
        $page       = (int) ($filters['page'] ?? 1);
        $search     = (string) ($filters['search'] ?? '');

        if (!$dateStart || !$dateEnd || $status === null) {
            return redirect()->route('workschedule.index');
        }

        // HR admin: show all employees for the cutoff, regardless of creator
        if ($isHrAdmin && !$createdBy) {
            return inertia('WorkSchedule/View', $this->service->getHrViewData(
                $dateStart,
                $dateEnd,
                $perPage,
                $page,
                $search,
                $status
            ));
        }

        // Regular user (or HR admin drilling into a specific creator's group)
        if (!$createdBy) {
            return redirect()->route('workschedule.index');
        }

        return inertia('WorkSchedule/View', $this->service->getViewData(
            session('emp_data.emp_id'),
            $createdBy,
            $dateStart,
            $dateEnd,
            $perPage,
            $page,
            $search,
            $status
        ));
    }

    // -------------------------------------------------------------------------
    // Cutoff days helper
    // -------------------------------------------------------------------------

    public function getCutoffDays(Request $request)
    {
        if (!$cutoffId = $request->query('cutoff_id')) {
            return response()->json(['error' => 'cutoff_id required'], 400);
        }

        $cutoff = \App\Models\PayrollCutoffSchedule::find($cutoffId);
        if (!$cutoff) {
            return response()->json(['error' => 'Cutoff not found'], 404);
        }

        $days = [];
        $cur  = strtotime($cutoff->payroll_date_start);
        $end  = strtotime($cutoff->payroll_date_end);
        while ($cur <= $end) {
            $days[] = date('Y-m-d', $cur);
            $cur    = strtotime('+1 day', $cur);
        }

        $holidayItems = $this->service->getHolidaysForPeriod(
            $cutoff->payroll_date_start,
            $cutoff->payroll_date_end
        );

        return response()->json([
            'cutoff'   => $cutoff,
            'days'     => $days,
            'holidays' => $holidayItems,
        ]);
    }

    public function saveEdits(Request $request)
    {
        $request->validate([
            'date_start'                   => 'required|date',
            'date_end'                     => 'required|date',
            'changes'                      => 'required|array|min:1',
            'changes.*.work_schedule_id'   => 'required|integer|exists:work_schedule,id',
            'changes.*.work_date'          => 'required|date',
            'changes.*.shift_code_id'      => 'nullable|integer|exists:shift_codes,shift_code_id',
        ]);

        $result = $this->service->saveScheduleEdits(
            $request->input('date_start'),
            $request->input('date_end'),
            $request->input('changes')
        );

        return back()->with('editResult', $result);
    }

    public function acknowledge(Request $request)
    {
        $request->validate([
            'created_by' => 'required|string',
            'date_start' => 'required|date',
            'date_end'   => 'required|date',
        ]);

        $empId = session('emp_data.emp_id');

        $this->service->acknowledge(
            $empId,
            $request->input('created_by'),
            $request->input('date_start'),
            $request->input('date_end')
        );

        return back();
    }
    public function approve(Request $request)
    {

        $data = $this->validateRequest($request);

        $empId = session('emp_data.emp_id');

        $this->service->updateStatus(
            $empId,
            $data['created_by'],
            $data['date_start'],
            $data['date_end'],
            WorkSchedule::STATUS_APPROVED,
            $data['emp_ids'] ?? [],
            $data['remarks'] ?? null
        );

        return back()->with('success', 'Approved successfully');
    }

    public function disapprove(Request $request)
    {
        $data = $this->validateRequest($request, true);

        $empId = session('emp_data.emp_id');

        $this->service->updateStatus(
            $empId,
            $data['created_by'],
            $data['date_start'],
            $data['date_end'],
            WorkSchedule::STATUS_DISAPPROVED,
            $data['emp_ids'] ?? [],
            $data['remarks']
        );

        return back();
    }



    /**
     * Get paginated + searchable remarks history for a cutoff period (HR admin only).
     */
    public function getRemarksHistory(Request $request)
    {
        try {
            $validated = $request->validate([
                'date_start' => 'required|date',
                'date_end'   => 'required|date',
                'search'     => 'nullable|string|max:100',
                'page'       => 'nullable|integer|min:1',
                'per_page'   => 'nullable|integer|in:10,20,50,100',
            ]);

            if ((string) session('emp_data.emp_system_role') !== 'hr_admin') {
                return response()->json(['error' => 'Unauthorized'], 403);
            }

            $result = $this->service->getRemarksHistoryPaginated(
                $validated['date_start'],
                $validated['date_end'],
                $validated['search']   ?? '',
                (int) ($validated['page']     ?? 1),
                (int) ($validated['per_page'] ?? 20)
            );

            // Remove internal key before sending to client
            unset($result['_all_history']);

            return response()->json($result);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['error' => $e->errors()], 422);
        } catch (\Exception $e) {
            Log::error('Failed to fetch remarks history: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to fetch remarks history'], 500);
        }
    }

    /**
     * Export all remarks history for a cutoff as Excel (HR admin only).
     */
    public function exportRemarksHistory(Request $request)
    {
        $request->validate(['date_start' => 'required|date', 'date_end' => 'required|date']);

        if ((string) session('emp_data.emp_system_role') !== 'hr_admin') {
            abort(403);
        }

        $dateStart = $request->input('date_start');
        $dateEnd   = $request->input('date_end');
        $history   = $this->service->getAllRemarksHistoryForExport($dateStart, $dateEnd);

        $filename = 'remarks_history_' . str_replace('-', '', $dateStart) . '_' . str_replace('-', '', $dateEnd) . '.xlsx';

        return Excel::download(new RemarksHistoryExport($history, $dateStart, $dateEnd), $filename);
    }

    /**
     * Export all schedule data for a cutoff as Excel (HR admin only).
     */
    public function exportSchedule(Request $request)
    {
        $request->validate(['date_start' => 'required|date', 'date_end' => 'required|date']);

        if ((string) session('emp_data.emp_system_role') !== 'hr_admin') {
            abort(403);
        }

        $dateStart = $request->input('date_start');
        $dateEnd   = $request->input('date_end');
        $data      = $this->service->getScheduleExportData($dateStart, $dateEnd);

        $filename = 'work_schedule_' . str_replace('-', '', $dateStart) . '_' . str_replace('-', '', $dateEnd) . '.xlsx';

        return Excel::download(new WorkScheduleDataExport($data), $filename);
    }

    /**
     * Export OT hours per employee for a cutoff (HR admin only).
     */
    public function exportOt(Request $request)
    {
        $request->validate(['date_start' => 'required|date', 'date_end' => 'required|date']);

        if ((string) session('emp_data.emp_system_role') !== 'hr_admin') {
            abort(403);
        }

        $dateStart = $request->input('date_start');
        $dateEnd   = $request->input('date_end');
        $rows      = $this->service->getOtExportData($dateStart, $dateEnd);

        $filename = 'ot_export_' . str_replace('-', '', $dateStart) . '_' . str_replace('-', '', $dateEnd) . '.xlsx';

        return Excel::download(new WorkScheduleOtExport($rows, $dateStart, $dateEnd), $filename);
    }

    private function validateRequest(Request $request, $requireRemarks = false)
    {
        $rules = [
            'created_by' => 'required|string',
            'date_start' => 'required|date',
            'date_end'   => 'required|date',
            'remarks'    => ($requireRemarks ? 'required' : 'nullable') . '|string|max:500',
        ];

        // Add emp_ids validation only if present in request
        if ($request->has('emp_ids')) {
            $rules['emp_ids'] = 'array';
        }

        return $request->validate($rules);
    }
}
