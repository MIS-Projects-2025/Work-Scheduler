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
import { Badge } from "@/components/ui/badge";
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
    CalendarDays,
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

const HOLIDAY_TYPES = ["Regular", "Special"];

const PRESET_COLORS = [
    { label: "Red", value: "#EF4444" },
    { label: "Orange", value: "#F97316" },
    { label: "Amber", value: "#F59E0B" },
    { label: "Green", value: "#22C55E" },
    { label: "Blue", value: "#3B82F6" },
    { label: "Purple", value: "#A855F7" },
    { label: "Pink", value: "#EC4899" },
];

const EMPTY_FORM = {
    holiday_name: "",
    holiday_date: "",
    holiday_type: "Regular",
    color: "#EF4444",
};

const PER_PAGE_OPTIONS = ["10", "15", "25", "50"];

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiFetch(url, options = {}) {
    const csrfToken = document
        .querySelector('meta[name="csrf-token"]')
        ?.getAttribute("content");
    const res = await fetch(url, {
        headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
            ...(csrfToken ? { "X-CSRF-TOKEN": csrfToken } : {}),
        },
        ...options,
    });
    const json = await res.json();
    if (!res.ok || !json.success)
        throw new Error(json.message ?? "Request failed.");
    return json;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Holiday() {
    // Server-side pagination state
    const [holidays, setHolidays] = useState([]);
    const [meta, setMeta] = useState({
        current_page: 1,
        last_page: 1,
        total: 0,
        per_page: 15,
    });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Filters (controlled; applied on Enter / blur / button for search)
    const [search, setSearch] = useState("");
    const [searchInput, setSearchInput] = useState(""); // debounced input
    const [yearFilter, setYearFilter] = useState(
        String(new Date().getFullYear()),
    );
    const [perPage, setPerPage] = useState("15");
    const [page, setPage] = useState(1);

    // Dialog state
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [formErrors, setFormErrors] = useState({});

    // Delete confirm
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);

    // Debounce search input
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

    const fetchHolidays = useCallback(
        async (currentPage = page) => {
            setLoading(true);
            try {
                const params = new URLSearchParams();
                if (yearFilter && yearFilter !== "all")
                    params.set("year", yearFilter);
                if (search) params.set("search", search);
                params.set("per_page", perPage);
                params.set("page", String(currentPage));

                const json = await apiFetch(`/holidays?${params.toString()}`);

                // Laravel paginator shape: json.data.data / json.data.current_page etc.
                const paginator = json.data;
                setHolidays(paginator.data);
                setMeta({
                    current_page: paginator.current_page,
                    last_page: paginator.last_page,
                    total: paginator.total,
                    per_page: paginator.per_page,
                });
            } catch (e) {
                toast.error(e.message);
            } finally {
                setLoading(false);
            }
        },
        [yearFilter, search, perPage, page],
    );

    useEffect(() => {
        fetchHolidays(page);
    }, [yearFilter, search, perPage, page]);

    // Reset to page 1 when filters change
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

    function openEdit(holiday) {
        setEditTarget(holiday);
        setForm({
            holiday_name: holiday.holiday_name,
            holiday_date: holiday.holiday_date?.substring(0, 10) ?? "",
            holiday_type: holiday.holiday_type,
            color: holiday.color ?? "#EF4444",
        });
        setFormErrors({});
        setDialogOpen(true);
    }

    function validateForm() {
        const errors = {};
        if (!form.holiday_name.trim())
            errors.holiday_name = "Name is required.";
        if (!form.holiday_date) errors.holiday_date = "Date is required.";
        if (!form.holiday_type) errors.holiday_type = "Type is required.";
        if (!/^#[0-9A-Fa-f]{6}$/.test(form.color))
            errors.color = "Invalid hex color.";
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    }

    // ── Save ──────────────────────────────────────────────────────────────────

    async function handleSave() {
        if (!validateForm()) return;
        setSaving(true);
        try {
            if (editTarget) {
                await apiFetch(`/holidays/${editTarget.ID}`, {
                    method: "PUT",
                    body: JSON.stringify(form),
                });
                toast.success("Holiday updated successfully.");
            } else {
                await apiFetch("/holidays", {
                    method: "POST",
                    body: JSON.stringify(form),
                });
                toast.success("Holiday created successfully.");
            }
            setDialogOpen(false);
            fetchHolidays(page);
        } catch (e) {
            toast.error(e.message);
        } finally {
            setSaving(false);
        }
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    async function handleDelete() {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await apiFetch(`/holidays/${deleteTarget.ID}`, {
                method: "DELETE",
            });
            toast.success("Holiday removed successfully.");
            setDeleteTarget(null);
            // If last item on page > 1, go back a page
            const newPage = holidays.length === 1 && page > 1 ? page - 1 : page;
            setPage(newPage);
            fetchHolidays(newPage);
        } catch (e) {
            toast.error(e.message);
        } finally {
            setDeleting(false);
        }
    }

    // ── Year options ──────────────────────────────────────────────────────────

    const yearOptions = Array.from({ length: 5 }, (_, i) =>
        String(new Date().getFullYear() - 1 + i),
    );

    // ── Pagination helpers ────────────────────────────────────────────────────

    const from =
        meta.total === 0 ? 0 : (meta.current_page - 1) * meta.per_page + 1;
    const to = Math.min(meta.current_page * meta.per_page, meta.total);

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <AuthenticatedLayout>
            <div className="p-6 space-y-6 max-w-6xl mx-auto">
                {/* ── Page header ── */}
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                        <CalendarDays className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Holiday Maintenance
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Manage company holidays for payroll and scheduling.
                        </p>
                    </div>
                </div>

                {/* ── Card ── */}
                <Card>
                    <CardHeader className="pb-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <CardTitle className="text-base">
                                    Holidays
                                </CardTitle>
                                <CardDescription>
                                    {meta.total} record
                                    {meta.total !== 1 ? "s" : ""}
                                </CardDescription>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                {/* Year filter */}
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

                                {/* Search */}
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

                                {/* Refresh */}
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => fetchHolidays(page)}
                                    disabled={loading}
                                >
                                    <RefreshCw
                                        className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                                    />
                                </Button>

                                {/* Add */}
                                <Button
                                    onClick={openCreate}
                                    className="gap-1.5"
                                >
                                    <Plus className="h-4 w-4" />
                                    Add Holiday
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
                                    <TableHead>Holiday Name</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Color</TableHead>
                                    <TableHead className="text-right pr-6">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>

                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={6}
                                            className="h-32 text-center text-muted-foreground"
                                        >
                                            <Loader2 className="inline h-5 w-5 animate-spin mr-2" />
                                            Loading holidays...
                                        </TableCell>
                                    </TableRow>
                                ) : holidays.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={6}
                                            className="h-32 text-center text-muted-foreground"
                                        >
                                            No holidays found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    holidays.map((h, idx) => (
                                        <TableRow key={h.ID} className="group">
                                            <TableCell className="pl-6 text-muted-foreground text-sm">
                                                {from + idx}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {h.holiday_name}
                                            </TableCell>
                                            <TableCell className="tabular-nums text-sm">
                                                {new Date(
                                                    h.holiday_date,
                                                ).toLocaleDateString("en-PH", {
                                                    year: "numeric",
                                                    month: "short",
                                                    day: "numeric",
                                                })}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={
                                                        h.holiday_type ===
                                                        "Regular"
                                                            ? "default"
                                                            : "secondary"
                                                    }
                                                >
                                                    {h.holiday_type}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className="inline-block h-5 w-5 rounded border border-border shadow-sm flex-shrink-0"
                                                        style={{
                                                            backgroundColor:
                                                                h.color ??
                                                                "#EF4444",
                                                        }}
                                                    />
                                                    <span className="text-xs text-muted-foreground font-mono">
                                                        {(
                                                            h.color ?? "#EF4444"
                                                        ).toUpperCase()}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() =>
                                                            openEdit(h)
                                                        }
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                                        onClick={() =>
                                                            setDeleteTarget(h)
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
                                {editTarget ? "Edit Holiday" : "Add Holiday"}
                            </DialogTitle>
                            <DialogDescription>
                                {editTarget
                                    ? "Update the details of this holiday."
                                    : "Fill in the details to add a new holiday."}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-2">
                            {/* Holiday Name */}
                            <div className="space-y-1.5">
                                <Label htmlFor="holiday_name">
                                    Holiday Name{" "}
                                    <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="holiday_name"
                                    placeholder="e.g. New Year's Day"
                                    value={form.holiday_name}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            holiday_name: e.target.value,
                                        })
                                    }
                                />
                                {formErrors.holiday_name && (
                                    <p className="text-xs text-destructive">
                                        {formErrors.holiday_name}
                                    </p>
                                )}
                            </div>

                            {/* Date */}
                            <div className="space-y-1.5">
                                <Label htmlFor="holiday_date">
                                    Date{" "}
                                    <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="holiday_date"
                                    type="date"
                                    value={form.holiday_date}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            holiday_date: e.target.value,
                                        })
                                    }
                                />
                                {formErrors.holiday_date && (
                                    <p className="text-xs text-destructive">
                                        {formErrors.holiday_date}
                                    </p>
                                )}
                            </div>

                            {/* Holiday Type */}
                            <div className="space-y-1.5">
                                <Label>
                                    Type{" "}
                                    <span className="text-destructive">*</span>
                                </Label>
                                <Select
                                    value={form.holiday_type}
                                    onValueChange={(v) =>
                                        setForm({ ...form, holiday_type: v })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {HOLIDAY_TYPES.map((t) => (
                                            <SelectItem key={t} value={t}>
                                                {t}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {formErrors.holiday_type && (
                                    <p className="text-xs text-destructive">
                                        {formErrors.holiday_type}
                                    </p>
                                )}
                            </div>

                            {/* Color */}
                            <div className="space-y-1.5">
                                <Label>
                                    Color{" "}
                                    <span className="text-destructive">*</span>
                                </Label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {PRESET_COLORS.map((c) => (
                                        <button
                                            key={c.value}
                                            type="button"
                                            title={c.label}
                                            onClick={() =>
                                                setForm({
                                                    ...form,
                                                    color: c.value,
                                                })
                                            }
                                            className={`h-7 w-7 rounded-md border-2 transition-all ${
                                                form.color === c.value
                                                    ? "border-primary scale-110 shadow-md"
                                                    : "border-transparent hover:border-muted-foreground"
                                            }`}
                                            style={{ backgroundColor: c.value }}
                                        />
                                    ))}
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={form.color}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                color: e.target.value,
                                            })
                                        }
                                        className="h-9 w-9 cursor-pointer rounded border border-input bg-transparent p-0.5"
                                    />
                                    <Input
                                        value={form.color}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                color: e.target.value,
                                            })
                                        }
                                        placeholder="#EF4444"
                                        className="font-mono uppercase flex-1"
                                        maxLength={7}
                                    />
                                    <span
                                        className="inline-block h-9 w-9 rounded border border-input flex-shrink-0"
                                        style={{ backgroundColor: form.color }}
                                    />
                                </div>
                                {formErrors.color && (
                                    <p className="text-xs text-destructive">
                                        {formErrors.color}
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
                                {editTarget ? "Save Changes" : "Add Holiday"}
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
                            <AlertDialogTitle>Delete Holiday</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete{" "}
                                <span className="font-semibold text-foreground">
                                    {deleteTarget?.holiday_name}
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
