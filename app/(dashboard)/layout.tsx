import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div className="flex min-h-screen min-h-[100dvh] relative w-full overflow-hidden safe-area-top">
            {/* Desktop: sidebar takes fixed space. Mobile: sidebar is overlay via its own positioning */}
            <div className="hidden md:block w-64 flex-shrink-0 z-50 print:hidden">
                <Sidebar />
            </div>

            <div className="md:hidden print:hidden">
                <Sidebar />
            </div>

            {/* Main Content Area — uses dvh for mobile browsers, proper scroll */}
            <main className="flex-1 min-w-0 relative h-screen h-[100dvh] overflow-y-auto safe-area-bottom">
                {children}
            </main>
        </div>
    );
}
