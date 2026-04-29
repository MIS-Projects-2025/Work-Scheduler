import SidebarLink from "@/Components/sidebar/SidebarLink";
import { LayoutDashboard, FileSpreadsheet, CalendarDays } from "lucide-react";

export default function NavLinks({ isSidebarOpen }) {
    return (
        <nav
            className="flex flex-col flex-grow space-y-1 overflow-y-auto"
            style={{ scrollbarWidth: "none" }}
        >
            <SidebarLink
                href={route("dashboard")}
                label="Dashboard"
                icon={<LayoutDashboard className="w-5 h-5" />}
                isSidebarOpen={isSidebarOpen}
            />
            <SidebarLink
                href={route("workschedule.template")}
                label="Create Work Schedule"
                icon={<FileSpreadsheet className="w-5 h-5" />}
                isSidebarOpen={isSidebarOpen}
            />
            <SidebarLink
                href={route("workschedule.index")}
                label="Work Schedules"
                icon={<CalendarDays className="w-5 h-5" />}
                isSidebarOpen={isSidebarOpen}
            />
            <SidebarLink
                href={route("holidays.page")}
                label="Holidays"
                icon={<CalendarDays className="w-5 h-5" />}
                isSidebarOpen={isSidebarOpen}
            />
        </nav>
    );
}
