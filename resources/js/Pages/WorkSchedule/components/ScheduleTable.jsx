import { Eye, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const STATUS_BADGE_CLASS = {
    0: "bg-muted text-muted-foreground",
    1: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    2: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    3: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    4: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const STATUS_LABELS = {
    0: "Draft",
    1: "For Approval",
    2: "To Acknowledge",
    3: "Acknowledged",
    4: "Disapproved",
};

const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
    });
};

function SortIcon({ col, orderBy, orderDir }) {
    if (orderBy !== col)
        return <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />;
    return orderDir === "asc" ? (
        <ArrowUp className="w-3.5 h-3.5" />
    ) : (
        <ArrowDown className="w-3.5 h-3.5" />
    );
}

function SortableHead({ col, orderBy, orderDir, onSort, children }) {
    return (
        <th
            className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap cursor-pointer select-none hover:text-foreground transition-colors"
            onClick={() => onSort(col)}
        >
            <span className="flex items-center gap-1.5">
                {children}
                <SortIcon col={col} orderBy={orderBy} orderDir={orderDir} />
            </span>
        </th>
    );
}

export default function ScheduleTable({
    rows,
    orderBy,
    orderDir,
    onSort,
    onView,
}) {
    if (!rows.length) {
        return (
            <div className="text-center py-12 text-muted-foreground text-sm">
                No schedules found.
            </div>
        );
    }

    return (
        <div className="rounded-md border overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b">
                        <tr>
                            <SortableHead
                                col="created_by"
                                orderBy={orderBy}
                                orderDir={orderDir}
                                onSort={onSort}
                            >
                                Created By
                            </SortableHead>
                            <SortableHead
                                col="payroll_date_start"
                                orderBy={orderBy}
                                orderDir={orderDir}
                                onSort={onSort}
                            >
                                Date Start
                            </SortableHead>
                            <SortableHead
                                col="payroll_date_end"
                                orderBy={orderBy}
                                orderDir={orderDir}
                                onSort={onSort}
                            >
                                Date End
                            </SortableHead>
                            <SortableHead
                                col="work_sched_status"
                                orderBy={orderBy}
                                orderDir={orderDir}
                                onSort={onSort}
                            >
                                Status
                            </SortableHead>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {rows.map((row, idx) => (
                            <tr
                                key={idx}
                                className="hover:bg-muted/30 transition-colors"
                            >
                                <td className="px-4 py-3 font-mono">
                                    {row.created_by}
                                </td>
                                <td className="px-4 py-3">
                                    {formatDate(row.payroll_date_start)}
                                </td>
                                <td className="px-4 py-3">
                                    {formatDate(row.payroll_date_end)}
                                </td>
                                <td className="px-4 py-3">
                                    <span
                                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE_CLASS[row.work_sched_status] || STATUS_BADGE_CLASS[0]}`}
                                    >
                                        {STATUS_LABELS[row.work_sched_status] ||
                                            "Unknown"}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onView(row)}
                                    >
                                        <Eye className="w-4 h-4 mr-1" /> View
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
