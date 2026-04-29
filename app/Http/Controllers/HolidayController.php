<?php

namespace App\Http\Controllers;

use App\Services\HolidayService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;

class HolidayController extends Controller
{
    public function __construct(
        private HolidayService $service
    ) {}

    /**
     * GET /holidays/page  →  renders Admin/Holiday Inertia page
     */
    public function page(): Response
    {
        return Inertia::render('Admin/Holiday');
    }

    /**
     * GET /holidays?year=2025
     */
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
            Log::error('Holiday index error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Failed to fetch holidays.'], 500);
        }
    }

    /**
     * GET /holidays/{id}
     */
    public function show(int $id): JsonResponse
    {
        try {
            $holiday = $this->service->getById($id);

            if (!$holiday) {
                return response()->json(['success' => false, 'message' => 'Holiday not found.'], 404);
            }

            return response()->json(['success' => true, 'data' => $holiday]);
        } catch (\Exception $e) {
            Log::error("Holiday show error [{$id}]: " . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Failed to fetch holiday.'], 500);
        }
    }

    /**
     * POST /holidays
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'holiday_name' => 'required|string|max:255',
            'holiday_date' => 'required|date_format:Y-m-d',
            'holiday_type' => 'required|in:Regular,Special',
            'color'        => 'nullable|string|regex:/^#[0-9A-Fa-f]{6}$/',
        ]);

        try {
            $holiday = $this->service->create($validated, (int) session('emp_data.emp_id'));

            return response()->json([
                'success' => true,
                'message' => 'Holiday created successfully.',
                'data'    => $holiday,
            ], 201);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        } catch (\Exception $e) {
            Log::error('Holiday store error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Failed to create holiday.'], 500);
        }
    }

    /**
     * PUT /holidays/{id}
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'holiday_name' => 'required|string|max:255',
            'holiday_date' => 'required|date_format:Y-m-d',
            'holiday_type' => 'required|in:Regular,Special',
            'color'        => 'nullable|string|regex:/^#[0-9A-Fa-f]{6}$/',
        ]);

        try {
            $holiday = $this->service->update($id, $validated);

            return response()->json([
                'success' => true,
                'message' => 'Holiday updated successfully.',
                'data'    => $holiday,
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        } catch (\Exception $e) {
            Log::error("Holiday update error [{$id}]: " . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Failed to update holiday.'], 500);
        }
    }

    /**
     * DELETE /holidays/{id}
     */
    public function destroy(int $id): JsonResponse
    {
        try {
            $this->service->delete($id);

            return response()->json([
                'success' => true,
                'message' => 'Holiday deleted successfully.',
            ]);
        } catch (\Exception $e) {
            Log::error("Holiday destroy error [{$id}]: " . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Failed to delete holiday.'], 500);
        }
    }
}
