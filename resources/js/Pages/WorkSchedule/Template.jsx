import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head } from "@inertiajs/react";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Download, Loader2, CheckCircle2 } from "lucide-react";

import { Combobox } from "@/components/ui/combobox";

export default function WorkScheduleTemplate({
    cutoffList,
    employees = [],
    shifts = [],
}) {
    const [selectedCutoff, setSelectedCutoff] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [downloadComplete, setDownloadComplete] = useState(false);

    // Transform cutoffList into options format for Combobox
    // cutoffList is directly an array from the controller, not cutoffList.data
    const cutoffOptions = useMemo(() => {
        if (!cutoffList || !Array.isArray(cutoffList)) return [];

        return cutoffList.map((cutoff) => ({
            value: cutoff.ID.toString(),
            label: `${cutoff.payroll_date_start} → ${cutoff.payroll_date_end}`,
        }));
    }, [cutoffList]);

    // Set default cutoff
    useEffect(() => {
        if (cutoffOptions.length > 0) {
            setSelectedCutoff(cutoffOptions[0].value);
        }
    }, [cutoffOptions]);

    // Download template
    const handleDownload = async () => {
        if (!selectedCutoff) return;

        setIsLoading(true);
        setDownloadComplete(false);

        const params = new URLSearchParams({
            cutoff_id: selectedCutoff,
        });

        // Open download in new tab
        window.open(
            route("workschedule.template.download") + "?" + params.toString(),
            "_blank",
        );

        // Simulate download completion
        setTimeout(() => {
            setIsLoading(false);
            setDownloadComplete(true);
            setTimeout(() => setDownloadComplete(false), 3000);
        }, 1000);
    };

    return (
        <AuthenticatedLayout>
            <Head title="Work Schedule Template" />

            <div className="max-w-2xl mx-auto p-4">
                {/* HEADER */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <FileSpreadsheet className="w-6 h-6" />
                        Work Schedule Template
                    </h1>
                    <p className="text-muted-foreground">
                        Download work schedule template for selected cutoff
                        period
                    </p>
                </div>

                {/* CUT-OFF SELECT WITH COMBOBOX */}
                <div className="border rounded-lg p-6 mb-6">
                    <label className="text-sm font-medium block mb-2">
                        Select Cutoff Period
                    </label>
                    <Combobox
                        options={cutoffOptions}
                        value={selectedCutoff}
                        onChange={setSelectedCutoff}
                        placeholder="Select cutoff period..."
                        className="w-full"
                    />

                    <p className="text-xs text-muted-foreground mt-2">
                        {cutoffOptions.length} cutoff period(s) available
                    </p>
                </div>

                {/* DOWNLOAD BUTTON */}
                <div className="mt-6">
                    <Button
                        onClick={handleDownload}
                        disabled={!selectedCutoff || isLoading}
                        className="w-full"
                        size="lg"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                Preparing template...
                            </>
                        ) : downloadComplete ? (
                            <>
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                Download Started!
                            </>
                        ) : (
                            <>
                                <Download className="w-4 h-4 mr-2" />
                                Download Excel Template
                            </>
                        )}
                    </Button>
                </div>

                {/* Debug info - remove in production */}
                {process.env.NODE_ENV === "development" && (
                    <div className="mt-4 p-3 bg-gray-100 rounded text-xs">
                        <p>Debug: Selected Cutoff ID: {selectedCutoff}</p>
                        <p>Available Cutoffs: {cutoffOptions.length}</p>
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
