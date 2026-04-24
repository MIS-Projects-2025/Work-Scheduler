<?php

namespace App\Http\Controllers;

use App\Exports\WorkScheduleTemplateExport;
use App\Models\PayrollCutoffSchedule;
use App\Services\HrisApiService;
use Maatwebsite\Excel\Facades\Excel;
use Illuminate\Http\Request;

class WorkScheduleController extends Controller
{
    public function templatePage(Request $request)
    {
        $cutoffList = PayrollCutoffSchedule::orderBy('payroll_date_start', 'desc')
            ->limit(24)
            ->get()
            ->toArray();

        return inertia('WorkSchedule/Template', [
            'cutoffList' => $cutoffList,
        ]);
    }
    public function downloadTemplate(Request $request)
    {
        $request->validate([
            'cutoff_id' => 'required|integer|exists:payroll_cutoff_schedule,ID',
        ]);

        $cutoffId = $request->input('cutoff_id');
        $empId    = session('emp_data.emp_id');

        $hris          = new HrisApiService();
        $directReports = $hris->fetchDirectReports($empId);
        $employeeIds   = array_column($directReports, 'emp_id');

        // 👉 Get cutoff dates
        $cutoff = PayrollCutoffSchedule::find($cutoffId);

        $dateFrom = date('Ymd', strtotime($cutoff->payroll_date_start));
        $dateTo   = date('Ymd', strtotime($cutoff->payroll_date_end));

        // 👉 Format emp part
        $empPart = !empty($employeeIds)
            ? implode('-', $employeeIds)
            : 'ALL';



        $extension = 'xlsx';

        // ✅ FINAL FILENAME FORMAT
        $filename = "schedule_template_{$dateFrom}_to_{$dateTo}_{$empId}.{$extension}";

        $export = new WorkScheduleTemplateExport($cutoffId, $employeeIds);

        return \Maatwebsite\Excel\Facades\Excel::download($export, $filename);
    }

    public function getCutoffDays(Request $request)
    {
        $cutoffId = $request->query('cutoff_id');

        if (!$cutoffId) {
            return response()->json(['error' => 'cutoff_id required'], 400);
        }

        $cutoff = PayrollCutoffSchedule::find($cutoffId);

        if (!$cutoff) {
            return response()->json(['error' => 'Cutoff not found'], 404);
        }

        $days = [];
        $current = strtotime($cutoff->payroll_date_start);
        $endTimestamp = strtotime($cutoff->payroll_date_end);

        while ($current <= $endTimestamp) {
            $days[] = date('Y-m-d', $current);
            $current = strtotime('+1 day', $current);
        }

        return response()->json([
            'cutoff' => $cutoff,
            'days' => $days,
        ]);
    }
}
