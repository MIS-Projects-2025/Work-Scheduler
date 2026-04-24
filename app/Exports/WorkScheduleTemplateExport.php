<?php

namespace App\Exports;

use App\Models\PayrollCutoffSchedule;
use App\Models\ShiftCode;
use App\Services\HrisApiService;
use Maatwebsite\Excel\Concerns\Exportable;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Cell\DataValidation;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class WorkScheduleTemplateExport implements WithMultipleSheets
{
    use Exportable;

    private int $cutoffId;
    private array $employeeIds;
    private HrisApiService $hris;

    public function __construct(int $cutoffId, ?array $employeeIds = [])
    {
        $this->cutoffId    = $cutoffId;
        $this->employeeIds = $employeeIds ?? [];
        $this->hris        = new HrisApiService();
    }

    public function sheets(): array
    {
        $cutoff = PayrollCutoffSchedule::find($this->cutoffId)
            ?? PayrollCutoffSchedule::orderBy('ID', 'desc')->first();

        $shiftCodes = ShiftCode::where('shift_code_status', 1)
            ->orderBy('shiftcode')
            ->get();

        $days = $this->getDaysBetween($cutoff->payroll_date_start, $cutoff->payroll_date_end);

        return [
            new EmployeeListSheet($this->cutoffId, $this->employeeIds, $this->hris, $shiftCodes, $days),
            new ShiftCodesReferenceSheet($shiftCodes),
        ];
    }

    private function getDaysBetween(string $start, string $end): array
    {
        $days    = [];
        $current = strtotime($start);
        $endTs   = strtotime($end);
        while ($current <= $endTs) {
            $days[]  = date('Y-m-d', $current);
            $current = strtotime('+1 day', $current);
        }
        return $days;
    }
}

// -----------------------------------------------------------------------------
// Sheet 1 - Employee schedule
// -----------------------------------------------------------------------------
class EmployeeListSheet implements FromCollection, ShouldAutoSize, WithEvents
{
    private int $cutoffId;
    private array $employeeIds;
    private HrisApiService $hris;
    private $shiftCodes;
    private array $days;

    private const INFO_COLS = 6;

    public function __construct(int $cutoffId, array $employeeIds, HrisApiService $hris, $shiftCodes, array $days)
    {
        $this->cutoffId    = $cutoffId;
        $this->employeeIds = $employeeIds;
        $this->hris        = $hris;
        $this->shiftCodes  = $shiftCodes;
        $this->days        = $days;
    }

    public function collection()
    {
        return collect([]);
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {

                $sheet = $event->sheet->getDelegate();
                $daysCount = count($this->days);

                $sheet->mergeCells('A1:F1');

                $sheet->setCellValue('A1', 'SHIFT CODE LEGEND');

                $sheet->getStyle('A1')->applyFromArray([
                    'font' => [
                        'bold' => true,
                        'color' => ['rgb' => 'FFFFFF'],
                        'size' => 11,
                    ],
                    'fill' => [
                        'fillType' => Fill::FILL_SOLID,
                        'startColor' => ['rgb' => '4472C4'], // same as header
                    ],
                    'alignment' => [
                        'horizontal' => Alignment::HORIZONTAL_CENTER,
                        'vertical' => Alignment::VERTICAL_CENTER,
                    ],
                ]);

                $codes = $this->shiftCodes->filter(fn($c) => !empty($c->shiftcode))->values();

                $codesPerRow = 3; // 👉 3 codes per row
                $colsPerCode = 2; // 👉 each code uses 2 columns (code + desc)

                foreach ($codes as $index => $code) {

                    $row = 2 + intdiv($index, $codesPerRow);
                    $colIndex = ($index % $codesPerRow) * $colsPerCode;

                    $codeCol = $this->colLetter($colIndex);
                    $descCol = $this->colLetter($colIndex + 1);

                    $sheet->setCellValue("{$codeCol}{$row}", $code->shiftcode);
                    $sheet->setCellValue("{$descCol}{$row}", $code->shiftcode_desc);

                    $bg = ltrim($code->shiftcode_bg_color, '#') ?: 'FFFFFF';
                    $font = ltrim($code->shiftcode_font_color, '#') ?: '000000';

                    $style = [
                        'fill' => [
                            'fillType' => Fill::FILL_SOLID,
                            'startColor' => ['rgb' => $bg]
                        ],
                        'font' => [
                            'bold' => true,
                            'color' => ['rgb' => $font]
                        ],
                        'borders' => [
                            'allBorders' => [
                                'borderStyle' => Border::BORDER_THIN,
                                'color' => ['rgb' => 'AAAAAA']
                            ]
                        ],
                        'alignment' => [
                            'vertical' => Alignment::VERTICAL_CENTER
                        ]
                    ];

                    // Apply style to both cells
                    $sheet->getStyle("{$codeCol}{$row}")->applyFromArray(
                        array_merge($style, [
                            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]
                        ])
                    );

                    $sheet->getStyle("{$descCol}{$row}")->applyFromArray(
                        array_merge($style, [
                            'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT]
                        ])
                    );
                }

                // Compute last legend row
                $totalRows = ceil(count($codes) / $codesPerRow);
                $legendEndRow = 1 + $totalRows;

                // spacing row after legend
                $sepRow = $legendEndRow + 2;
                // ---- CUTOFF HEADER ----
                $cutoffStart = date('M d, Y', strtotime($this->days[0]));
                $cutoffEnd   = date('M d, Y', strtotime(end($this->days)));

                $cutoffRow = $sepRow;

                $lastCol = $this->colLetter(self::INFO_COLS + $daysCount - 1);

                $sheet->mergeCells("A{$cutoffRow}:{$lastCol}{$cutoffRow}");
                $sheet->setCellValue("A{$cutoffRow}", "Cutoff: {$cutoffStart} to {$cutoffEnd}");

                $sheet->getStyle("A{$cutoffRow}")->applyFromArray([
                    'font' => ['bold' => true, 'size' => 12],
                    'alignment' => [
                        'horizontal' => Alignment::HORIZONTAL_CENTER,
                        'vertical' => Alignment::VERTICAL_CENTER,
                    ],
                ]);

                // ---- DUAL HEADER ----
                $dateHeaderRow = $cutoffRow + 1;
                $dayHeaderRow  = $dateHeaderRow + 1;

                $staticHeaders = ['Emp ID', 'Employee Name', 'Department', 'Production Line', 'Team', 'Shift Type'];

                foreach ($staticHeaders as $ci => $h) {
                    $col = $this->colLetter($ci);
                    $sheet->mergeCells("{$col}{$dateHeaderRow}:{$col}{$dayHeaderRow}");
                    $sheet->setCellValue("{$col}{$dateHeaderRow}", $h);
                }

                foreach ($this->days as $i => $day) {
                    $col = $this->colLetter(self::INFO_COLS + $i);

                    $sheet->setCellValue("{$col}{$dateHeaderRow}", date('d-M', strtotime($day)));
                    $sheet->setCellValue("{$col}{$dayHeaderRow}", date('D', strtotime($day)));
                }

                // Style headers
                $sheet->getStyle("A{$dateHeaderRow}:{$lastCol}{$dayHeaderRow}")->applyFromArray([
                    'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '4472C4']],
                    'alignment' => [
                        'horizontal' => Alignment::HORIZONTAL_CENTER,
                        'vertical' => Alignment::VERTICAL_CENTER,
                    ],
                ]);

                // ---- DATA ----
                $dataStartRow = $dayHeaderRow + 1;
                $row = $dataStartRow;

                if (!empty($this->employeeIds)) {
                    $employees = $this->hris->fetchEmployeesBulk($this->employeeIds);

                    foreach ($this->employeeIds as $empId) {
                        $emp  = $employees[$empId] ?? [];
                        $work = $this->hris->fetchWorkDetails($empId);

                        $sheet->setCellValue("A{$row}", $empId);
                        $sheet->setCellValue("B{$row}", $emp['emp_name'] ?? '');
                        $sheet->setCellValue("C{$row}", $emp['department'] ?? '');
                        $sheet->setCellValue("D{$row}", $emp['prodline'] ?? '');
                        $sheet->setCellValue("E{$row}", $work['team'] ?? '');
                        $sheet->setCellValue("F{$row}", $work['shift_type'] ?? '');

                        $row++;
                    }
                }

                // ---- FREEZE ----
                $sheet->freezePane('G' . $dataStartRow);

                // ---- WIDTHS ----
                $sheet->getColumnDimension('A')->setWidth(12);
                $sheet->getColumnDimension('B')->setWidth(28);
                $sheet->getColumnDimension('C')->setWidth(20);
                $sheet->getColumnDimension('D')->setWidth(18);
                $sheet->getColumnDimension('E')->setWidth(14);
                $sheet->getColumnDimension('F')->setWidth(14);

                for ($i = 0; $i < $daysCount; $i++) {
                    $sheet->getColumnDimension($this->colLetter(self::INFO_COLS + $i))->setWidth(10);
                }
            }
        ];
    }

    private function colLetter(int $index): string
    {
        $col = '';
        while ($index >= 0) {
            $col = chr(65 + ($index % 26)) . $col;
            $index = intdiv($index, 26) - 1;
        }
        return $col;
    }
}

// -----------------------------------------------------------------------------
// Sheet 2 - Shift codes reference
// -----------------------------------------------------------------------------
class ShiftCodesReferenceSheet implements FromCollection, ShouldAutoSize, WithEvents
{
    private $shiftCodes;

    public function __construct($shiftCodes)
    {
        $this->shiftCodes = $shiftCodes;
    }

    public function collection()
    {
        return $this->shiftCodes->map(fn($c) => [
            'shiftcode'   => $c->shiftcode,
            'description' => $c->shiftcode_desc,
            'group'       => $c->shift_group,
            'bg_color'    => $c->shiftcode_bg_color,
            'font_color'  => $c->shiftcode_font_color,
        ]);
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();

                $sheet->setCellValue('A1', 'Shift Code');
                $sheet->setCellValue('B1', 'Description');
                $sheet->setCellValue('C1', 'Group');
                $sheet->setCellValue('D1', 'Background Color');
                $sheet->setCellValue('E1', 'Font Color');

                $sheet->getStyle('A1:E1')->applyFromArray([
                    'font'      => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
                    'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '4472C4']],
                    'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
                ]);

                $row = 2;
                foreach ($this->shiftCodes as $code) {
                    if (empty($code->shiftcode)) continue;

                    $bg   = ltrim($code->shiftcode_bg_color,   '#') ?: 'FFFFFF';
                    $font = ltrim($code->shiftcode_font_color, '#') ?: '000000';

                    $sheet->getStyle("A{$row}:E{$row}")->applyFromArray([
                        'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $bg]],
                        'font' => ['bold' => true, 'color' => ['rgb' => $font]],
                    ]);

                    $row++;
                }

                foreach (range('A', 'E') as $col) {
                    $sheet->getColumnDimension($col)->setAutoSize(true);
                }
            },
        ];
    }
}
