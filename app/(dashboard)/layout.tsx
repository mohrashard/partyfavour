import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div className="flex min-h-screen relative w-full overflow-hidden">
            {/* 
        Sidebar (Hidden on mobile via its internal classes but still takes 
        up space on desktop via the md:w-64 class here implicitly, though 
        we manage the margin primarily on the main content area) 
      */}
            <div className="hidden md:block w-64 flex-shrink-0 z-50 print:hidden">
                <Sidebar />
            </div>

            <div className="md:hidden print:hidden">
                <Sidebar />
            </div>

            {/* Main Content Area (flex-1 to take up remaining space) */}
            <main className="flex-1 min-w-0 relative h-screen overflow-y-auto">
                {children}
            </main>
        </div>
    );
}
