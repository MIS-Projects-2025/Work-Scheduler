import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head, router } from "@inertiajs/react";
import { useMemo, useState, useEffect } from "react";
import {
    FileSpreadsheet,
    Calendar,
    Clock,
    User,
    Maximize2,
    Minimize2,
    ArrowLeft,
    Search,
    Loader2,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import ScheduleTableViewing from "./ScheduleTableViewing";
import { Pagination } from "@/Components/Pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export default function WorkScheduleView({
    groupedData = [],
    shiftCodes = [],
    pagination = null,
    dateStart,
    dateEnd,
    filters = {},
}) {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [legendCollapsed, setLegendCollapsed] = useState(false);

    // Get current values from props
    const [search, setSearch] = useState(filters.search || "");
    const [perPage, setPerPage] = useState(filters.perPage || 20);

    // Debounce search
    useEffect(() => {
        const timeout = setTimeout(() => {
            if (search !== filters.search) {
                setLoading(true);
                router.get(
                    route("workschedule.view", {
                        created_by: groupedData[0]?.created_by,
                        date_start: dateStart,
                        date_end: dateEnd,
                        page: 1,
                        perPage: perPage,
                        search: search,
                    }),
                    {},
                    {
                        preserveState: true,
                        preserveScroll: true,
                        replace: true,
                        onFinish: () => setLoading(false),
                    },
                );
            }
        }, 500);

        return () => clearTimeout(timeout);
    }, [search]);

    // Handle per page change
    useEffect(() => {
        if (perPage !== filters.perPage) {
            setLoading(true);
            router.get(
                route("workschedule.view", {
                    created_by: groupedData[0]?.created_by,
                    date_start: dateStart,
                    date_end: dateEnd,
                    page: 1,
                    perPage: perPage,
                    search: search,
                }),
                {},
                {
                    preserveState: true,
                    preserveScroll: true,
                    replace: true,
                    onFinish: () => setLoading(false),
                },
            );
        }
    }, [perPage]);

    const goToPage = (page) => {
        if (page < 1 || (pagination && page > pagination.lastPage)) return;

        setLoading(true);
        router.get(
            route("workschedule.view", {
                created_by: groupedData[0]?.created_by,
                date_start: dateStart,
                date_end: dateEnd,
                page: page,
                perPage: perPage,
                search: search,
            }),
            {},
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                onFinish: () => setLoading(false),
            },
        );
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleSearch = (e) => {
        setSearch(e.target.value);
    };

    const handlePerPageChange = (value) => {
        setPerPage(Number(value));
    };

    const toggleFullscreen = () => {
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
    };

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

    const handleBack = () => {
        router.visit(route("workschedule.index"));
    };

    const shiftMap = useMemo(() => {
        const map = {};
        (shiftCodes || []).forEach((s) => {
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
    }, [shiftCodes]);

    const shiftOptions = useMemo(
        () =>
            (shiftCodes || []).map((shift) => ({
                value: shift.shiftcode,
                label: `${shift.shiftcode} - ${shift.shiftcode_desc}`,
            })),
        [shiftCodes],
    );

    const renderLegend = () => {
        if (!shiftCodes?.length) return null;
        const codes = shiftCodes.filter((s) => s.shiftcode);
        const codesPerRow = 6;

        if (legendCollapsed) {
            return (
                <div className="rounded-md border bg-muted/30">
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
            <div className="rounded-md border bg-muted/30 overflow-auto">
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
                                                                {code.shiftcode_desc?.substring(
                                                                    0,
                                                                    30,
                                                                )}
                                                                {code
                                                                    .shiftcode_desc
                                                                    ?.length >
                                                                30
                                                                    ? "..."
                                                                    : ""}
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
                                                            {
                                                                code.shiftcode_desc
                                                            }
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

    // Prepare pagination meta for the reusable component
    const paginationMeta = pagination
        ? {
              current_page: pagination.currentPage,
              last_page: pagination.lastPage,
              from: pagination.from,
              to: pagination.to,
              total: pagination.total,
              per_page: pagination.perPage,
          }
        : null;

    const MainContent = () => (
        <div className={`${isFullscreen ? "bg-background" : ""}`}>
            <div
                className={`border-b bg-card px-6 py-4 ${isFullscreen ? "sticky top-0 z-50" : ""}`}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        {!isFullscreen && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleBack}
                                className="gap-2"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Back
                            </Button>
                        )}
                        <div>
                            <h1 className="text-xl font-bold flex items-center gap-2 text-foreground">
                                <FileSpreadsheet className="w-5 h-5 text-primary" />
                                Work Schedule View
                            </h1>
                            <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                                <Calendar className="w-4 h-4" />
                                <span>
                                    {dateStart} — {dateEnd}
                                </span>
                            </div>
                        </div>
                    </div>
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

            <div className={`${isFullscreen ? "p-6" : "p-6"} space-y-6`}>
                {groupedData.length === 0 && (
                    <Card>
                        <CardContent className="py-12 text-center text-muted-foreground">
                            No schedules found for this period.
                        </CardContent>
                    </Card>
                )}

                {groupedData.map((group, groupIdx) => {
                    const data = group.schedules || [];
                    const headers = group.headers || [];
                    const subHeaders = group.subHeaders || [];

                    if (
                        data.length === 0 &&
                        (!pagination || pagination.total === 0)
                    ) {
                        return (
                            <Card key={groupIdx}>
                                <CardContent className="py-12 text-center text-muted-foreground">
                                    No schedules found for this period.
                                </CardContent>
                            </Card>
                        );
                    }

                    return (
                        <Card key={groupIdx} className="overflow-hidden">
                            <CardHeader className="bg-muted/50 py-3 px-4">
                                <div className="flex flex-wrap items-center justify-between gap-4">
                                    <div className="flex flex-wrap items-center gap-4 text-sm">
                                        <span className="flex items-center gap-1.5 font-medium text-foreground">
                                            <User className="w-4 h-4 text-muted-foreground" />
                                            Created by: {group.created_by}
                                        </span>
                                        <Separator
                                            orientation="vertical"
                                            className="h-4"
                                        />
                                        <span className="flex items-center gap-1.5 text-muted-foreground">
                                            <Calendar className="w-4 h-4" />
                                            {group.payroll_date_start} —{" "}
                                            {group.payroll_date_end}
                                        </span>
                                        <Separator
                                            orientation="vertical"
                                            className="h-4"
                                        />
                                        <Badge
                                            variant="secondary"
                                            className="flex items-center gap-1"
                                        >
                                            <Clock className="w-3 h-3" />
                                            {pagination
                                                ? `${pagination.total} employees`
                                                : `${data.length} employees`}
                                        </Badge>
                                    </div>

                                    {/* Search and per page controls */}
                                    <div className="flex items-center gap-3">
                                        <div className="relative w-64">
                                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Search by ID or name..."
                                                value={search}
                                                onChange={handleSearch}
                                                className="pl-8 h-8 text-sm"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <span>Show</span>
                                            <Select
                                                value={String(perPage)}
                                                onValueChange={
                                                    handlePerPageChange
                                                }
                                            >
                                                <SelectTrigger className="w-20 h-8">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="10">
                                                        10
                                                    </SelectItem>
                                                    <SelectItem value="20">
                                                        20
                                                    </SelectItem>
                                                    <SelectItem value="50">
                                                        50
                                                    </SelectItem>
                                                    <SelectItem value="100">
                                                        100
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <span>entries</span>
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent
                                className={`p-4 space-y-4 ${isFullscreen ? "overflow-auto" : ""}`}
                            >
                                {loading && (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                        <span className="ml-2 text-muted-foreground">
                                            Loading...
                                        </span>
                                    </div>
                                )}

                                {!loading && (
                                    <>
                                        {renderLegend()}

                                        <ScheduleTableViewing
                                            data={data}
                                            headers={headers}
                                            subHeaders={subHeaders}
                                            frozenColumns={6}
                                            stickyColumns={2}
                                            shiftMap={shiftMap}
                                            shiftOptions={shiftOptions}
                                            maxHeight={
                                                isFullscreen
                                                    ? "calc(100vh - 400px)"
                                                    : "60vh"
                                            }
                                            showHeader={true}
                                            editable={false}
                                        />

                                        {/* Use reusable Pagination component */}
                                        {paginationMeta &&
                                            paginationMeta.total >
                                                paginationMeta.per_page && (
                                                <Pagination
                                                    meta={paginationMeta}
                                                    onPageChange={goToPage}
                                                />
                                            )}
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );

    return isFullscreen ? (
        <>
            <Head title="Work Schedule View - Fullscreen" />
            <MainContent />
        </>
    ) : (
        <AuthenticatedLayout>
            <Head title="Work Schedule View" />
            <MainContent />
        </AuthenticatedLayout>
    );
}
