"use client";

import { useState, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useRole } from '@/hooks/useRole';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Banknote,
    TrendingUp,
    ShoppingBag,
    AlertCircle,
    Download,
    RefreshCw,
    FileSpreadsheet,
    FileText,
    ChevronDown
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Sale {
    id: string;
    item_id: string;
    name: string;
    cost_price: number;
    sold_price: number;
    quantity_sold: number;
    receipt_id: string;
    created_at: string;
}

interface ChartItem {
    name: string;
    revenue: number;
    profit: number;
}

/**
 * Custom hook: detect screen width breakpoints reactively.
 * Returns { isMobile, isTablet, isDesktop } for layout decisions.
 */
function useBreakpoint() {
    const [width, setWidth] = useState(
        typeof window !== 'undefined' ? window.innerWidth : 1024
    );

    useEffect(() => {
        const handleResize = () => setWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return {
        isMobile: width < 640,
        isTablet: width >= 640 && width < 1024,
        isDesktop: width >= 1024,
        width,
    };
}

export default function DashboardPage() {
    const { isAdmin, loading: roleLoading } = useRole();
    const router = useRouter();
    const { isMobile, isTablet } = useBreakpoint();

    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalRevenue: 0,
        totalProfit: 0,
        itemsSold: 0,
        lowStockItems: 0
    });
    const [chartData, setChartData] = useState<ChartItem[]>([]);
    const [recentSales, setRecentSales] = useState<Sale[]>([]);
    const [allSales, setAllSales] = useState<Sale[]>([]);
    const [exportMenuOpen, setExportMenuOpen] = useState(false);

    useEffect(() => {
        if (!roleLoading && !isAdmin) {
            router.replace('/pos');
        } else if (isAdmin) {
            fetchDashboardData();
        }
    }, [roleLoading, isAdmin]);

    // Close export menu when clicking outside
    useEffect(() => {
        if (!exportMenuOpen) return;
        const handleClickOutside = () => setExportMenuOpen(false);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [exportMenuOpen]);

    const fetchDashboardData = useCallback(async () => {
        setLoading(true);

        try {
            // Fetch all sales
            const { data: salesData, error: salesError } = await supabase.from('sales').select('*').order('created_at', { ascending: false });
            // Fetch inventory for low stock
            const { data: inventoryData, error: invError } = await supabase.from('inventory').select('quantity');

            if (salesError) throw salesError;
            if (invError) throw invError;

            const sales = salesData || [];
            const inventory = inventoryData || [];
            setAllSales(sales);

            // Calculate Stats
            let totalRevenue = 0;
            let totalProfit = 0;
            let itemsSoldLast30Days = 0;

            const now = new Date();
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(now.getDate() - 30);

            sales.forEach(sale => {
                const revenue = sale.sold_price * sale.quantity_sold;
                const profit = (sale.sold_price - sale.cost_price) * sale.quantity_sold;

                totalRevenue += revenue;
                totalProfit += profit;

                const saleDate = new Date(sale.created_at);
                if (saleDate >= thirtyDaysAgo) {
                    itemsSoldLast30Days += sale.quantity_sold;
                }
            });

            const lowStockItems = inventory.filter(item => item.quantity < 10).length;

            setStats({
                totalRevenue,
                totalProfit,
                itemsSold: itemsSoldLast30Days,
                lowStockItems
            });

            // Process Chart Data (Last 7 days)
            const salesByDate: { [key: string]: { date: string; revenue: number; profit: number } } = {};
            const today = new Date();
            for (let i = 6; i >= 0; i--) {
                const d = new Date(today);
                d.setDate(today.getDate() - i);
                const dateKey = format(d, 'yyyy-MM-dd');
                salesByDate[dateKey] = { date: dateKey, revenue: 0, profit: 0 };
            }

            sales.forEach(sale => {
                const saleDate = format(parseISO(sale.created_at), 'yyyy-MM-dd');
                if (salesByDate[saleDate]) {
                    salesByDate[saleDate].revenue += sale.sold_price * sale.quantity_sold;
                    salesByDate[saleDate].profit += (sale.sold_price - sale.cost_price) * sale.quantity_sold;
                }
            });

            const chartDataArray: ChartItem[] = Object.values(salesByDate).map((dayData: any) => ({
                name: format(parseISO(dayData.date), 'MMM dd'),
                revenue: dayData.revenue,
                profit: dayData.profit
            }));

            setChartData(chartDataArray);

            // Process Recent Transactions (top 10)
            const recent = sales.slice(0, 10);
            setRecentSales(recent);

        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    const exportToCSV = () => {
        if (allSales.length === 0) return;

        const headers = ["Date,Time,Receipt ID,Item Name,Cost Price,Sold Price,Quantity,Total,Profit\n"];
        const rows = allSales.map(sale => {
            const date = new Date(sale.created_at);
            const total = sale.sold_price * sale.quantity_sold;
            const profitValue = (sale.sold_price - sale.cost_price) * sale.quantity_sold;
            return `${format(date, 'yyyy-MM-dd')},${format(date, 'HH:mm:ss')},${sale.receipt_id},\"${sale.name.replace(/"/g, '""')}\",${sale.cost_price},${sale.sold_price},${sale.quantity_sold},${total.toFixed(2)},${profitValue.toFixed(2)}`;
        });

        const csvContent = "data:text/csv;charset=utf-8," + headers + rows.join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `party_favour_sales_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setExportMenuOpen(false);
    };

    const exportToPDF = () => {
        if (allSales.length === 0) return;

        const doc = new jsPDF();
        const dateStr = format(new Date(), 'PPpp');

        // Header
        doc.setFontSize(22);
        doc.setTextColor(79, 70, 229); // Indigo-600
        doc.text('Party Favour - Sales Report', 14, 20);

        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139); // Slate-500
        doc.text(`Generated on: ${dateStr}`, 14, 28);

        // Summary Stats
        doc.setDrawColor(226, 232, 240); // Slate-200
        doc.setFillColor(248, 250, 252); // Slate-50
        doc.roundedRect(14, 35, 182, 30, 3, 3, 'FD');

        doc.setFontSize(12);
        doc.setTextColor(30, 41, 59); // Slate-800
        doc.setFont('helvetica', 'bold');
        doc.text('Performance Summary', 20, 42);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Total Revenue: Rs. ${stats.totalRevenue.toFixed(2)}`, 20, 50);
        doc.text(`Total Profit: Rs. ${stats.totalProfit.toFixed(2)}`, 20, 57);
        doc.text(`Items Sold (Last 30 days): ${stats.itemsSold}`, 110, 50);

        // Transactions Table
        const tableData = allSales.map(sale => [
            format(new Date(sale.created_at), 'MMM dd, p'),
            sale.receipt_id,
            sale.name,
            `${sale.quantity_sold}`,
            `Rs. ${sale.sold_price.toFixed(2)}`,
            `Rs. ${(sale.sold_price * sale.quantity_sold).toFixed(2)}`
        ]);

        autoTable(doc, {
            startY: 75,
            head: [['Date', 'Receipt', 'Item', 'Qty', 'Price', 'Total']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [71, 85, 105] }, // Slate-600
            styles: { fontSize: 8 },
            alternateRowStyles: { fillColor: [241, 245, 249] } // Slate-100
        });

        doc.save(`party_favour_report_${format(new Date(), 'yyyyMMdd')}.pdf`);
        setExportMenuOpen(false);
    };

    // ----------------------------
    // LOADING STATE
    // ----------------------------
    if (loading || roleLoading) {
        return (
            <div className="min-h-screen min-h-[100dvh] bg-slate-50 flex flex-col items-center justify-center font-sans px-4">
                <RefreshCw size={isMobile ? 36 : 48} className="animate-spin text-indigo-500 mb-4 opacity-50" />
                <p className="text-slate-500 font-medium tracking-tight text-sm sm:text-base text-center">Loading Dashboard Data...</p>
            </div>
        );
    }

    if (!isAdmin) return null;

    // ----------------------------
    // STAT CARD COMPONENT
    // ----------------------------
    const StatCard = ({
        label,
        value,
        subLabel,
        icon: Icon,
        iconBg,
        iconColor,
        iconBorder,
        valueColor = 'text-slate-900',
        subColor = 'text-emerald-600',
        pulse = false,
    }: {
        label: string;
        value: string;
        subLabel: string;
        icon: any;
        iconBg: string;
        iconColor: string;
        iconBorder: string;
        valueColor?: string;
        subColor?: string;
        pulse?: boolean;
    }) => (
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-3 transition-all hover:shadow-md hover:border-slate-300">
            <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-slate-500 mb-0.5 sm:mb-1 truncate">{label}</p>
                <h3 className={`text-lg sm:text-xl md:text-2xl font-bold ${valueColor} truncate`}>{value}</h3>
                <p className={`text-[10px] sm:text-xs ${subColor} font-medium mt-0.5 sm:mt-1 inline-flex items-center gap-1 line-clamp-1`}>
                    {subLabel}
                </p>
            </div>
            <div className={`w-10 h-10 sm:w-12 sm:h-12 ${iconBg} ${iconColor} rounded-lg flex items-center justify-center border ${iconBorder} flex-shrink-0 ${pulse ? 'animate-pulse' : ''}`}>
                <Icon size={isMobile ? 18 : 24} />
            </div>
        </div>
    );

    // Chart bar size responsive
    const chartBarSize = isMobile ? 14 : isTablet ? 18 : 24;
    const chartLeftMargin = isMobile ? -30 : -20;
    const chartFontSize = isMobile ? 10 : 12;

    return (
        <div className="min-h-screen min-h-[100dvh] bg-slate-50 p-3 pt-14 sm:p-4 sm:pt-4 md:p-6 lg:p-8 font-sans text-slate-900">

            {/* ====== HEADER ====== */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-5 sm:mb-6 md:mb-8">
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Financial Dashboard</h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5 sm:mt-1">Overview of your store&apos;s performance metrics.</p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                        onClick={fetchDashboardData}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg text-sm font-medium transition-all shadow-sm active:scale-95"
                    >
                        <RefreshCw size={16} className="text-slate-400" />
                        <span className="hidden xs:inline sm:inline">Refresh</span>
                    </button>

                    <div className="relative flex-1 sm:flex-initial">
                        <button
                            onClick={(e) => { e.stopPropagation(); setExportMenuOpen(!exportMenuOpen); }}
                            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg text-sm font-medium transition-all shadow-[0_4px_10px_rgb(79,70,229,0.2)] active:scale-95"
                        >
                            <Download size={16} />
                            <span>Export</span>
                            <ChevronDown size={14} className={`transition-transform ${exportMenuOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {exportMenuOpen && (
                            <div
                                className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <button
                                    onClick={exportToCSV}
                                    className="w-full flex items-center gap-3 px-4 py-3.5 sm:py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left border-b border-slate-50"
                                >
                                    <FileSpreadsheet size={18} className="text-emerald-500" />
                                    <span>Export as CSV</span>
                                </button>
                                <button
                                    onClick={exportToPDF}
                                    className="w-full flex items-center gap-3 px-4 py-3.5 sm:py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                                >
                                    <FileText size={18} className="text-red-500" />
                                    <span>Export as PDF</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ====== STAT CARDS ====== */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5 sm:mb-6 md:mb-8">

                <StatCard
                    label="Total Revenue"
                    value={`Rs. ${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    subLabel="All time generated"
                    icon={Banknote}
                    iconBg="bg-indigo-50"
                    iconColor="text-indigo-600"
                    iconBorder="border-indigo-100"
                />

                <StatCard
                    label="Total Profit"
                    value={`Rs. ${stats.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    subLabel="All time net profit"
                    icon={TrendingUp}
                    iconBg="bg-emerald-50"
                    iconColor="text-emerald-600"
                    iconBorder="border-emerald-100"
                />

                <StatCard
                    label="Items Sold"
                    value={stats.itemsSold.toLocaleString()}
                    subLabel="Last 30 days"
                    icon={ShoppingBag}
                    iconBg="bg-blue-50"
                    iconColor="text-blue-600"
                    iconBorder="border-blue-100"
                    subColor="text-slate-400"
                />

                <StatCard
                    label="Low Stock"
                    value={`${stats.lowStockItems} Items`}
                    subLabel={stats.lowStockItems > 0 ? "Needs restock" : "Inventory healthy"}
                    icon={AlertCircle}
                    iconBg={stats.lowStockItems > 0 ? "bg-red-50" : "bg-emerald-50"}
                    iconColor={stats.lowStockItems > 0 ? "text-red-600" : "text-emerald-600"}
                    iconBorder={stats.lowStockItems > 0 ? "border-red-100" : "border-emerald-100"}
                    valueColor={stats.lowStockItems > 0 ? "text-red-600" : "text-emerald-600"}
                    subColor={stats.lowStockItems > 0 ? "text-red-500" : "text-emerald-500"}
                    pulse={stats.lowStockItems > 0}
                />

            </div>

            {/* ====== CHART + RECENT TRANSACTIONS ====== */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">

                {/* Chart Section */}
                <div className="lg:col-span-2 bg-white p-4 sm:p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col"
                    style={{ minHeight: isMobile ? '280px' : '400px' }}
                >
                    <div className="mb-3 sm:mb-4 md:mb-6">
                        <h2 className="text-sm sm:text-base font-bold text-slate-900">Revenue vs. Profit</h2>
                        <p className="text-xs sm:text-sm text-slate-500">Last 7 days performance</p>
                    </div>

                    <div className="flex-1 w-full min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={chartData}
                                margin={{ top: 0, right: 0, left: chartLeftMargin, bottom: 0 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: chartFontSize }}
                                    dy={10}
                                    interval={isMobile ? 1 : 0}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: chartFontSize }}
                                    width={isMobile ? 40 : 60}
                                    tickFormatter={(value: number) => {
                                        if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
                                        return value.toString();
                                    }}
                                />
                                <Tooltip
                                    formatter={(value: any) => ['Rs. ' + Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })]}
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{
                                        borderRadius: '8px',
                                        border: '1px solid #e2e8f0',
                                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                        fontSize: isMobile ? '11px' : '13px',
                                        padding: isMobile ? '6px 8px' : '8px 12px',
                                    }}
                                />
                                <Legend
                                    wrapperStyle={{ paddingTop: isMobile ? '8px' : '20px', fontSize: isMobile ? '11px' : '13px' }}
                                    iconType="circle"
                                    iconSize={isMobile ? 8 : 10}
                                />
                                <Bar dataKey="revenue" name="Revenue" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={chartBarSize} />
                                <Bar dataKey="profit" name="Profit" fill="#10b981" radius={[4, 4, 0, 0]} barSize={chartBarSize} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Recent Sales Table / List */}
                <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col"
                    style={{ minHeight: isMobile ? '320px' : '400px', maxHeight: isMobile ? '420px' : '400px' }}
                >
                    <div className="p-4 sm:p-5 border-b border-slate-100">
                        <h2 className="text-sm sm:text-base font-bold text-slate-900">Recent Transactions</h2>
                        <p className="text-xs sm:text-sm text-slate-500">Latest completed sales</p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-1.5 sm:p-2">
                        {recentSales.length > 0 ? (
                            <ul className="divide-y divide-slate-100">
                                {recentSales.map((sale, idx) => (
                                    <li key={idx} className="p-2.5 sm:p-3 hover:bg-slate-50 rounded-lg transition-colors flex justify-between items-center group cursor-pointer gap-2">
                                        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors flex-shrink-0">
                                                <Banknote size={isMobile ? 14 : 16} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">{sale.name}</p>
                                                <p className="text-[10px] sm:text-[11px] font-semibold text-slate-400 mt-0.5">{format(new Date(sale.created_at), 'p')}</p>
                                            </div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <p className="text-xs sm:text-sm font-bold text-slate-900">Rs. {sale.sold_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                            <p className="text-[10px] sm:text-[11px] font-semibold text-emerald-500 mt-0.5">
                                                {(sale.sold_price - sale.cost_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} profit
                                            </p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="h-full flex flex-col justify-center items-center text-slate-400 py-8">
                                <ShoppingBag size={isMobile ? 28 : 32} className="opacity-40 mb-2" />
                                <p className="text-xs sm:text-sm font-medium">No recent sales.</p>
                            </div>
                        )}
                    </div>

                    <div className="p-2.5 sm:p-3 border-t border-slate-100 bg-slate-50/50 rounded-b-xl text-center">
                        <Link href="/sales" className="text-xs sm:text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors w-full inline-block py-1">
                            View All Sales →
                        </Link>
                    </div>
                </div>

            </div>
        </div>
    );
}
