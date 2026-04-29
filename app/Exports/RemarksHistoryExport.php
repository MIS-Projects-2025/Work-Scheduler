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

class RemarksHistoryExport implements FromCollection, WithHeadings, ShouldAutoSize, WithEvents
{
    use Exportable;

    public function __construct(
        private readonly array  $history,
        private readonly string $dateStart,
        private readonly string $dateEnd,
    ) {}

    public function headings(): array
    {
        return [
            'Employee ID',
            'Employee Name',
            'Operation',
            'Old Remarks',
            'New Remarks',
            'Updated By',
            'Date Updated',
        ];
    }

    public function collection(): Collection
    {
        $operationLabels = [
            'CREATE'      => 'Created',
            'UPDATE'      => 'Updated',
            'DELETE'      => 'Deleted',
            'APPROVE'     => 'Approved',
            'DISAPPROVE'  => 'Disapproved',
            'ACKNOWLEDGE' => 'Acknowledged',
        ];

        return collect($this->history)->map(fn($row) => [
            $row['emp_id'],
            $row['emp_name'],
            $operationLabels[$row['operation']] ?? $row['operation'],
            $row['old_remarks'] ?? '',
            $row['new_remarks'] ?? '',
            $row['updated_by_name'],
            $row['updated_at'],
        ]);
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet    = $event->sheet->getDelegate();
                $lastRow  = count($this->history) + 1;
                $lastCol  = 'G';

                // Title row inserted above headings
                $sheet->insertNewRowBefore(1, 1);
                $sheet->mergeCells("A1:{$lastCol}1");
                $from = date('M d, Y', strtotime($this->dateStart));
                $to   = date('M d, Y', strtotime($this->dateEnd));
                $sheet->setCellValue('A1', "Remarks History — {$from} to {$to}");
                $sheet->getStyle('A1')->applyFromArray([
                    'font'      => ['bold' => true, 'size' => 13, 'color' => ['rgb' => 'FFFFFF']],
                    'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '4472C4']],
                    'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
                ]);
                $sheet->getRowDimension(1)->setRowHeight(24);

                // Header row style (now row 2)
                $sheet->getStyle("A2:{$lastCol}2")->applyFromArray([
                    'font'      => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
                    'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '2E75B6']],
                    'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
                ]);

                // Zebra striping on data rows
                for ($r = 3; $r <= $lastRow + 1; $r++) {
                    if ($r % 2 === 0) {
                        $sheet->getStyle("A{$r}:{$lastCol}{$r}")->applyFromArray([
                            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'F2F7FF']],
                        ]);
                    }
                }

                // Borders on all data
                $sheet->getStyle("A2:{$lastCol}" . ($lastRow + 1))->applyFromArray([
                    'borders' => ['allBorders' => ['borderStyle' => 'thin', 'color' => ['rgb' => 'D0D7E2']]],
                ]);
            },
        ];
    }
}
