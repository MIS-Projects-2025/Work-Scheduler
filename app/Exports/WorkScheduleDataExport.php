<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\Exportable;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Border;
use Illuminate\Support\Collection;

class WorkScheduleDataExport implements FromCollection, ShouldAutoSize, WithEvents
{
    use Exportable;

    private array $rows;
    private array $days;
    private string $dateStart;
    private string $dateEnd;

    // Fixed info columns before the date columns
    private const INFO_HEADERS = ['Emp ID', 'Employee Name', 'Department', 'Production Line', 'Status'];
    private const INFO_KEYS    = ['emp_id', 'emp_name', 'department', 'prodline', 'status'];

    public function __construct(array $data)
    {
        $this->rows      = $data['rows'];
        $this->days      = $data['days'];
        $this->dateStart = $data['date_start'];
        $this->dateEnd   = $data['date_end'];
    }

    public function collection(): Collection
    {
        return collect([]);
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet     = $event->sheet->getDelegate();
                $infoCols  = count(self::INFO_HEADERS);
                $dayCols   = count($this->days);
                $lastColIdx = $infoCols + $dayCols - 1;
                $lastCol   = $this->colLetter($lastColIdx);

                // ── Title row ────────────────────────────────────────────────
                $from = date('M d, Y', strtotime($this->dateStart));
                $to   = date('M d, Y', strtotime($this->dateEnd));
                $sheet->mergeCells("A1:{$lastCol}1");
                $sheet->setCellValue('A1', "Work Schedule Export — {$from} to {$to}");
                $sheet->getStyle('A1')->applyFromArray([
                    'font'      => ['bold' => true, 'size' => 13, 'color' => ['rgb' => 'FFFFFF']],
                    'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '4472C4']],
                    'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
                ]);
                $sheet->getRowDimension(1)->setRowHeight(24);

                // ── Dual header rows (date + day-of-week) ─────────────────
                $dateHeaderRow = 2;
                $dayHeaderRow  = 3;

                // Info column headers (span both rows)
                foreach (self::INFO_HEADERS as $ci => $label) {
                    $col = $this->colLetter($ci);
                    $sheet->mergeCells("{$col}{$dateHeaderRow}:{$col}{$dayHeaderRow}");
                    $sheet->setCellValue("{$col}{$dateHeaderRow}", $label);
                }

                // Day columns
                foreach ($this->days as $i => $day) {
                    $col = $this->colLetter($infoCols + $i);
                    $sheet->setCellValue("{$col}{$dateHeaderRow}", date('d-M', strtotime($day)));
                    $sheet->setCellValue("{$col}{$dayHeaderRow}", strtoupper(substr(date('l', strtotime($day)), 0, 3)));
                }

                // Header styling
                $sheet->getStyle("A{$dateHeaderRow}:{$lastCol}{$dayHeaderRow}")->applyFromArray([
                    'font'      => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
                    'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '2E75B6']],
                    'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
                    'borders'   => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'FFFFFF']]],
                ]);

                // ── Data rows ─────────────────────────────────────────────
                $dataStart = $dayHeaderRow + 1;
                $r         = $dataStart;

                foreach ($this->rows as $row) {
                    // Info columns
                    foreach (self::INFO_KEYS as $ci => $key) {
                        $sheet->setCellValue($this->colLetter($ci) . $r, $row[$key] ?? '');
                    }

                    // Day columns
                    foreach ($this->days as $i => $date) {
                        $sheet->setCellValue($this->colLetter($infoCols + $i) . $r, $row[$date] ?? '');
                    }

                    // Zebra striping
                    if ($r % 2 === 0) {
                        $sheet->getStyle("A{$r}:{$lastCol}{$r}")->applyFromArray([
                            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'EEF4FF']],
                        ]);
                    }

                    $r++;
                }

                $lastRow = $r - 1;

                // ── Borders on data area ──────────────────────────────────
                if ($lastRow >= $dataStart) {
                    $sheet->getStyle("A{$dataStart}:{$lastCol}{$lastRow}")->applyFromArray([
                        'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'D0D7E2']]],
                    ]);
                }

                // ── Freeze pane at first date column ─────────────────────
                $sheet->freezePane($this->colLetter($infoCols) . $dataStart);

                // ── Fixed widths for info columns ─────────────────────────
                $sheet->getColumnDimension('A')->setWidth(12);
                $sheet->getColumnDimension('B')->setWidth(28);
                $sheet->getColumnDimension('C')->setWidth(20);
                $sheet->getColumnDimension('D')->setWidth(18);
                $sheet->getColumnDimension('E')->setWidth(16);
            },
        ];
    }

    private function colLetter(int $index): string
    {
        $col = '';
        while ($index >= 0) {
            $col   = chr(65 + ($index % 26)) . $col;
            $index = intdiv($index, 26) - 1;
        }
        return $col;
    }
}
