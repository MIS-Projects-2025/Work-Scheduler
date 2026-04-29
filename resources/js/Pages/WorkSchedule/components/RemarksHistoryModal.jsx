import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Loader2, Clock, User, FileText, RefreshCw } from "lucide-react";
import dayjs from "dayjs";
import { router } from "@inertiajs/react";

export default function RemarksHistoryModal({
    open,
    onClose,
    dateStart,
    dateEnd,
    cutoffLabel,
}) {
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState(null);
    const [activeTab, setActiveTab] = useState("all");
    const [error, setError] = useState(null);

    useEffect(() => {
        if (open && dateStart && dateEnd) {
            fetchRemarksHistory();
        }
    }, [open, dateStart, dateEnd]);

    const fetchRemarksHistory = async () => {
        setLoading(true);
        setError(null);

        try {
            // Use the named route - this will generate the correct URL
            const url = route("workschedule.remarks-history", {
                date_start: dateStart,
                date_end: dateEnd,
            });

            console.log("Fetching from URL:", url);

            const response = await fetch(url, {
                headers: {
                    Accept: "application/json",
                    "X-Requested-With": "XMLHttpRequest",
                },
            });

            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status}: ${response.statusText}`,
                );
            }

            const data = await response.json();
            console.log("Received data:", data);
            setHistory(data);
        } catch (error) {
            console.error("Failed to fetch remarks history:", error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const getOperationBadge = (operation) => {
        const variants = {
            CREATE: {
                label: "Created",
                color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
            },
            UPDATE: {
                label: "Updated",
                color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
            },
            DELETE: {
                label: "Deleted",
                color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
            },
            APPROVE: {
                label: "Approved",
                color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
            },
            DISAPPROVE: {
                label: "Disapproved",
                color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
            },
            ACKNOWLEDGE: {
                label: "Acknowledged",
                color: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300",
            },
        };

        const config = variants[operation] || variants["UPDATE"];
        return <Badge className={config.color}>{config.label}</Badge>;
    };

    const formatDate = (date) => {
        return dayjs(date).format("MMM D, YYYY h:mm A");
    };

    const renderAllHistory = () => (
        <ScrollArea className="h-[500px]">
            <Table>
                <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Operation</TableHead>
                        <TableHead>Old Remarks</TableHead>
                        <TableHead>New Remarks</TableHead>
                        <TableHead>Updated By</TableHead>
                        <TableHead>Date</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {history?.all_history?.map((item) => (
                        <TableRow key={item.history_id}>
                            <TableCell className="font-medium">
                                {item.emp_name}
                            </TableCell>
                            <TableCell>
                                {getOperationBadge(item.operation)}
                            </TableCell>
                            <TableCell
                                className="max-w-[200px] truncate"
                                title={item.old_remarks}
                            >
                                {item.old_remarks || "—"}
                            </TableCell>
                            <TableCell
                                className="max-w-[200px] truncate"
                                title={item.new_remarks}
                            >
                                {item.new_remarks || "—"}
                            </TableCell>
                            <TableCell>{item.updated_by_name}</TableCell>
                            <TableCell className="whitespace-nowrap">
                                {formatDate(item.updated_at)}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </ScrollArea>
    );

    const renderGroupedByEmployee = () => (
        <ScrollArea className="h-[500px]">
            <div className="space-y-6">
                {history?.grouped_by_employee?.map((employee) => (
                    <div key={employee.emp_id} className="border rounded-lg">
                        <div className="p-4 bg-muted/50 border-b">
                            <h3 className="font-semibold text-lg">
                                {employee.emp_name}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                ID: {employee.emp_id}
                            </p>
                        </div>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Operation</TableHead>
                                    <TableHead>Old Remarks</TableHead>
                                    <TableHead>New Remarks</TableHead>
                                    <TableHead>Updated By</TableHead>
                                    <TableHead>Date</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {employee.history.map((item) => (
                                    <TableRow key={item.history_id}>
                                        <TableCell>
                                            {getOperationBadge(item.operation)}
                                        </TableCell>
                                        <TableCell
                                            className="max-w-[200px] truncate"
                                            title={item.old_remarks}
                                        >
                                            {item.old_remarks || "—"}
                                        </TableCell>
                                        <TableCell
                                            className="max-w-[200px] truncate"
                                            title={item.new_remarks}
                                        >
                                            {item.new_remarks || "—"}
                                        </TableCell>
                                        <TableCell>
                                            {item.updated_by_name}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap">
                                            {formatDate(item.updated_at)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ))}
            </div>
        </ScrollArea>
    );

    const renderSummary = () => (
        <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-primary/10 rounded-lg p-4 text-center">
                <FileText className="w-8 h-8 mx-auto mb-2 text-primary" />
                <div className="text-2xl font-bold">{history?.total || 0}</div>
                <div className="text-sm text-muted-foreground">
                    Total Changes
                </div>
            </div>
            <div className="bg-green-100 dark:bg-green-900/20 rounded-lg p-4 text-center">
                <User className="w-8 h-8 mx-auto mb-2 text-green-600 dark:text-green-400" />
                <div className="text-2xl font-bold">
                    {history?.grouped_by_employee?.length || 0}
                </div>
                <div className="text-sm text-muted-foreground">
                    Employees Affected
                </div>
            </div>
            <div className="bg-blue-100 dark:bg-blue-900/20 rounded-lg p-4 text-center">
                <Clock className="w-8 h-8 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
                <div className="text-sm font-mono">
                    {history?.all_history?.[0]?.updated_at
                        ? formatDate(history.all_history[0].updated_at)
                        : "No changes"}
                </div>
                <div className="text-sm text-muted-foreground">
                    Latest Change
                </div>
            </div>
        </div>
    );

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <span>Remarks History - {cutoffLabel}</span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={fetchRemarksHistory}
                            disabled={loading}
                        >
                            <RefreshCw
                                className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
                            />
                            Refresh
                        </Button>
                    </DialogTitle>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <span className="ml-2">Loading history...</span>
                    </div>
                ) : error ? (
                    <div className="text-center py-12 text-red-600">
                        <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>Error: {error}</p>
                        <Button
                            variant="outline"
                            onClick={fetchRemarksHistory}
                            className="mt-4"
                        >
                            Try Again
                        </Button>
                    </div>
                ) : history && history.total > 0 ? (
                    <>
                        {renderSummary()}

                        <div className="flex gap-2 mb-4 border-b">
                            <Button
                                variant={
                                    activeTab === "all" ? "default" : "ghost"
                                }
                                onClick={() => setActiveTab("all")}
                            >
                                All History
                            </Button>
                            <Button
                                variant={
                                    activeTab === "grouped"
                                        ? "default"
                                        : "ghost"
                                }
                                onClick={() => setActiveTab("grouped")}
                            >
                                Group by Employee
                            </Button>
                        </div>

                        {activeTab === "all"
                            ? renderAllHistory()
                            : renderGroupedByEmployee()}
                    </>
                ) : (
                    <div className="text-center py-12 text-muted-foreground">
                        <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No remarks history found for this cutoff period.</p>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
