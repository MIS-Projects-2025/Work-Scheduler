import { useState, useEffect, useCallback, useRef } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import { toast } from "sonner";
import {
    CalendarRange,
    Plus,
    Pencil,
    Trash2,
    Search,
    Loader2,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";

// ─── Constants ────────────────────────────────────────────────────────────────

const PER_PAGE_OPTIONS = ["10", "15", "25", "50"];

const EMPTY_FORM = {
    payroll_date_start: "",
    payroll_date_end: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PayrollCutoffSchedule() {
    const [records, setRecords] = useState([]);
    const [meta, setMeta] = useState({
        current_page: 1,
        last_page: 1,
        total: 0,
        per_page: 15,
    });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [yearFilter, setYearFilter] = useState(
        String(new Date().getFullYear()),
    );
    const [perPage, setPerPage] = useState("15");
    const [page, setPage] = useState(1);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [formErrors, setFormErrors] = useState({});

    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const debounceRef = useRef(null);

    function handleSearchInput(value) {
        setSearchInput(value);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setSearch(value);
            setPage(1);
        }, 400);
    }

    // ── Fetch ─────────────────────────────────────────────────────────────────

    const fetchRecords = useCallback(
        async (currentPage = page) => {
            setLoading(true);
            try {
                const params = new URLSearchParams();
                if (yearFilter && yearFilter !== "all")
                    params.set("year", yearFilter);
                if (search) params.set("search", search);
                params.set("per_page", perPage);
                params.set("page", String(currentPage));

                const { data: json } = await axios.get(
                    route(
                        "payroll-cutoff-schedules.index",
                        Object.fromEntries(params),
                    ),
                );

                setRecords(json.data.data);
                setMeta({
                    current_page: json.data.current_page,
                    last_page: json.data.last_page,
                    total: json.data.total,
                    per_page: json.data.per_page,
                });
            } catch (e) {
                toast.error(e.response?.data?.message ?? e.message);
            } finally {
                setLoading(false);
            }
        },
        [yearFilter, search, perPage, page],
    );

    useEffect(() => {
        fetchRecords(page);
    }, [yearFilter, search, perPage, page]);
    useEffect(() => {
        setPage(1);
    }, [yearFilter, search, perPage]);

    // ── Dialog helpers ────────────────────────────────────────────────────────

    function openCreate() {
        setEditTarget(null);
        setForm(EMPTY_FORM);
        setFormErrors({});
        setDialogOpen(true);
    }

    function openEdit(record) {
        setEditTarget(record);
        setForm({
            payroll_date_start:
                record.payroll_date_start?.substring(0, 10) ?? "",
            payroll_date_end: record.payroll_date_end?.substring(0, 10) ?? "",
        });
        setFormErrors({});
        setDialogOpen(true);
    }

    function validateForm() {
        const errors = {};
        if (!form.payroll_date_start)
            errors.payroll_date_start = "Start date is required.";
        if (!form.payroll_date_end)
            errors.payroll_date_end = "End date is required.";
        if (
            form.payroll_date_start &&
            form.payroll_date_end &&
            form.payroll_date_end <= form.payroll_date_start
        ) {
            errors.payroll_date_end = "End date must be after start date.";
        }
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    }

    // ── Save ──────────────────────────────────────────────────────────────────

    async function handleSave() {
        if (!validateForm()) return;
        setSaving(true);
        try {
            if (editTarget) {
                await axios.put(
                    route("payroll-cutoff-schedules.update", {
                        id: editTarget.ID,
                    }),
                    form,
                );
                toast.success("Cutoff schedule updated successfully.");
            } else {
                await axios.post(route("payroll-cutoff-schedules.store"), form);
                toast.success("Cutoff schedule created successfully.");
            }
            setDialogOpen(false);
            fetchRecords(page);
        } catch (e) {
            toast.error(e.response?.data?.message ?? e.message);
        } finally {
            setSaving(false);
        }
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    async function handleDelete() {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await axios.delete(
                route("payroll-cutoff-schedules.destroy", {
                    id: deleteTarget.ID,
                }),
            );
            toast.success("Cutoff schedule deleted successfully.");
            setDeleteTarget(null);
            const newPage = records.length === 1 && page > 1 ? page - 1 : page;
            setPage(newPage);
            fetchRecords(newPage);
        } catch (e) {
            toast.error(e.response?.data?.message ?? e.message);
        } finally {
            setDeleting(false);
        }
    }

    // ── Year options ──────────────────────────────────────────────────────────

    const yearOptions = Array.from({ length: 5 }, (_, i) =>
        String(new Date().getFullYear() - 1 + i),
    );

    const from =
        meta.total === 0 ? 0 : (meta.current_page - 1) * meta.per_page + 1;
    const to = Math.min(meta.current_page * meta.per_page, meta.total);

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <AuthenticatedLayout>
            <div className="p-6 space-y-6 max-w-5xl mx-auto">
                {/* ── Page header ── */}
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                        <CalendarRange className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Payroll Cutoff Schedule
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Manage payroll cutoff date ranges for processing.
                        </p>
                    </div>
                </div>

                {/* ── Card ── */}
                <Card>
                    <CardHeader className="pb-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <CardTitle className="text-base">
                                    Schedules
                                </CardTitle>
                                <CardDescription>
                                    {meta.total} record
                                    {meta.total !== 1 ? "s" : ""}
                                </CardDescription>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <Select
                                    value={yearFilter}
                                    onValueChange={(v) => {
                                        setYearFilter(v);
                                        setPage(1);
                                    }}
                                >
                                    <SelectTrigger className="w-28">
                                        <SelectValue placeholder="Year" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            All years
                                        </SelectItem>
                                        {yearOptions.map((y) => (
                                            <SelectItem key={y} value={y}>
                                                {y}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <div className="relative">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search..."
                                        value={searchInput}
                                        onChange={(e) =>
                                            handleSearchInput(e.target.value)
                                        }
                                        className="pl-8 w-48"
                                    />
                                </div>

                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => fetchRecords(page)}
                                    disabled={loading}
                                >
                                    <RefreshCw
                                        className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                                    />
                                </Button>

                                <Button
                                    onClick={openCreate}
                                    className="gap-1.5"
                                >
                                    <Plus className="h-4 w-4" />
                                    Add Schedule
                                </Button>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12 pl-6">
                                        #
                                    </TableHead>
                                    <TableHead>Start Date</TableHead>
                                    <TableHead>End Date</TableHead>
                                    <TableHead>Created By</TableHead>
                                    <TableHead className="text-right pr-6">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>

                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={5}
                                            className="h-32 text-center text-muted-foreground"
                                        >
                                            <Loader2 className="inline h-5 w-5 animate-spin mr-2" />
                                            Loading schedules...
                                        </TableCell>
                                    </TableRow>
                                ) : records.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={5}
                                            className="h-32 text-center text-muted-foreground"
                                        >
                                            No schedules found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    records.map((r, idx) => (
                                        <TableRow key={r.ID} className="group">
                                            <TableCell className="pl-6 text-muted-foreground text-sm">
                                                {from + idx}
                                            </TableCell>
                                            <TableCell className="tabular-nums text-sm font-medium">
                                                {formatDate(
                                                    r.payroll_date_start,
                                                )}
                                            </TableCell>
                                            <TableCell className="tabular-nums text-sm">
                                                {formatDate(r.payroll_date_end)}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {r.created_by ?? "—"}
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                <div className="flex justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() =>
                                                            openEdit(r)
                                                        }
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                                        onClick={() =>
                                                            setDeleteTarget(r)
                                                        }
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>

                        {/* ── Pagination footer ── */}
                        {!loading && meta.total > 0 && (
                            <div className="flex items-center justify-between px-6 py-3 border-t text-sm text-muted-foreground">
                                <div className="flex items-center gap-2">
                                    <span>Rows per page</span>
                                    <Select
                                        value={String(perPage)}
                                        onValueChange={(v) => {
                                            setPerPage(v);
                                            setPage(1);
                                        }}
                                    >
                                        <SelectTrigger className="h-8 w-16">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {PER_PAGE_OPTIONS.map((o) => (
                                                <SelectItem key={o} value={o}>
                                                    {o}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span>
                                        {from}–{to} of {meta.total}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8"
                                            disabled={meta.current_page <= 1}
                                            onClick={() =>
                                                setPage((p) => p - 1)
                                            }
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8"
                                            disabled={
                                                meta.current_page >=
                                                meta.last_page
                                            }
                                            onClick={() =>
                                                setPage((p) => p + 1)
                                            }
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* ── Create / Edit Dialog ── */}
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>
                                {editTarget ? "Edit Schedule" : "Add Schedule"}
                            </DialogTitle>
                            <DialogDescription>
                                {editTarget
                                    ? "Update the cutoff date range."
                                    : "Define a new payroll cutoff date range."}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="payroll_date_start">
                                    Start Date{" "}
                                    <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="payroll_date_start"
                                    type="date"
                                    value={form.payroll_date_start}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            payroll_date_start: e.target.value,
                                        })
                                    }
                                />
                                {formErrors.payroll_date_start && (
                                    <p className="text-xs text-destructive">
                                        {formErrors.payroll_date_start}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="payroll_date_end">
                                    End Date{" "}
                                    <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="payroll_date_end"
                                    type="date"
                                    value={form.payroll_date_end}
                                    min={form.payroll_date_start || undefined}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            payroll_date_end: e.target.value,
                                        })
                                    }
                                />
                                {formErrors.payroll_date_end && (
                                    <p className="text-xs text-destructive">
                                        {formErrors.payroll_date_end}
                                    </p>
                                )}
                            </div>
                        </div>

                        <DialogFooter className="gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setDialogOpen(false)}
                                disabled={saving}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSave}
                                disabled={saving}
                                className="gap-1.5"
                            >
                                {saving && (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                )}
                                {editTarget ? "Save Changes" : "Add Schedule"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* ── Delete Confirm ── */}
                <AlertDialog
                    open={!!deleteTarget}
                    onOpenChange={(o) => !o && setDeleteTarget(null)}
                >
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Schedule</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete the cutoff
                                schedule from{" "}
                                <span className="font-semibold text-foreground">
                                    {formatDate(
                                        deleteTarget?.payroll_date_start,
                                    )}
                                </span>{" "}
                                to{" "}
                                <span className="font-semibold text-foreground">
                                    {formatDate(deleteTarget?.payroll_date_end)}
                                </span>
                                ? This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={deleting}>
                                Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDelete}
                                disabled={deleting}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5"
                            >
                                {deleting && (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                )}
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </AuthenticatedLayout>
    );
}
