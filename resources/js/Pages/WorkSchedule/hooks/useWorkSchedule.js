import { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { validateSchedules } from "../helpers/scheduleValidation";
import {
    buildScheduleFromRow,
    getPayrollPeriodDays,
} from "../helpers/scheduleHelpers";

export function useWorkSchedule({
    cutoffList,
    employees,
    shifts,
    onSubmitSchedule,
}) {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [selectedCutoff, setSelectedCutoff] = useState("");
    const [selectedCutoffData, setSelectedCutoffData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [downloadComplete, setDownloadComplete] = useState(false);
    const [legendCollapsed, setLegendCollapsed] = useState(false);

    const [file, setFile] = useState(null);
    const [employeeData, setEmployeeData] = useState([]);
    const [employeeHeaders, setEmployeeHeaders] = useState([]);
    const [cutoffText, setCutoffText] = useState("");
    const [editedCells, setEditedCells] = useState(new Set());
    const [validationErrors, setValidationErrors] = useState([]);

    const [resultModalOpen, setResultModalOpen] = useState(false);
    const [submitResult, setSubmitResult] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

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
                id: s.id,
                bg: bgColor || "#FFFFFF",
                color: fontColor || "#000000",
                desc: s.shiftcode_desc || "",
            };
        });
        return map;
    }, [shifts]);

    const shiftOptions = useMemo(
        () =>
            shifts.map((s) => ({
                value: s.shiftcode,
                label: `${s.shiftcode} - ${s.shiftcode_desc}`,
            })),
        [shifts],
    );

    const formatDisplayDate = (dateStr) => {
        const [y, m, d] = dateStr.split("-").map(Number);
        return new Date(y, m - 1, d).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
        });
    };

    const cutoffOptions = useMemo(() => {
        if (!Array.isArray(cutoffList)) return [];
        return cutoffList.map((c) => ({
            value: c.ID?.toString() || c.id?.toString(),
            label: `${formatDisplayDate(c.payroll_date_start)} → ${formatDisplayDate(c.payroll_date_end)}`,
            start: c.payroll_date_start,
            end: c.payroll_date_end,
        }));
    }, [cutoffList]);

    useEffect(() => {
        if (cutoffOptions.length > 0) {
            setSelectedCutoff(cutoffOptions[0].value);
            setSelectedCutoffData(cutoffOptions[0]);
        }
    }, [cutoffOptions]);

    const handleCutoffChange = (value) => {
        const newCutoffData = cutoffOptions.find((opt) => opt.value === value);

        setSelectedCutoff(value);
        setSelectedCutoffData(newCutoffData);

        // Force reset EVERYTHING
        setFile(null);
        setEmployeeData([]);
        setEmployeeHeaders([]);
        setCutoffText("");
        setEditedCells(new Set());
        setValidationErrors([]);
        setSubmitResult(null);

        // Clear the file input element
        const fileInput = document.querySelector('input[type="file"]');
        if (fileInput) fileInput.value = "";

        toast.info(
            "Cutoff changed. Please upload a schedule for the new cutoff period.",
        );
    };

    const runValidation = (data, headers, cutoffData) => {
        if (!data || data.length === 0 || !headers || !cutoffData) {
            return { errors: [] };
        }
        const validation = validateSchedules(
            data,
            headers,
            cutoffData.start,
            cutoffData.end,
            employees,
            shiftMap,
        );
        setValidationErrors(validation.errors);
        return validation;
    };

    const parseFile = async (uploaded) => {
        if (!uploaded) {
            return;
        }

        if (!selectedCutoffData) {
            toast.error("Please select a cutoff period first");
            return;
        }

        // Clear previous state FIRST before any validation
        setFile(null);
        setEmployeeData([]);
        setEmployeeHeaders([]);
        setCutoffText("");
        setEditedCells(new Set());
        setValidationErrors([]);

        try {
            const buffer = await uploaded.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: "array" });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(sheet, {
                header: 1,
                defval: "",
            });

            let headersRow = null;
            let dataStartRow = -1;
            let parsedCutoffText = "";

            for (let i = 0; i < json.length; i++) {
                const row = json[i];
                if (!row?.length) continue;
                const first = String(row[0] ?? "").toLowerCase();

                if (first.includes("cutoff:")) {
                    parsedCutoffText = row[0];
                    continue;
                }
                if (first.includes("emp id")) {
                    headersRow = row;
                    setEmployeeHeaders(row);
                    dataStartRow = i + 1;
                    break;
                }
            }

            // Check if cutoff in Excel matches selected cutoff
            if (parsedCutoffText) {
                const selectedLabel = `Cutoff: ${formatDate(selectedCutoffData.start)} to ${formatDate(selectedCutoffData.end)}`;
                const excelCutoff = parsedCutoffText.toString().trim();

                // Normalize both for comparison
                const normalize = (str) =>
                    str.replace(/\s+/g, " ").trim().toLowerCase();

                if (normalize(excelCutoff) !== normalize(selectedLabel)) {
                    setValidationErrors([
                        {
                            type: "cutoff_mismatch",
                            message: `Selected cutoff (${formatDate(selectedCutoffData.start)} → ${formatDate(selectedCutoffData.end)}) does not match the cutoff in the uploaded file (${parsedCutoffText}). Please select the correct cutoff period or upload the correct file.`,
                            isBlocking: true,
                        },
                    ]);
                    toast.error("Cutoff period mismatch");
                    return;
                }
            }

            const parsedData =
                dataStartRow !== -1
                    ? json
                          .slice(dataStartRow)
                          .filter(
                              (row) =>
                                  row[0] && row[0].toString().trim() !== "",
                          )
                    : [];

            setFile(uploaded);
            setCutoffText(parsedCutoffText);
            setEmployeeData(parsedData);

            if (parsedData.length > 0 && headersRow) {
                const validation = runValidation(
                    parsedData,
                    headersRow,
                    selectedCutoffData,
                );
                if (validation.errors.length > 0) {
                    toast.error(
                        "Validation failed. Please check the errors below.",
                    );
                } else {
                    toast.success("File validated successfully!");
                }
            }
        } catch (error) {
            console.error("Error parsing file:", error);
            toast.error("Error reading file. Please try again.");
            setValidationErrors([
                {
                    type: "parse_error",
                    message:
                        "Failed to read the Excel file. Please check the file format.",
                    isBlocking: true,
                },
            ]);
        }
    };

    const handleFileChange = (e) => parseFile(e.target.files[0]);

    const handleCellEdit = (rowIndex, colIndex, newValue) => {
        setEditedCells((prev) => new Set([...prev, `${rowIndex}-${colIndex}`]));
        setEmployeeData((prev) => {
            const updated = prev.map((r) => [...r]);
            updated[rowIndex][colIndex] = newValue;
            if (selectedCutoffData && employeeHeaders.length > 0) {
                runValidation(updated, employeeHeaders, selectedCutoffData);
            }
            return updated;
        });
    };

    const handleReset = () => {
        if (file) {
            parseFile(file);
            toast.success("Schedule reset to original version");
        } else {
            toast.error("No file to reset");
        }
    };

    const handleDownload = () => {
        if (!selectedCutoff) {
            toast.error("Select a cutoff period first");
            return;
        }
        setIsLoading(true);
        setTimeout(() => {
            setIsLoading(false);
            setDownloadComplete(true);
            toast.success("Template is being downloaded");
            setTimeout(() => setDownloadComplete(false), 2000);
        }, 1000);
    };

    const handleSubmit = async () => {
        if (employeeData.length === 0) {
            toast.error("Please upload a file first");
            return;
        }

        if (validationErrors.length > 0) {
            toast.error("Please fix validation errors before submitting");
            return;
        }

        if (!selectedCutoffData) {
            toast.error("Please select a cutoff period");
            return;
        }

        setIsSubmitting(true);

        try {
            const totalDays = getPayrollPeriodDays(
                selectedCutoffData.start,
                selectedCutoffData.end,
            );
            const scheduleStartCol = 6;

            const employeesData = employeeData.map((row) => {
                const availableDayCols =
                    employeeHeaders.length - scheduleStartCol;
                const daysToProcess = Math.min(totalDays, availableDayCols);
                const schedule = {};

                for (let i = 0; i < daysToProcess; i++) {
                    const value = row[scheduleStartCol + i];
                    if (
                        value !== undefined &&
                        value !== null &&
                        value.toString().trim() !== ""
                    ) {
                        const shiftCode = value.toString().trim();
                        const shiftEntry = shiftMap[shiftCode];
                        schedule[(i + 1).toString()] = shiftEntry
                            ? shiftEntry.id
                            : shiftCode;
                    }
                }

                return {
                    empId: row[0]?.toString() || "",
                    empName: row[1] || "",
                    department: row[2] || "",
                    prodLine: row[3] || "",
                    team: row[4] || "",
                    shiftType: row[5] || "",
                    schedule,
                    formattedStartDate: selectedCutoffData.start,
                    formattedEndDate: selectedCutoffData.end,
                };
            });

            const result = onSubmitSchedule
                ? await onSubmitSchedule({
                      employees: employeesData,
                      cutoff_id: selectedCutoff,
                  })
                : {
                      status: "success",
                      saved: employeesData.map((e) => e.empId),
                      overwritten: [],
                      skipped: [],
                      unauthorized: [],
                  };

            setSubmitResult(result);
            setResultModalOpen(true);

            if (result.status === "success") {
                toast.success(
                    `${result.saved?.length || 0} schedules saved successfully`,
                );
                // Clear the form after successful submission
                setFile(null);
                setEmployeeData([]);
                setEmployeeHeaders([]);
                setCutoffText("");
                setEditedCells(new Set());
                setValidationErrors([]);
                // Clear file input
                const fileInput = document.querySelector('input[type="file"]');
                if (fileInput) fileInput.value = "";
            } else if (result.status === "warning") {
                toast.warning(result.error || "Some schedules were skipped");
            } else {
                toast.error(result.error || "Failed to save schedules");
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to submit schedules");
            setSubmitResult({ status: "error", error: err.message });
            setResultModalOpen(true);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResultClose = () => {
        setResultModalOpen(false);
        setSubmitResult(null);
    };

    const toggleFullscreen = () => {
        if (!isFullscreen) document.documentElement.requestFullscreen?.();
        else document.exitFullscreen?.();
        setIsFullscreen((prev) => !prev);
    };

    return {
        // state
        isFullscreen,
        selectedCutoff,
        selectedCutoffData,
        isLoading,
        downloadComplete,
        legendCollapsed,
        setLegendCollapsed,
        file,
        employeeData,
        employeeHeaders,
        cutoffText,
        editedCells,
        validationErrors,
        resultModalOpen,
        submitResult,
        isSubmitting,
        // derived
        shiftMap,
        shiftOptions,
        cutoffOptions,
        hasData: employeeData.length > 0,
        // handlers
        handleCutoffChange,
        handleFileChange,
        handleCellEdit,
        handleReset,
        handleDownload,
        handleSubmit,
        handleResultClose,
        toggleFullscreen,
    };
}

function formatDate(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
    });
}
