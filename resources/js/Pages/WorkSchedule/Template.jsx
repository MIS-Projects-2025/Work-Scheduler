import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head } from "@inertiajs/react";
import { useState, useEffect, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

import {
    FileSpreadsheet,
    Download,
    Loader2,
    CheckCircle2,
    Upload,
    Save,
    RotateCcw,
    Maximize2,
    Minimize2,
    ArrowLeft,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import ScheduleTableViewing from "./ScheduleTableViewing";

export default function WorkScheduleTemplate({
    cutoffList,
    employees = [],
    shifts = [],
}) {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [selectedCutoff, setSelectedCutoff] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [downloadComplete, setDownloadComplete] = useState(false);
    const [legendCollapsed, setLegendCollapsed] = useState(false);

    const [file, setFile] = useState(null);
    const [employeeData, setEmployeeData] = useState([]);
    const [employeeHeaders, setEmployeeHeaders] = useState([]);
    const [legendRows, setLegendRows] = useState([]);
    const [cutoffText, setCutoffText] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editedCells, setEditedCells] = useState(new Set());

    // Shift map with descriptions
    const shiftMap = useMemo(() => {
        const map = {};
        (shifts || []).forEach((s) => {
            let bgColor = s.shiftcode_bg_color;
            let fontColor = s.shiftcode_font_color;
            if (bgColor && /^[0-9A-Fa-f]{6}$/.test(bgColor))
                bgColor = `#${bgColor}`;
            if (fontColor && /^[0-9A-Fa-f]{6}$/.test(fontColor))
                fontColor = `#${fontColor}`;
            map[s.shiftcode] = {
                bg: bgColor || "#FFFFFF",
                color: fontColor || "#000000",
                desc: s.shiftcode_desc || "",
            };
        });
        return map;
    }, [shifts]);

    const shiftOptions = useMemo(
        () =>
            shifts.map((shift) => ({
                value: shift.shiftcode,
                label: `${shift.shiftcode} - ${shift.shiftcode_desc}`,
            })),
        [shifts],
    );

    // Cutoff options
    const cutoffOptions = useMemo(() => {
        if (!Array.isArray(cutoffList)) return [];
        return cutoffList.map((c) => ({
            value: c.ID.toString(),
            label: `${c.payroll_date_start} → ${c.payroll_date_end}`,
        }));
    }, [cutoffList]);

    useEffect(() => {
        if (cutoffOptions.length > 0) setSelectedCutoff(cutoffOptions[0].value);
    }, [cutoffOptions]);

    // Handle fullscreen toggle
    const toggleFullscreen = useCallback(() => {
        if (!isFullscreen) {
            const elem = document.documentElement;
            if (elem.requestFullscreen) {
                elem.requestFullscreen();
            } else if (elem.webkitRequestFullscreen) {
                elem.webkitRequestFullscreen();
            } else if (elem.msRequestFullscreen) {
                elem.msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
        setIsFullscreen(!isFullscreen);
    }, [isFullscreen]);

    // Listen for fullscreen change events
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener("fullscreenchange", handleFullscreenChange);
        document.addEventListener(
            "webkitfullscreenchange",
            handleFullscreenChange,
        );
        document.addEventListener("msfullscreenchange", handleFullscreenChange);

        return () => {
            document.removeEventListener(
                "fullscreenchange",
                handleFullscreenChange,
            );
            document.removeEventListener(
                "webkitfullscreenchange",
                handleFullscreenChange,
            );
            document.removeEventListener(
                "msfullscreenchange",
                handleFullscreenChange,
            );
        };
    }, []);

    // Download template
    const handleDownload = () => {
        if (!selectedCutoff) return;
        setIsLoading(true);
        setDownloadComplete(false);
        const params = new URLSearchParams({ cutoff_id: selectedCutoff });
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

    // Parse Excel
    const parseFile = async (uploaded) => {
        if (!uploaded) return;
        setFile(uploaded);

        // Clear edited cells when loading new file
        setEditedCells(new Set());

        const buffer = await uploaded.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

        let legendStartRow = -1;
        let cutoffRow = -1;
        let dataStartRow = -1;

        for (let i = 0; i < json.length; i++) {
            const row = json[i];
            if (!row?.length) continue;
            const first = row[0] ? String(row[0]).toLowerCase() : "";

            if (first.includes("shift code legend")) {
                legendStartRow = i;
                continue;
            }
            if (first.includes("cutoff:")) {
                cutoffRow = i;
                setCutoffText(row[0]);
                continue;
            }
            if (
                row[0] === "Emp ID" ||
                String(row[0] ?? "").includes("Emp ID")
            ) {
                setEmployeeHeaders(row);
                dataStartRow = i + 1;
                break;
            }
        }

        if (legendStartRow !== -1 && cutoffRow !== -1) {
            setLegendRows(json.slice(legendStartRow, cutoffRow));
        }

        if (dataStartRow !== -1) {
            setEmployeeData(json.slice(dataStartRow));
        }
    };

    const handleFileChange = (e) => parseFile(e.target.files[0]);

    const handleCellEdit = (rowIndex, colIndex, newValue) => {
        // Track that this cell was edited
        const cellKey = `${rowIndex}-${colIndex}`;
        setEditedCells((prev) => new Set([...prev, cellKey]));

        setEmployeeData((prev) => {
            const updated = prev.map((r) => [...r]);
            updated[rowIndex][colIndex] = newValue;
            return updated;
        });
    };

    const handleReset = () => {
        if (file) {
            // Clear edited cells tracking
            setEditedCells(new Set());
            // Reload the file
            parseFile(file);
        }
    };

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
            const submitData = {
                cutoff_id: selectedCutoff,
                headers: employeeHeaders,
                data: employeeData,
            };
            await route("workschedule.template.submit", submitData);
            alert("Schedule submitted successfully!");
        } catch (error) {
            console.error("Error submitting schedule:", error);
            alert("Error submitting schedule. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Render legend from parsed Excel rows with collapsible and tooltips
    const renderLegend = () => {
        if (!shifts?.length) return null;

        const codes = shifts.filter((s) => s.shiftcode);
        const codesPerRow = 6;

        if (legendCollapsed) {
            return (
                <div className="rounded-md border bg-muted/30 mb-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setLegendCollapsed(false)}
                        className="w-full justify-between px-4 py-2 h-auto"
                    >
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Shift Code Legend ({codes.length} codes)
                        </span>
                        <ChevronDown className="w-4 h-4" />
                    </Button>
                </div>
            );
        }

        return (
            <div className="rounded-md border bg-muted/30 overflow-auto mb-4">
                <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Shift Code Legend ({codes.length} codes)
                    </p>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setLegendCollapsed(true)}
                        className="h-6 w-6 p-0"
                    >
                        <ChevronUp className="w-4 h-4" />
                    </Button>
                </div>
                <Table>
                    <TableBody>
                        {Array.from({
                            length: Math.ceil(codes.length / codesPerRow),
                        }).map((_, rowIdx) => {
                            const rowCodes = codes.slice(
                                rowIdx * codesPerRow,
                                (rowIdx + 1) * codesPerRow,
                            );
                            return (
                                <TableRow key={`legend-row-${rowIdx}`}>
                                    {rowCodes.map((code, colIdx) => {
                                        const style =
                                            shiftMap[code.shiftcode] ?? {};
                                        const description =
                                            style?.desc ||
                                            code.shiftcode_desc ||
                                            "";

                                        return (
                                            <TooltipProvider
                                                key={`legend-${rowIdx}-${colIdx}`}
                                            >
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <TableCell
                                                            className="text-center p-2 font-semibold text-sm cursor-help"
                                                            style={{
                                                                backgroundColor:
                                                                    style.bg ??
                                                                    undefined,
                                                                color:
                                                                    style.color ??
                                                                    undefined,
                                                            }}
                                                        >
                                                            <div>
                                                                {code.shiftcode}
                                                            </div>
                                                            <div className="text-xs font-normal opacity-75 mt-0.5">
                                                                {description.length >
                                                                30
                                                                    ? description.substring(
                                                                          0,
                                                                          30,
                                                                      ) + "..."
                                                                    : description}
                                                            </div>
                                                        </TableCell>
                                                    </TooltipTrigger>
                                                    <TooltipContent
                                                        side="top"
                                                        className="max-w-xs"
                                                    >
                                                        <p className="text-xs">
                                                            <span className="font-semibold">
                                                                {code.shiftcode}
                                                            </span>
                                                            <br />
                                                            {description}
                                                        </p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        );
                                    })}
                                    {rowCodes.length < codesPerRow &&
                                        Array.from({
                                            length:
                                                codesPerRow - rowCodes.length,
                                        }).map((_, i) => (
                                            <TableCell
                                                key={`pad-${rowIdx}-${i}`}
                                            />
                                        ))}
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        );
    };

    const hasData = employeeData.length > 0;

    // Main content component
    const MainContent = () => (
        <div className={`${isFullscreen ? "bg-background min-h-screen" : ""}`}>
            {/* Header */}
            <div
                className={`border-b bg-card ${isFullscreen ? "sticky top-0 z-50 px-6 py-4" : "px-6 py-4"}`}
            >
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground">
                            <FileSpreadsheet className="w-6 h-6 text-primary" />
                            Work Schedule Template
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Download, upload, edit, and submit your work
                            schedule Excel file.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {!isFullscreen && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.history.back()}
                                className="gap-2"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Back
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={toggleFullscreen}
                            className="gap-2"
                        >
                            {isFullscreen ? (
                                <>
                                    <Minimize2 className="w-4 h-4" />
                                    Exit Fullscreen
                                </>
                            ) : (
                                <>
                                    <Maximize2 className="w-4 h-4" />
                                    Full Screen
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>

            <div className={`${isFullscreen ? "p-6" : "p-6"} space-y-6`}>
                <Separator />

                {/* Step 1 & 2 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Badge
                                    variant="outline"
                                    className="rounded-full w-6 h-6 p-0 flex items-center justify-center text-xs font-bold"
                                >
                                    1
                                </Badge>
                                Select Cutoff
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Combobox
                                options={cutoffOptions}
                                value={selectedCutoff}
                                onChange={setSelectedCutoff}
                                placeholder="Select cutoff period…"
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Badge
                                    variant="outline"
                                    className="rounded-full w-6 h-6 p-0 flex items-center justify-center text-xs font-bold"
                                >
                                    2
                                </Badge>
                                Download Template
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Button
                                onClick={handleDownload}
                                disabled={!selectedCutoff || isLoading}
                                className="w-full"
                                variant={
                                    downloadComplete ? "secondary" : "default"
                                }
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />{" "}
                                        Preparing…
                                    </>
                                ) : downloadComplete ? (
                                    <>
                                        <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />{" "}
                                        Download Started
                                    </>
                                ) : (
                                    <>
                                        <Download className="w-4 h-4 mr-2" />{" "}
                                        Download Excel
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Step 3 */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Badge
                                variant="outline"
                                className="rounded-full w-6 h-6 p-0 flex items-center justify-center text-xs font-bold"
                            >
                                3
                            </Badge>
                            Upload &amp; Edit Schedule
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Upload zone */}
                        <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/20 p-6 text-center cursor-pointer hover:bg-muted/40 transition-colors">
                            <Upload className="w-6 h-6 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                                Click to upload an Excel file (.xlsx / .xls)
                            </span>
                            <input
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            {file && (
                                <Badge variant="secondary" className="mt-1">
                                    {file.name}
                                </Badge>
                            )}
                        </label>

                        {hasData && (
                            <div className="space-y-4">
                                {/* Cutoff label */}
                                {cutoffText && (
                                    <div className="rounded-md border bg-primary/5 px-4 py-2.5 text-center text-sm font-semibold text-primary">
                                        {cutoffText}
                                    </div>
                                )}

                                {/* Legend - Collapsible with tooltips */}
                                {renderLegend()}

                                {/* Editable table */}
                                <ScheduleTableViewing
                                    data={employeeData}
                                    headers={employeeHeaders}
                                    frozenColumns={6}
                                    stickyColumns={2}
                                    shiftMap={shiftMap}
                                    shiftOptions={shiftOptions}
                                    maxHeight={
                                        isFullscreen
                                            ? "calc(100vh - 400px)"
                                            : "60vh"
                                    }
                                    editable={true}
                                    onCellChange={handleCellEdit}
                                    editedCells={editedCells}
                                />

                                {/* Actions */}
                                <div className="flex justify-end gap-3 pt-2">
                                    <Button
                                        variant="outline"
                                        onClick={handleReset}
                                    >
                                        <RotateCcw className="w-4 h-4 mr-2" />
                                        Reset
                                    </Button>
                                    <Button
                                        onClick={handleSubmit}
                                        disabled={isSubmitting}
                                        className="bg-green-600 hover:bg-green-700 text-white"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin mr-2" />{" "}
                                                Submitting…
                                            </>
                                        ) : (
                                            <>
                                                <Save className="w-4 h-4 mr-2" />{" "}
                                                Submit Schedule
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );

    // Return with or without layout based on fullscreen mode
    return isFullscreen ? (
        <>
            <Head title="Work Schedule Template - Fullscreen" />
            <MainContent />
        </>
    ) : (
        <AuthenticatedLayout>
            <Head title="Work Schedule Template" />
            <MainContent />
        </AuthenticatedLayout>
    );
}
