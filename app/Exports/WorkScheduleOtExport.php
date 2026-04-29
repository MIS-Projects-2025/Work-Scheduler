<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\Exportable;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use Illuminate\Support\Collection;

class WorkScheduleOtExport implements FromCollection, WithHeadings, ShouldAutoSize, WithEvents
{
    use Exportable;

    public function __construct(
        private readonly array  $rows,
        private readonly string $dateStart,
        private readonly string $dateEnd,
    ) {}

    public function headings(): array
    {
        return ['EmpCode', 'DateFrom', 'DateTo', 'NumOTHoursApproved'];
    }

    public function collection(): Collection
    {
        return collect($this->rows)->map(fn($r) => [
            $r['EmpCode'],
            $r['DateFrom'],
            $r['DateTo'],
            $r['NumOTHoursApproved'],
        ]);
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet   = $event->sheet->getDelegate();
                $lastRow = count($this->rows) + 1;

                // Title row inserted above headings
                $sheet->insertNewRowBefore(1, 1);
                $sheet->mergeCells('A1:D1');
                $from = date('M d, Y', strtotime($this->dateStart));
                $to   = date('M d, Y', strtotime($this->dateEnd));
                $sheet->setCellValue('A1', "OT Hours Export — {$from} to {$to}");
                $sheet->getStyle('A1')->applyFromArray([
                    'font'      => ['bold' => true, 'size' => 13, 'color' => ['rgb' => 'FFFFFF']],
                    'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '4472C4']],
                    'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
                ]);
                $sheet->getRowDimension(1)->setRowHeight(24);

                // Header row styling (now row 2)
                $sheet->getStyle('A2:D2')->applyFromArray([
                    'font'      => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
                    'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '2E75B6']],
                    'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
                ]);

                // Zebra striping + borders on data rows
                for ($r = 3; $r <= $lastRow + 1; $r++) {
                    if ($r % 2 === 0) {
                        $sheet->getStyle("A{$r}:D{$r}")->applyFromArray([
                            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'EEF4FF']],
                        ]);
                    }
                    // Right-align the numeric column
                    $sheet->getStyle("D{$r}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
                }

                $sheet->getStyle('A2:D' . ($lastRow + 1))->applyFromArray([
                    'borders' => ['allBorders' => ['borderStyle' => 'thin', 'color' => ['rgb' => 'D0D7E2']]],
                ]);
            },
        ];
    }
}
