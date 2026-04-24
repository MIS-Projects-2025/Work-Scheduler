import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head } from "@inertiajs/react";
import { useState, useEffect, useMemo } from "react";

import * as XLSX from "xlsx";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";

import {
    FileSpreadsheet,
    Download,
    Loader2,
    CheckCircle2,
    Upload,
    Save,
} from "lucide-react";
import ScheduleTableViewing from "./ScheduleTableViewing";

export default function WorkScheduleTemplate({
    cutoffList,
    employees = [],
    shifts = [],
}) {
    const [selectedCutoff, setSelectedCutoff] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [downloadComplete, setDownloadComplete] = useState(false);

    // STEP 3
    const [file, setFile] = useState(null);
    const [rawRows, setRawRows] = useState([]);
    const [employeeData, setEmployeeData] = useState([]);
    const [employeeHeaders, setEmployeeHeaders] = useState([]);
    const [legendRows, setLegendRows] = useState([]);
    const [cutoffText, setCutoffText] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // -----------------------------
    // SHIFT CODE MAP (for styling)
    // -----------------------------
    const shiftMap = useMemo(() => {
        const map = {};
        (shifts || []).forEach((s) => {
            let bgColor = s.shiftcode_bg_color;
            let fontColor = s.shiftcode_font_color;

            if (bgColor && /^[0-9A-Fa-f]{6}$/.test(bgColor)) {
                bgColor = `#${bgColor}`;
            }
            if (fontColor && /^[0-9A-Fa-f]{6}$/.test(fontColor)) {
                fontColor = `#${fontColor}`;
            }

            bgColor = bgColor || "#FFFFFF";
            fontColor = fontColor || "#000000";

            map[s.shiftcode] = {
                bg: bgColor,
                color: fontColor,
            };
        });
        return map;
    }, [shifts]);
    const shiftOptions = useMemo(() => {
        return shifts.map((shift) => ({
            value: shift.shiftcode,
            label: `${shift.shiftcode} - ${shift.shiftcode_desc}`,
        }));
    }, [shifts]);

    // -----------------------------
    // CUTOFF OPTIONS
    // -----------------------------
    const cutoffOptions = useMemo(() => {
        if (!cutoffList || !Array.isArray(cutoffList)) return [];

        return cutoffList.map((c) => ({
            value: c.ID.toString(),
            label: `${c.payroll_date_start} → ${c.payroll_date_end}`,
        }));
    }, [cutoffList]);

    useEffect(() => {
        if (cutoffOptions.length > 0) {
            setSelectedCutoff(cutoffOptions[0].value);
        }
    }, [cutoffOptions]);

    // -----------------------------
    // DOWNLOAD TEMPLATE
    // -----------------------------
    const handleDownload = async () => {
        if (!selectedCutoff) return;

        setIsLoading(true);
        setDownloadComplete(false);

        const params = new URLSearchParams({
            cutoff_id: selectedCutoff,
        });

        window.open(
            route("workschedule.template.download") + "?" + params.toString(),
            "_blank",
        );

        setTimeout(() => {
            setIsLoading(false);
            setDownloadComplete(true);
            setTimeout(() => setDownloadComplete(false), 2000);
        }, 1000);
    };

    // -----------------------------
    // PARSE EXCEL
    // -----------------------------
    const handleFileChange = async (e) => {
        const uploaded = e.target.files[0];
        if (!uploaded) return;

        setFile(uploaded);

        const buffer = await uploaded.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });

        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            defval: "",
        });

        setRawRows(json);

        let legendStartRow = -1;
        let cutoffRow = -1;
        let headerRow = -1;
        let dataStartRow = -1;

        for (let i = 0; i < json.length; i++) {
            const row = json[i];
            if (!row || row.length === 0) continue;

            const firstCell = row[0] ? String(row[0]).toLowerCase() : "";

            if (firstCell.includes("shift code legend")) {
                legendStartRow = i;
                continue;
            }

            if (firstCell.includes("cutoff:")) {
                cutoffRow = i;
                setCutoffText(row[0]);
                continue;
            }

            if (
                row[0] === "Emp ID" ||
                (row[0] && String(row[0]).includes("Emp ID"))
            ) {
                headerRow = i;
                setEmployeeHeaders(row);
                dataStartRow = i + 1;
                break;
            }
        }

        if (legendStartRow !== -1 && cutoffRow !== -1) {
            const legendData = json.slice(legendStartRow, cutoffRow);
            setLegendRows(legendData);
        }

        if (dataStartRow !== -1) {
            const data = json.slice(dataStartRow);
            setEmployeeData(data);
        }
    };

    // -----------------------------
    // HANDLE CELL EDIT
    // -----------------------------
    const handleCellEdit = (rowIndex, colIndex, newValue) => {
        const updatedData = [...employeeData];
        updatedData[rowIndex][colIndex] = newValue;
        setEmployeeData(updatedData);
    };

    // -----------------------------
    // HANDLE SUBMIT
    // -----------------------------
    const handleSubmit = async () => {
        if (!selectedCutoff) {
            alert("Please select a cutoff period");
            return;
        }

        if (employeeData.length === 0) {
            alert("No data to submit");
            return;
        }

        setIsSubmitting(true);

        try {
            // Prepare data for submission
            const submitData = {
                cutoff_id: selectedCutoff,
                headers: employeeHeaders,
                data: employeeData,
            };

            // Make API call to save the schedule
            const response = await route(
                "workschedule.template.submit",
                submitData,
            );

            alert("Schedule submitted successfully!");
        } catch (error) {
            console.error("Error submitting schedule:", error);
            alert("Error submitting schedule. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Render legend
    const renderLegend = () => {
        if (legendRows.length === 0) return null;

        return (
            <div className="mb-4 overflow-auto border rounded-lg bg-gray-50">
                <table className="border-collapse text-sm w-full">
                    <tbody>
                        {legendRows.map((row, rowIdx) => {
                            if (!row || row.every((cell) => !cell)) return null;

                            return (
                                <tr key={`legend-${rowIdx}`}>
                                    {row.map((cell, colIdx) => {
                                        if (!cell) return null;

                                        const cellStr = String(cell).trim();
                                        const isShiftCode =
                                            /^[A-Z0-9]{3,8}$/i.test(cellStr);
                                        const style = shiftMap[cellStr];

                                        return (
                                            <td
                                                key={`legend-${rowIdx}-${colIdx}`}
                                                className="border p-2"
                                                style={{
                                                    backgroundColor: isShiftCode
                                                        ? style?.bg || "#f9fafb"
                                                        : "#f9fafb",
                                                    color: isShiftCode
                                                        ? style?.color ||
                                                          "#000000"
                                                        : "#000000",
                                                    fontWeight: isShiftCode
                                                        ? "bold"
                                                        : "normal",
                                                }}
                                            >
                                                {cell}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <AuthenticatedLayout>
            <Head title="Work Schedule Template" />

            <div className="p-4 space-y-6">
                {/* HEADER */}
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <FileSpreadsheet className="w-6 h-6" />
                        Work Schedule Template
                    </h1>
                    <p className="text-muted-foreground">
                        Download, upload, edit, and submit work schedule Excel
                        file
                    </p>
                </div>

                {/* STEP 1 & 2 - SIDE BY SIDE */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border rounded-lg p-5">
                        <h2 className="font-semibold mb-2">
                            Step 1: Select Cutoff
                        </h2>
                        <Combobox
                            options={cutoffOptions}
                            value={selectedCutoff}
                            onChange={setSelectedCutoff}
                            placeholder="Select cutoff..."
                        />
                    </div>

                    <div className="border rounded-lg p-5">
                        <h2 className="font-semibold mb-3">
                            Step 2: Download Template
                        </h2>
                        <Button
                            onClick={handleDownload}
                            disabled={!selectedCutoff || isLoading}
                            className="w-full"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    Preparing...
                                </>
                            ) : downloadComplete ? (
                                <>
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    Download Started
                                </>
                            ) : (
                                <>
                                    <Download className="w-4 h-4 mr-2" />
                                    Download Excel
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                {/* STEP 3 - UPLOAD & PREVIEW */}
                <div className="border rounded-lg p-5">
                    <h2 className="font-semibold mb-3">
                        Step 3: Upload & Edit Schedule
                    </h2>

                    {/* UPLOAD */}
                    <div className="border-2 border-dashed rounded-lg p-5 text-center mb-4">
                        <Upload className="mx-auto mb-2 w-5 h-5" />
                        <input
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={handleFileChange}
                            className="text-sm"
                        />
                        {file && (
                            <p className="text-xs mt-2 text-muted-foreground">
                                {file.name}
                            </p>
                        )}
                    </div>

                    {/* PREVIEW & EDIT */}
                    {employeeData.length > 0 && (
                        <div className="mt-4">
                            {/* Cutoff Header */}
                            {cutoffText && (
                                <div className="mb-3 p-3 bg-blue-50 border rounded-lg text-center font-semibold">
                                    {cutoffText}
                                </div>
                            )}

                            {/* Legend Section */}
                            {renderLegend()}

                            {/* Editable Data Table */}
                            <div className="mb-4">
                                <ScheduleTableViewing
                                    data={employeeData}
                                    headers={employeeHeaders}
                                    frozenColumns={6}
                                    stickyColumns={2}
                                    shiftMap={shiftMap}
                                    shiftOptions={shiftOptions}
                                    maxHeight="60vh"
                                    editable={true}
                                    onCellChange={handleCellEdit}
                                />
                            </div>

                            {/* Submit Button */}
                            <div className="flex justify-end gap-3 mt-4">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        // Reset to original data
                                        handleFileChange({
                                            target: { files: [file] },
                                        });
                                    }}
                                >
                                    Reset
                                </Button>
                                <Button
                                    onClick={handleSubmit}
                                    disabled={isSubmitting}
                                    className="bg-green-600 hover:bg-green-700"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                            Submitting...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4 mr-2" />
                                            Submit Schedule
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
