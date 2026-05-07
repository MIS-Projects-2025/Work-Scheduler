<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Api\PayrollCutoffScheduleApiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class PayrollCutoffScheduleApiController extends Controller
{
    public function __construct(
        private PayrollCutoffScheduleApiService $service
    ) {}

    public function index(Request $request): JsonResponse
    {
        try {
            $year    = $request->query('year');
            $search  = $request->query('search', '');
            $perPage = $request->query('per_page');

            if ($perPage !== null) {
                $data = $this->service->paginate(
                    year: $year ? (int) $year : null,
                    search: $search,
                    perPage: (int) $perPage,
                );
            } else {
                $data = $this->service->all();
            }

            return response()->json(['success' => true, 'data' => $data]);
        } catch (\Exception $e) {
            Log::error('API PayrollCutoffSchedule index error: ' . $e->getMessage());
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
            Log::error("API PayrollCutoffSchedule show error [{$id}]: " . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Failed to fetch schedule.'], 500);
        }
    }
}
