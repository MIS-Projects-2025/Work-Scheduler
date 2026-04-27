import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableCell, TableRow } from "@/components/ui/table";
import { Loader2, Save } from "lucide-react";
import { getPayrollPeriodDays } from "../helpers/scheduleHelpers";

export default function PreviewModal({
    open,
    onClose,
    uploadedData,
    selectedCutoffData,
    file,
    isSubmitting,
    onSubmit,
}) {
    if (!uploadedData || !selectedCutoffData) return null;

    const totalDays = getPayrollPeriodDays(
        selectedCutoffData.start,
        selectedCutoffData.end,
    );
    const dates = Array.from({ length: totalDays }, (_, i) => {
        const d = new Date(selectedCutoffData.start);
        d.setDate(d.getDate() + i);
        return d;
    });

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>Schedule Preview & Confirmation</DialogTitle>
                    <DialogDescription>
                        Review schedules before saving. Period:{" "}
                        {selectedCutoffData.label}
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1">
                    <div className="space-y-4">
                        <Card>
                            <CardContent className="pt-4">
                                <div className="grid grid-cols-4 gap-4 text-sm">
                                    <div>
                                        <strong>Period:</strong>
                                        <p className="text-muted-foreground">
                                            {selectedCutoffData.label}
                                        </p>
                                    </div>
                                    <div>
                                        <strong>Total Employees:</strong>
                                        <Badge>
                                            {uploadedData.employees?.length ||
                                                0}
                                        </Badge>
                                    </div>
                                    <div>
                                        <strong>File:</strong>
                                        <p className="text-muted-foreground truncate">
                                            {file?.name}
                                        </p>
                                    </div>
                                    <div>
                                        <strong>Status:</strong>
                                        <Badge variant="default">
                                            Ready for Save
                                        </Badge>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="border rounded-md overflow-auto">
                            <Table>
                                <thead className="bg-muted sticky top-0">
                                    <TableRow>
                                        {[
                                            "Emp ID",
                                            "Name",
                                            "Dept",
                                            "Prod Line",
                                            "Team",
                                            "Shift Type",
                                        ].map((h) => (
                                            <th
                                                key={h}
                                                className="p-2 text-left font-semibold"
                                            >
                                                {h}
                                            </th>
                                        ))}
                                        {dates.map((date, idx) => (
                                            <th
                                                key={idx}
                                                className="p-2 text-center font-semibold text-xs"
                                            >
                                                {date.toLocaleDateString(
                                                    "en-US",
                                                    {
                                                        day: "2-digit",
                                                        month: "short",
                                                        weekday: "short",
                                                    },
                                                )}
                                            </th>
                                        ))}
                                    </TableRow>
                                </thead>
                                <tbody>
                                    {uploadedData.employees?.map((emp, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell className="p-2 font-mono">
                                                {emp.empId}
                                            </TableCell>
                                            <TableCell className="p-2">
                                                {emp.empName}
                                            </TableCell>
                                            <TableCell className="p-2">
                                                {emp.department}
                                            </TableCell>
                                            <TableCell className="p-2">
                                                {emp.prodLine}
                                            </TableCell>
                                            <TableCell className="p-2">
                                                {emp.team}
                                            </TableCell>
                                            <TableCell className="p-2">
                                                {emp.shiftType}
                                            </TableCell>
                                            {dates.map((_, dayIdx) => {
                                                const shiftId =
                                                    emp.schedule?.[
                                                        (dayIdx + 1).toString()
                                                    ];
                                                const shift =
                                                    uploadedData.shiftCodes?.[
                                                        shiftId
                                                    ];
                                                return (
                                                    <TableCell
                                                        key={dayIdx}
                                                        className="p-1 text-center"
                                                    >
                                                        {shift ? (
                                                            <span
                                                                className="inline-block px-2 py-1 rounded text-xs font-medium"
                                                                style={{
                                                                    backgroundColor:
                                                                        shift.SHIFTCODE_BG_COLOR
                                                                            ? `#${shift.SHIFTCODE_BG_COLOR}`
                                                                            : undefined,
                                                                    color: shift.SHIFTCODE_FONT_COLOR
                                                                        ? `#${shift.SHIFTCODE_FONT_COLOR}`
                                                                        : undefined,
                                                                }}
                                                            >
                                                                {
                                                                    shift.SHIFTCODE
                                                                }
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted-foreground text-xs">
                                                                -
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                );
                                            })}
                                        </TableRow>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    </div>
                </ScrollArea>

                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={onSubmit} disabled={isSubmitting}>
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4 mr-2" />
                                Confirm & Save
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
