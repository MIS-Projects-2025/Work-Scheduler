import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, XCircle } from "lucide-react";

export default function ResultModal({ open, onClose, result }) {
    if (!result) return null;

    const sections = [
        {
            key: "saved",
            label: "Saved",
            className: "bg-green-50 dark:bg-green-950",
        },
        {
            key: "overwritten",
            label: "Overwritten",
            className: "bg-blue-50 dark:bg-blue-950",
        },
        {
            key: "skipped",
            label: "Skipped",
            className: "bg-yellow-50 dark:bg-yellow-950",
        },
        {
            key: "unauthorized",
            label: "Unauthorized",
            className: "bg-red-50 dark:bg-red-950",
        },
    ];

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {result.status === "success" ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : result.status === "warning" ? (
                            <AlertCircle className="h-5 w-5 text-yellow-500" />
                        ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                        )}
                        Operation Complete
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-3">
                    {sections.map(({ key, label, className }) =>
                        result[key]?.length > 0 ? (
                            <div
                                key={key}
                                className={`p-3 rounded-md ${className}`}
                            >
                                <strong>
                                    {label} ({result[key].length}):
                                </strong>
                                <p className="text-sm">
                                    {result[key].join(", ")}
                                </p>
                            </div>
                        ) : null,
                    )}
                    {result.error && (
                        <Alert variant="destructive">
                            <AlertDescription>{result.error}</AlertDescription>
                        </Alert>
                    )}
                </div>

                <DialogFooter>
                    <Button onClick={onClose}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
