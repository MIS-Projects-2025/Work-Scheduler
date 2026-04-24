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
    nonEditableColumns = 6, // First 6 columns are not editable
    stickyColumns = 2, // First 2 columns (Emp ID and Employee Name) are sticky
    shiftMap = {},
    shiftOptions = [],
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

    // Calculate column widths based on content (in pixels)
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

        // Return width in pixels (8px per character, min 100px, max 250px)
        return Math.min(Math.max(maxLength * 8, 100), 250);
    };

    // Calculate cumulative left position for sticky columns
    const getStickyLeftPosition = (columnIndex) => {
        let leftPosition = 0;
        for (let i = 0; i < columnIndex; i++) {
            leftPosition += getColumnWidth(i);
        }
        return leftPosition;
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
        const isNonEditable = colIndex < nonEditableColumns;
        const isHeaderRow = showHeader && rowIndex === 0;
        // Only allow editing if not in non-editable columns and not in header row
        if (editable && !isNonEditable && !isHeaderRow) {
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

    const getHeaderName = () => {
        if (editingCell.colIndex !== null && headers[editingCell.colIndex]) {
            return headers[editingCell.colIndex];
        }
        return "Cell";
    };

    const previewStyle = getCellStyle(selectedShift);

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
                <table className="border-collapse text-sm min-w-max">
                    <thead
                        className="bg-gray-100"
                        style={{
                            position: "sticky",
                            top: 0,
                            zIndex: 40,
                        }}
                    >
                        {showHeader && headers.length > 0 && (
                            <tr>
                                {headers.map((header, idx) => {
                                    const isSticky = idx < stickyColumns;
                                    const width = getColumnWidth(idx);
                                    const leftPosition = isSticky
                                        ? getStickyLeftPosition(idx)
                                        : 0;

                                    return (
                                        <th
                                            key={`header-${idx}`}
                                            className="border p-2 whitespace-nowrap font-bold"
                                            style={{
                                                backgroundColor: "#f3f4f6",
                                                width: `${width}px`,
                                                minWidth: `${width}px`,
                                                maxWidth: `${width}px`,
                                                position: isSticky
                                                    ? "sticky"
                                                    : "relative",
                                                left: isSticky
                                                    ? `${leftPosition}px`
                                                    : "auto",
                                                zIndex: isSticky ? 30 : 20,
                                                boxShadow: isSticky
                                                    ? "2px 0 5px -2px rgba(0,0,0,0.1)"
                                                    : "none",
                                            }}
                                        >
                                            {header}
                                        </th>
                                    );
                                })}
                            </tr>
                        )}
                    </thead>
                    <tbody>
                        {data.map((row, rowIdx) => (
                            <tr key={`row-${rowIdx}`}>
                                {row.map((cell, colIdx) => {
                                    const isSticky = colIdx < stickyColumns;
                                    const isNonEditable =
                                        colIdx < nonEditableColumns;
                                    const cellStyle = getCellStyle(cell);
                                    const width = getColumnWidth(colIdx);
                                    const leftPosition = isSticky
                                        ? getStickyLeftPosition(colIdx)
                                        : 0;

                                    return (
                                        <td
                                            key={`cell-${rowIdx}-${colIdx}`}
                                            className={`border p-2 whitespace-nowrap ${
                                                editable && !isNonEditable
                                                    ? "cursor-pointer hover:bg-gray-50"
                                                    : ""
                                            }`}
                                            style={{
                                                ...cellStyle,
                                                width: `${width}px`,
                                                minWidth: `${width}px`,
                                                maxWidth: `${width}px`,
                                                position: isSticky
                                                    ? "sticky"
                                                    : "relative",
                                                left: isSticky
                                                    ? `${leftPosition}px`
                                                    : "auto",
                                                backgroundColor: isSticky
                                                    ? "#fafbfc"
                                                    : cellStyle.backgroundColor,
                                                boxShadow: isSticky
                                                    ? "2px 0 5px -2px rgba(0,0,0,0.1)"
                                                    : "none",
                                                zIndex: isSticky ? 10 : 1,
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
                                            title={
                                                isNonEditable
                                                    ? "This column is read-only"
                                                    : "Double-click to edit"
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
                                Double-click any editable cell to edit. First{" "}
                                {nonEditableColumns} columns are read-only.
                            </p>
                        </div>

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
