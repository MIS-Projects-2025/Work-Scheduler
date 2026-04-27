import { cn } from "@/lib/utils";

export default function StatusTabs({
    tabs,
    activeStatus,
    tabCounts,
    onTabChange,
}) {
    return (
        <div className="flex overflow-x-auto border-b">
            {tabs.map((tab) => {
                const count = tabCounts[tab.countKey] ?? 0;
                const isActive = activeStatus === tab.value;
                return (
                    <button
                        key={tab.value}
                        onClick={() => onTabChange(tab.value)}
                        className={cn(
                            "flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                            isActive
                                ? "border-primary text-primary"
                                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
                        )}
                    >
                        {tab.label}
                        {count > 0 && (
                            <span
                                className={cn(
                                    "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold min-w-[1.25rem]",
                                    isActive
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted text-muted-foreground",
                                )}
                            >
                                {count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
