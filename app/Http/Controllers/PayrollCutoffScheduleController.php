<?php

namespace App\Http\Controllers;

use App\Services\PayrollCutoffScheduleService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;

class PayrollCutoffScheduleController extends Controller
{
    public function __construct(
        private PayrollCutoffScheduleService $service
    ) {}

    public function page(): Response
    {
        return Inertia::render('Admin/PayrollCutoffSchedule');
    }

    public function index(Request $request): JsonResponse
    {
        try {
            $year    = $request->query('year');
            $search  = $request->query('search', '');
            $perPage = (int) $request->query('per_page', 15);

            $data = $this->service->paginate(
                year: $year ? (int) $year : null,
                search: $search,
                perPage: $perPage,
            );

            return response()->json(['success' => true, 'data' => $data]);
        } catch (\Exception $e) {
            Log::error('PayrollCutoffSchedule index error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Failed to fetch schedules.'], 500);
        }
    }

    public function show(int $id): JsonResponse
    {
        try {
            $record = $this->service->getById($id);

            if (!$record) {
                return response()->json(['success' => false, 'message' => 'Schedule not found.'], 404);
            }

            return response()->json(['success' => true, 'data' => $record]);
        } catch (\Exception $e) {
            Log::error("PayrollCutoffSchedule show error [{$id}]: " . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Failed to fetch schedule.'], 500);
        }
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'payroll_date_start' => 'required|date_format:Y-m-d',
            'payroll_date_end'   => 'required|date_format:Y-m-d',
        ]);

        try {
            $record = $this->service->create($validated, (int) session('emp_data.emp_id'));

            return response()->json([
                'success' => true,
                'message' => 'Cutoff schedule created successfully.',
                'data'    => $record,
            ], 201);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        } catch (\Exception $e) {
            Log::error('PayrollCutoffSchedule store error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Failed to create schedule.'], 500);
        }
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'payroll_date_start' => 'required|date_format:Y-m-d',
            'payroll_date_end'   => 'required|date_format:Y-m-d',
        ]);

        try {
            $record = $this->service->update($id, $validated);

            return response()->json([
                'success' => true,
                'message' => 'Cutoff schedule updated successfully.',
                'data'    => $record,
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        } catch (\Exception $e) {
            Log::error("PayrollCutoffSchedule update error [{$id}]: " . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Failed to update schedule.'], 500);
        }
    }

    public function destroy(int $id): JsonResponse
    {
        try {
            $this->service->delete($id);

            return response()->json([
                'success' => true,
                'message' => 'Cutoff schedule deleted successfully.',
            ]);
        } catch (\Exception $e) {
            Log::error("PayrollCutoffSchedule destroy error [{$id}]: " . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Failed to delete schedule.'], 500);
        }
    }
}
