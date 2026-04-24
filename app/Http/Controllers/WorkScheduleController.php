<?php

namespace App\Http\Controllers;

use App\Exports\WorkScheduleTemplateExport;
use App\Models\PayrollCutoffSchedule;
use App\Models\ShiftCode;
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

        $empId = session('emp_data.emp_id');
        $hris = new HrisApiService();
        $managerWorkDetails = $hris->fetchWorkDetails($empId);
        $managerProdLine = $managerWorkDetails['prod_line'] ?? null;

        $shifts = $this->getFilteredShiftCodes($managerProdLine);

        return inertia('WorkSchedule/Template', [
            'cutoffList' => $cutoffList,
            'shifts' => $shifts,
        ]);
    }

    private function getFilteredShiftCodes(?string $prodLine)
    {
        try {
            if (!empty($prodLine)) {
                if (strpos($prodLine, 'PL8') !== false) {
                    return ShiftCode::where('shift_group', 'AMS')
                        ->where('shift_code_status', 1)
                        ->orderBy('shiftcode')
                        ->get()
                        ->toArray();
                } elseif (strpos($prodLine, 'PL2') !== false) {
                    return ShiftCode::where('shift_group', 'PL2/DEFAULT')
                        ->where('shift_code_status', 1)
                        ->orderBy('shiftcode')
                        ->get()
                        ->toArray();
                } else {
                    return ShiftCode::whereIn('shift_group', ['DEFAULT', 'PL2/DEFAULT'])
                        ->where('shift_code_status', 1)
                        ->orderBy('shiftcode')
                        ->get()
                        ->toArray();
                }
            }

            return ShiftCode::where('shift_code_status', 1)
                ->orderBy('shiftcode')
                ->get()
                ->toArray();
        } catch (\Exception $e) {
            return ShiftCode::where('shift_code_status', 1)
                ->orderBy('shiftcode')
                ->get()
                ->toArray();
        }
    }

    public function downloadTemplate(Request $request)
    {
        $request->validate([
            'cutoff_id' => 'required|integer|exists:payroll_cutoff_schedule,ID',
        ]);

        $cutoffId = $request->input('cutoff_id');
        $empId = session('emp_data.emp_id');

        $hris = new HrisApiService();
        $directReports = $hris->fetchDirectReports($empId);
        $employeeIds = array_column($directReports, 'emp_id');

        // 👉 Get manager's work details to get their prodline for shift code filtering
        $managerWorkDetails = $hris->fetchWorkDetails($empId);
        $managerProdLine = $managerWorkDetails['prod_line'] ?? null;

        // 👉 Get cutoff dates
        $cutoff = PayrollCutoffSchedule::find($cutoffId);

        $dateFrom = date('Ymd', strtotime($cutoff->payroll_date_start));
        $dateTo = date('Ymd', strtotime($cutoff->payroll_date_end));

        $extension = 'xlsx';

        // ✅ FINAL FILENAME FORMAT
        $filename = "schedule_template_{$dateFrom}_to_{$dateTo}_{$empId}.{$extension}";

        $export = new WorkScheduleTemplateExport($cutoffId, $employeeIds, $managerProdLine);

        return Excel::download($export, $filename);
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
