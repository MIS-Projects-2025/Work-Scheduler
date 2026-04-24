import { useRef, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";

export default function ScheduleTableViewing({
    data = [],
    headers = [],
    frozenColumns = 2,
    shiftMap = {},
    shiftOptions = [], // Array of shift options { value: "6A6P", label: "6A6P - AMS Day Shift" }
    maxHeight = "60vh",
    showHeader = true,
    className = "",
    onCellClick = null,
    editable = false,
    onCellChange = null,
}) {
    const tableContainerRef = useRef(null);
    const [editingCell, setEditingCell] = useState({
        open: false,
        rowIndex: null,
        colIndex: null,
        currentValue: "",
        originalValue: "",
    });
    const [selectedShift, setSelectedShift] = useState("");

    // Calculate column widths based on content
    const getColumnWidth = (columnIndex) => {
        let maxLength = 0;

        if (headers[columnIndex] && typeof headers[columnIndex] === "string") {
            maxLength = Math.max(maxLength, headers[columnIndex].length);
        }

        data.forEach((row) => {
            const cell = row[columnIndex];
            if (cell && typeof cell === "string") {
                maxLength = Math.max(maxLength, cell.length);
            } else if (cell) {
                maxLength = Math.max(maxLength, String(cell).length);
            }
        });

        return `${Math.min(Math.max(maxLength + 2, 8), 30)}ch`;
    };

    const getCellStyle = (cell) => {
        const style = shiftMap[cell];
        return {
            backgroundColor: style?.bg || "#ffffff",
            color: style?.color || "#000000",
            fontWeight: style ? "bold" : "normal",
        };
    };

    const handleCellClick = (rowIndex, colIndex, value) => {
        if (onCellClick) {
            onCellClick(rowIndex, colIndex, value);
        }
    };

    const handleCellDoubleClick = (rowIndex, colIndex, value) => {
        const isFrozen = colIndex < frozenColumns;
        const isHeaderRow = showHeader && rowIndex === 0;
        if (editable && !isFrozen && !isHeaderRow) {
            setEditingCell({
                open: true,
                rowIndex,
                colIndex,
                currentValue: value || "",
                originalValue: value || "",
            });
            setSelectedShift(value || "");
        }
    };

    const handleSaveEdit = () => {
        if (onCellChange && editable && selectedShift !== undefined) {
            onCellChange(
                editingCell.rowIndex,
                editingCell.colIndex,
                selectedShift,
            );
        }
        setEditingCell({
            open: false,
            rowIndex: null,
            colIndex: null,
            currentValue: "",
            originalValue: "",
        });
        setSelectedShift("");
    };

    const handleCancelEdit = () => {
        setEditingCell({
            open: false,
            rowIndex: null,
            colIndex: null,
            currentValue: "",
            originalValue: "",
        });
        setSelectedShift("");
    };

    // Get the header name for the dialog
    const getHeaderName = () => {
        if (editingCell.colIndex !== null && headers[editingCell.colIndex]) {
            return headers[editingCell.colIndex];
        }
        return "Cell";
    };

    // Preview the styling of the selected value
    const previewStyle = getCellStyle(selectedShift);

    // Find the label for the selected shift
    const getSelectedShiftLabel = () => {
        const shift = shiftOptions.find((s) => s.value === selectedShift);
        return shift ? shift.label : selectedShift;
    };

    return (
        <>
            <div
                ref={tableContainerRef}
                className={`overflow-auto border rounded-lg ${className}`}
                style={{ maxHeight }}
            >
                <div style={{ position: "relative" }}>
                    <table className="border-collapse text-sm w-full">
                        {showHeader && headers.length > 0 && (
                            <thead>
                                <tr>
                                    {headers.map((header, idx) => {
                                        const isFrozen = idx < frozenColumns;
                                        return (
                                            <th
                                                key={`header-${idx}`}
                                                className={`border p-2 whitespace-nowrap bg-gray-100 font-bold ${
                                                    isFrozen
                                                        ? "sticky left-0 z-20"
                                                        : ""
                                                }`}
                                                style={{
                                                    backgroundColor: "#f3f4f6",
                                                    ...(isFrozen && {
                                                        boxShadow:
                                                            "2px 0 5px -2px rgba(0,0,0,0.1)",
                                                    }),
                                                    minWidth:
                                                        getColumnWidth(idx),
                                                }}
                                            >
                                                {header}
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                        )}
                        <tbody>
                            {data.map((row, rowIdx) => (
                                <tr key={`row-${rowIdx}`}>
                                    {row.map((cell, colIdx) => {
                                        const isFrozen = colIdx < frozenColumns;
                                        const cellStyle = getCellStyle(cell);

                                        return (
                                            <td
                                                key={`cell-${rowIdx}-${colIdx}`}
                                                className={`border p-2 whitespace-nowrap ${
                                                    editable && !isFrozen
                                                        ? "cursor-pointer hover:bg-gray-50"
                                                        : ""
                                                } ${isFrozen ? "sticky left-0 z-10 bg-gray-50" : ""}`}
                                                style={{
                                                    ...cellStyle,
                                                    ...(isFrozen && {
                                                        boxShadow:
                                                            "2px 0 5px -2px rgba(0,0,0,0.1)",
                                                    }),
                                                    minWidth:
                                                        getColumnWidth(colIdx),
                                                }}
                                                onClick={() =>
                                                    handleCellClick(
                                                        rowIdx,
                                                        colIdx,
                                                        cell,
                                                    )
                                                }
                                                onDoubleClick={() =>
                                                    handleCellDoubleClick(
                                                        rowIdx,
                                                        colIdx,
                                                        cell,
                                                    )
                                                }
                                            >
                                                {cell}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Edit Dialog with Combobox */}
            <Dialog open={editingCell.open} onOpenChange={handleCancelEdit}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Schedule</DialogTitle>
                        <DialogDescription>
                            Select a shift code for {getHeaderName()}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="shiftCode">Shift Code</Label>
                            <Combobox
                                options={shiftOptions}
                                value={selectedShift}
                                onChange={setSelectedShift}
                                placeholder="Search or select shift code..."
                                emptyMessage="No shift codes found."
                            />
                            <p className="text-xs text-muted-foreground">
                                Double-click any cell to edit. Select from the
                                dropdown to avoid typing errors.
                            </p>
                        </div>

                        {/* Preview of the selected value */}
                        {selectedShift && (
                            <div className="space-y-2">
                                <Label>Preview</Label>
                                <div
                                    className="p-3 rounded border text-center font-mono font-bold"
                                    style={previewStyle}
                                >
                                    {selectedShift}
                                    <span className="ml-2 text-xs font-normal">
                                        {getSelectedShiftLabel()}
                                    </span>
                                </div>
                                <p className="text-xs text-green-600">
                                    ✓ Valid shift code with styling
                                </p>
                            </div>
                        )}

                        {/* Show current value info */}
                        <div className="text-xs text-muted-foreground border-t pt-3">
                            <div>
                                Current value:
                                <span
                                    className="inline-block ml-2 px-2 py-0.5 rounded text-xs font-mono font-bold"
                                    style={getCellStyle(
                                        editingCell.currentValue,
                                    )}
                                >
                                    {editingCell.currentValue || "(empty)"}
                                </span>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={handleCancelEdit}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSaveEdit}
                            disabled={!selectedShift}
                        >
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
