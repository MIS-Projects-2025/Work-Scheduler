import { Button } from "@/Components/ui/button";

/**
 * Generic server-side pagination control.
 *
 * Props:
 *   meta         — { current_page, last_page, from, to, total }
 *   onPageChange — (page: number) => void
 */
export function Pagination({ meta, onPageChange }) {
    if (!meta || meta.last_page <= 1) return null;

    const { current_page, last_page, from, to, total } = meta;

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1 mt-4">
            <p className="text-xs text-muted-foreground">
                Showing {from ?? 0}–{to ?? 0} of {total ?? 0}
            </p>
            <div className="flex items-center gap-1">
                <Button
                    variant="outline" size="sm"
                    disabled={current_page === 1}
                    onClick={() => onPageChange(current_page - 1)}
                    className="h-8 px-3 text-xs"
                >
                    Previous
                </Button>
                <span className="text-xs text-muted-foreground px-2">
                    {current_page} / {last_page}
                </span>
                <Button
                    variant="outline" size="sm"
                    disabled={current_page === last_page}
                    onClick={() => onPageChange(current_page + 1)}
                    className="h-8 px-3 text-xs"
                >
                    Next
                </Button>
            </div>
        </div>
    );
}
