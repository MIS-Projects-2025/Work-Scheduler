<?php

namespace App\Http\Controllers;

use App\Exports\WorkScheduleTemplateExport;
use App\Services\WorkScheduleService;
use Maatwebsite\Excel\Facades\Excel;
use Illuminate\Http\Request;

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

        // Decode hash parameter if present
        $hash = $request->input('hash', '');
        $filters = [];

        if (!empty($hash)) {
            try {
                $decoded = base64_decode($hash);
                $filters = json_decode($decoded, true) ?? [];
            } catch (\Exception $e) {
                $filters = [];
            }
        }

        // Get filters from hash or use defaults
        $status   = (int) ($filters['status'] ?? 0);
        $search   = (string) ($filters['search'] ?? '');
        $orderBy  = (string) ($filters['orderBy'] ?? 'payroll_date_start');
        $orderDir = (string) ($filters['orderDir'] ?? 'desc');
        $perPage  = (int) ($filters['perPage'] ?? 15);
        $page     = (int) ($filters['page'] ?? 1);

        // Get paginated data using Laravel's paginator
        $data = $this->service->getIndexData(
            $empId,
            $empPosition,
            $status,
            $search,
            $orderBy,
            $orderDir,
            $perPage,
            $page,
            withTabCounts: true
        );

        // Generate hash for current filters
        $currentFilters = [
            'status' => $status,
            'search' => $search,
            'orderBy' => $orderBy,
            'orderDir' => $orderDir,
            'perPage' => $perPage,
            'page' => $page,
        ];

        $hash = base64_encode(json_encode($currentFilters));

        return inertia('WorkSchedule/Index', [
            'schedules' => $data['paginator'],
            'tabCounts' => $data['tabCounts'],
            'hash' => $hash,
            'empPosition' => $empPosition,
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
            new WorkScheduleTemplateExport($ctx['cutoffId'], $ctx['employeeIds'], $ctx['prodLine']),
            $ctx['filename']
        );
    }

    // -------------------------------------------------------------------------
    // View / detail
    // -------------------------------------------------------------------------

    public function viewSchedules(Request $request)
    {
        $request->validate([
            'created_by' => 'required|string',
            'date_start' => 'required|date',
            'date_end'   => 'required|date',
        ]);

        return inertia('WorkSchedule/View', $this->service->getViewData(
            session('emp_data.emp_id'),
            $request->input('created_by'),
            $request->input('date_start'),
            $request->input('date_end'),
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

        return response()->json(['cutoff' => $cutoff, 'days' => $days]);
    }
}
