"use client";

import { useState, useEffect, useMemo } from 'react';
import { format, isWithinInterval, startOfDay, endOfDay, subDays } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useRole } from '@/hooks/useRole';
import Link from 'next/link';
import {
    ArrowLeft,
    RefreshCw,
    Receipt,
    TrendingUp,
    Banknote,
    ShoppingBag,
    Search,
    ChevronDown,
    ChevronUp,
    X,
    CalendarDays,
    PackageCheck,
    Printer,
    Trash2,
    AlertTriangle,
} from 'lucide-react';

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

interface GroupedReceipt {
    receipt_id: string;
    date: Date;
    items: Sale[];
    total: number;
    profit: number;
}

type DateRange = 'today' | '7days' | '30days' | 'all';
type SortKey = 'date' | 'total' | 'profit' | 'items';
type SortDir = 'asc' | 'desc';

export default function SalesPage() {
    const { isAdmin } = useRole();
    const [allSales, setAllSales] = useState<Sale[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState<DateRange>('all');
    const [sortKey, setSortKey] = useState<SortKey>('date');
    const [sortDir, setSortDir] = useState<SortDir>('desc');
    const [expandedReceipts, setExpandedReceipts] = useState<Set<string>>(new Set());

    // Receipt print overlay
    const [printReceipt, setPrintReceipt] = useState<GroupedReceipt | null>(null);
    const [receiptSettings, setReceiptSettings] = useState({
        address1: '123 Party Lane',
        address2: 'Celebration City',
        phone: '(555) 019-2831',
    });

    // Delete states
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<GroupedReceipt | null>(null);

    // Clear All states
    const [showClearAll, setShowClearAll] = useState(false);
    const [isClearing, setIsClearing] = useState(false);

    useEffect(() => {
        fetchSales();
        loadReceiptSettings();
    }, []);

    async function loadReceiptSettings() {
        const { data } = await supabase
            .from('settings')
            .select('address1, address2, phone')
            .eq('id', 'store')
            .single();

        if (data) {
            const s = { address1: data.address1 ?? '', address2: data.address2 ?? '', phone: data.phone ?? '' };
            setReceiptSettings(s);
            localStorage.setItem('pos_receipt_settings', JSON.stringify(s));
        } else {
            const cached = localStorage.getItem('pos_receipt_settings');
            if (cached) {
                try { setReceiptSettings(JSON.parse(cached)); } catch (_) { }
            }
        }
    }

    async function fetchSales() {
        setLoading(true);
        const { data, error } = await supabase
            .from('sales')
            .select('*')
            .order('created_at', { ascending: false });
        if (!error && data) setAllSales(data);
        setLoading(false);
    }

    function toggleReceipt(receiptId: string) {
        setExpandedReceipts(prev => {
            const next = new Set(prev);
            next.has(receiptId) ? next.delete(receiptId) : next.add(receiptId);
            return next;
        });
    }

    // ── Delete a single receipt ──────────────────────────────────────────────
    async function handleDelete(receipt: GroupedReceipt) {
        setDeletingId(receipt.receipt_id);
        const { error } = await supabase
            .from('sales')
            .delete()
            .eq('receipt_id', receipt.receipt_id);

        if (!error) {
            setAllSales(prev => prev.filter(s => s.receipt_id !== receipt.receipt_id));
            setExpandedReceipts(prev => {
                const next = new Set(prev);
                next.delete(receipt.receipt_id);
                return next;
            });
        }
        setDeletingId(null);
        setConfirmDelete(null);
    }

    // ── Clear All ────────────────────────────────────────────────────────────
    async function handleClearAll() {
        if (!confirm('Are you sure you want to permanently clear ALL sales records? This cannot be undone.')) return;
        setIsClearing(true);
        // Using .not('id', 'is', null) is more robust for "delete all" than .neq('id', '')
        const { error } = await supabase.from('sales').delete().not('id', 'is', null);
        if (error) {
            alert('Error clearing sales: ' + error.message);
        } else {
            setAllSales([]);
            setExpandedReceipts(new Set());
        }
        setIsClearing(false);
        setShowClearAll(false);
    }

    // ── Grouping ─────────────────────────────────────────────────────────────
    const groupedReceipts = useMemo<GroupedReceipt[]>(() => {
        const map: { [key: string]: GroupedReceipt } = {};
        allSales.forEach(sale => {
            if (!map[sale.receipt_id]) {
                map[sale.receipt_id] = {
                    receipt_id: sale.receipt_id,
                    date: new Date(sale.created_at),
                    items: [],
                    total: 0,
                    profit: 0,
                };
            }
            map[sale.receipt_id].items.push(sale);
            map[sale.receipt_id].total += sale.sold_price * sale.quantity_sold;
            map[sale.receipt_id].profit += (sale.sold_price - sale.cost_price) * sale.quantity_sold;
        });
        return Object.values(map);
    }, [allSales]);

    // ── Filtering + Sorting ───────────────────────────────────────────────────
    const filteredReceipts = useMemo<GroupedReceipt[]>(() => {
        const now = new Date();
        let filtered = groupedReceipts;

        if (dateRange !== 'all') {
            const rangeStart =
                dateRange === 'today' ? startOfDay(now)
                    : dateRange === '7days' ? startOfDay(subDays(now, 6))
                        : startOfDay(subDays(now, 29));
            filtered = filtered.filter(r =>
                isWithinInterval(r.date, { start: rangeStart, end: endOfDay(now) })
            );
        }

        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            filtered = filtered.filter(
                r =>
                    r.receipt_id.toLowerCase().includes(q) ||
                    r.items.some(i => i.name.toLowerCase().includes(q))
            );
        }

        return [...filtered].sort((a, b) => {
            const valA =
                sortKey === 'date' ? a.date.getTime()
                    : sortKey === 'total' ? a.total
                        : sortKey === 'profit' ? a.profit
                            : a.items.reduce((s, i) => s + i.quantity_sold, 0);
            const valB =
                sortKey === 'date' ? b.date.getTime()
                    : sortKey === 'total' ? b.total
                        : sortKey === 'profit' ? b.profit
                            : b.items.reduce((s, i) => s + i.quantity_sold, 0);
            return sortDir === 'desc' ? valB - valA : valA - valB;
        });
    }, [groupedReceipts, dateRange, searchTerm, sortKey, sortDir]);

    // ── Summary ───────────────────────────────────────────────────────────────
    const summary = useMemo(() => ({
        totalRevenue: filteredReceipts.reduce((s, r) => s + r.total, 0),
        totalProfit: filteredReceipts.reduce((s, r) => s + r.profit, 0),
        totalTransactions: filteredReceipts.length,
        totalItemsSold: filteredReceipts.reduce((s, r) => s + r.items.reduce((is, i) => is + i.quantity_sold, 0), 0),
    }), [filteredReceipts]);

    function handleSort(key: SortKey) {
        sortKey === key ? setSortDir(d => d === 'asc' ? 'desc' : 'asc') : (setSortKey(key), setSortDir('desc'));
    }

    const SortIcon = ({ col }: { col: SortKey }) =>
        sortKey !== col
            ? <ChevronDown size={14} className="text-slate-300" />
            : sortDir === 'desc'
                ? <ChevronDown size={14} className="text-indigo-500" />
                : <ChevronUp size={14} className="text-indigo-500" />;

    const dateRangeLabels: Record<DateRange, string> = {
        today: 'Today', '7days': 'Last 7 Days', '30days': 'Last 30 Days', all: 'All Time',
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans">
                <RefreshCw size={48} className="animate-spin text-indigo-500 mb-4 opacity-50" />
                <p className="text-slate-500 font-medium tracking-tight">Loading Sales History...</p>
            </div>
        );
    }

    return (
        <>
            {/* ── Print Styles (hidden from screen) ── */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page { margin: 0; size: 80mm auto; }
                    body { margin: 0; -webkit-print-color-adjust: exact; }
                    .no-print { display: none !important; }
                }
            `}} />

            {/* ══════════════════════════════════
                SCREEN UI  (hidden when printing)
            ══════════════════════════════════ */}
            <div className="min-h-screen bg-slate-50 font-sans text-slate-900 no-print">

                {/* ── Header ── */}
                <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-3 sm:px-6 lg:px-8 h-14 md:h-16 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2 sm:gap-4">
                        <Link href="/dashboard" className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-600 transition-colors">
                            <ArrowLeft size={18} className="sm:w-5 sm:h-5" />
                        </Link>
                        <div className="flex items-center gap-2 sm:gap-2.5">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200">
                                <Receipt size={14} className="sm:w-4 sm:h-4" strokeWidth={2.5} />
                            </div>
                            <div>
                                <h1 className="font-bold text-sm sm:text-base leading-tight text-slate-900">Sales History</h1>
                                <p className="text-[10px] sm:text-[11px] text-slate-400 leading-none">{filteredReceipts.length} <span className="hidden sm:inline">transactions</span><span className="inline sm:hidden">txns</span></p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2">
                        {/* Clear All */}
                        {isAdmin && allSales.length > 0 && (
                            <button
                                onClick={() => setShowClearAll(true)}
                                className="flex items-center gap-1.5 bg-red-50 border border-red-200 hover:bg-red-100 text-red-600 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all shadow-sm active:scale-95"
                            >
                                <Trash2 size={14} />
                                <span className="hidden md:inline">Clear All</span>
                            </button>
                        )}
                        <button
                            onClick={fetchSales}
                            className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all shadow-sm active:scale-95"
                        >
                            <RefreshCw size={14} className="text-slate-400" />
                            <span className="hidden sm:inline">Refresh</span>
                        </button>
                    </div>
                </div>

                <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 pb-safe">

                    {/* ── Summary Stats ── */}
                    <div className={`grid grid-cols-2 ${isAdmin ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-2 sm:gap-4 mb-4 sm:mb-6`}>
                        {[
                            { label: 'Total Revenue', value: `Rs. ${summary.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: <Banknote size={20} />, bg: 'bg-indigo-50', border: 'border-indigo-100', text: 'text-indigo-600', val: 'text-slate-900', adminOnly: false },
                            { label: 'Net Profit', value: `Rs. ${summary.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: <TrendingUp size={20} />, bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-600', val: 'text-emerald-600', adminOnly: true },
                            { label: 'Transactions', value: summary.totalTransactions.toLocaleString(), icon: <Receipt size={20} />, bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-600', val: 'text-slate-900', adminOnly: false },
                            { label: 'Items Sold', value: summary.totalItemsSold.toLocaleString(), icon: <ShoppingBag size={20} />, bg: 'bg-violet-50', border: 'border-violet-100', text: 'text-violet-600', val: 'text-slate-900', adminOnly: false },
                        ].filter(c => !c.adminOnly || isAdmin).map(card => (
                            <div key={card.label} className="bg-white p-3 sm:p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                                <div className={`w-8 h-8 sm:w-10 sm:h-10 ${card.bg} ${card.text} rounded-lg flex items-center justify-center border ${card.border} flex-shrink-0`}>
                                    <div className="scale-75 sm:scale-100">{card.icon}</div>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] sm:text-xs font-medium text-slate-500 truncate">{card.label}</p>
                                    <p className={`text-base sm:text-xl font-extrabold ${card.val} leading-tight truncate`}>{card.value}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ── Filters & Search ── */}
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-3 mb-4 sm:mb-5 flex flex-col md:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search receipt or item..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full h-10 sm:h-11 pl-9 pr-8 bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all placeholder-slate-500 text-slate-900"
                            />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1">
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar w-full md:w-auto">
                            <CalendarDays size={15} className="text-slate-400 mr-0.5 flex-shrink-0 hidden sm:block" />
                            {(['today', '7days', '30days', 'all'] as DateRange[]).map(range => (
                                <button
                                    key={range}
                                    onClick={() => setDateRange(range)}
                                    className={`flex-shrink-0 h-9 sm:h-10 px-3 sm:px-4 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${dateRange === range ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                >
                                    {dateRangeLabels[range]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ── Sales Table ── */}
                    {filteredReceipts.length === 0 ? (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-16 flex flex-col items-center justify-center text-center">
                            <PackageCheck size={48} className="text-slate-200 mb-4" />
                            <p className="font-bold text-slate-700 mb-1">No sales found</p>
                            <p className="text-sm text-slate-400">
                                {searchTerm || dateRange !== 'all'
                                    ? 'Try adjusting your filters or search term.'
                                    : 'Complete a sale from the POS to see it here.'}
                            </p>
                            {(searchTerm || dateRange !== 'all') && (
                                <button
                                    onClick={() => { setSearchTerm(''); setDateRange('all'); }}
                                    className="mt-4 text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                                >
                                    Clear filters
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

                            {/* Desktop Table Headers */}
                            <div className="hidden sm:grid gap-x-4 px-5 py-3 bg-slate-50/80 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ gridTemplateColumns: isAdmin ? '1fr auto auto auto auto' : '1fr auto auto auto' }}>
                                <button onClick={() => handleSort('date')} className="flex items-center gap-1 text-left hover:text-slate-800 transition-colors">
                                    Date & Receipt <SortIcon col="date" />
                                </button>
                                <button onClick={() => handleSort('items')} className="flex items-center gap-1 justify-end hover:text-slate-800 transition-colors">
                                    Items <SortIcon col="items" />
                                </button>
                                <button onClick={() => handleSort('total')} className="flex items-center gap-1 justify-end hover:text-slate-800 transition-colors">
                                    Revenue <SortIcon col="total" />
                                </button>
                                {isAdmin && (
                                    <button onClick={() => handleSort('profit')} className="flex items-center gap-1 justify-end hover:text-slate-800 transition-colors">
                                        Profit <SortIcon col="profit" />
                                    </button>
                                )}
                                <span className="text-right">Actions</span>
                            </div>

                            {/* Mobile Filters / Sort Header */}
                            <div className="sm:hidden flex items-center justify-between px-4 py-3 bg-slate-50/80 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                <span>Recent Receipts</span>
                                <div className="flex gap-3">
                                    <button onClick={() => handleSort('date')} className="flex items-center gap-1">Date <SortIcon col="date" /></button>
                                    <button onClick={() => handleSort('total')} className="flex items-center gap-1">Rev <SortIcon col="total" /></button>
                                </div>
                            </div>

                            {/* Rows */}
                            <ul className="divide-y divide-slate-100">
                                {filteredReceipts.map(receipt => {
                                    const isExpanded = expandedReceipts.has(receipt.receipt_id);
                                    const itemsCount = receipt.items.reduce((s, i) => s + i.quantity_sold, 0);
                                    const profitPct = receipt.total > 0 ? (receipt.profit / receipt.total) * 100 : 0;
                                    const isDeleting = deletingId === receipt.receipt_id;

                                    return (
                                        <li key={receipt.receipt_id} className={`transition-opacity ${isDeleting ? 'opacity-40 pointer-events-none' : ''}`}>

                                            {/* ── DESKTOP ROW ── */}
                                            <div className="hidden sm:grid gap-x-4 px-5 py-4 hover:bg-slate-50/80 transition-colors group items-center cursor-pointer" style={{ gridTemplateColumns: isAdmin ? '1fr auto auto auto auto' : '1fr auto auto auto' }} onClick={(e) => {
                                                // Prevent expanding if clicking specific action buttons
                                                if ((e.target as HTMLElement).closest('button[title]')) return;
                                                toggleReceipt(receipt.receipt_id);
                                            }}>

                                                {/* Date & ID */}
                                                <div className="text-left">
                                                    <p className="font-bold text-slate-900 text-sm leading-tight">
                                                        {format(receipt.date, 'dd MMM yyyy')}
                                                        <span className="ml-2 text-[11px] font-normal text-slate-400">{format(receipt.date, 'hh:mm a')}</span>
                                                    </p>
                                                    <p className="text-xs font-mono text-slate-400 mt-0.5">{receipt.receipt_id}</p>
                                                </div>

                                                {/* Items count */}
                                                <div className="flex items-center justify-end">
                                                    <span className="bg-slate-100 text-slate-600 font-bold text-xs px-2 py-0.5 rounded-md">
                                                        {itemsCount} {itemsCount === 1 ? 'item' : 'items'}
                                                    </span>
                                                </div>

                                                {/* Revenue */}
                                                <div className="flex items-center justify-end">
                                                    <span className="font-bold text-slate-900 text-sm tabular-nums">
                                                        Rs. {receipt.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                </div>

                                                {/* Profit */}
                                                {isAdmin && (
                                                    <div className="flex flex-col items-end justify-center">
                                                        <span className="font-bold text-emerald-600 text-sm tabular-nums">
                                                            Rs. {receipt.profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-medium">{profitPct.toFixed(1)}% margin</span>
                                                    </div>
                                                )}

                                                {/* Actions */}
                                                <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                                                    {/* Generate Receipt */}
                                                    <button
                                                        onClick={() => setPrintReceipt(receipt)}
                                                        title="Generate Receipt"
                                                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all active:scale-95"
                                                    >
                                                        <Printer size={14} />
                                                    </button>

                                                    {/* Delete */}
                                                    {isAdmin && (
                                                        <button
                                                            onClick={() => setConfirmDelete(receipt)}
                                                            title="Delete Transaction"
                                                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-500 border border-red-100 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all active:scale-95"
                                                        >
                                                            {isDeleting
                                                                ? <RefreshCw size={13} className="animate-spin" />
                                                                : <Trash2 size={13} />}
                                                        </button>
                                                    )}

                                                    <button
                                                        onClick={() => toggleReceipt(receipt.receipt_id)}
                                                        title="View line items"
                                                        className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all active:scale-95 ${isExpanded ? 'bg-indigo-100 text-indigo-600 border-indigo-200' : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'}`}
                                                    >
                                                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* ── MOBILE ROW (Card format) ── */}
                                            <div className="sm:hidden flex items-start justify-between px-4 py-4 hover:bg-slate-50/50 transition-colors" onClick={() => toggleReceipt(receipt.receipt_id)}>
                                                <div className="flex-1 pr-3">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-bold text-slate-900 text-sm">{format(receipt.date, 'MMM dd, yyyy')}</span>
                                                        <span className="text-xs text-slate-500">{format(receipt.date, 'hh:mm a')}</span>
                                                    </div>
                                                    <p className="font-mono text-[10px] text-slate-400 mb-2 truncate">{receipt.receipt_id}</p>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="bg-slate-100 text-slate-600 font-medium text-[10px] px-2 py-0.5 rounded-full">
                                                            {itemsCount} {itemsCount === 1 ? 'item' : 'items'}
                                                        </span>
                                                        {isAdmin && receipt.profit > 0 && (
                                                            <span className="bg-emerald-50 text-emerald-600 font-medium text-[10px] px-2 py-0.5 rounded-full border border-emerald-100">
                                                                + Rs. {receipt.profit.toFixed(2)} profit
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-3 flex-shrink-0" onClick={e => e.stopPropagation()}>
                                                    <span className="font-bold text-slate-900 text-base">Rs. {receipt.total.toFixed(2)}</span>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => setPrintReceipt(receipt)} className="w-8 h-8 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg flex items-center justify-center active:bg-indigo-100 transition-colors">
                                                            <Printer size={14} />
                                                        </button>
                                                        {isAdmin && (
                                                            <button onClick={() => setConfirmDelete(receipt)} className="w-8 h-8 bg-red-50 text-red-500 border border-red-100 rounded-lg flex items-center justify-center active:bg-red-100 transition-colors">
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                        <button onClick={() => toggleReceipt(receipt.receipt_id)} className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all active:scale-95 ${isExpanded ? 'bg-indigo-100 text-indigo-600 border-indigo-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Expanded Line Items */}
                                            {isExpanded && (
                                                <div className="border-t border-slate-100 bg-slate-50 px-3 sm:px-5 py-3 sm:py-4">
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Line Items</p>
                                                    <div className="rounded-lg border border-slate-200 overflow-x-auto bg-white no-scrollbar">
                                                        <table className="w-full text-xs sm:text-sm min-w-[500px]">
                                                            <thead>
                                                                <tr className="border-b border-slate-100 bg-slate-50">
                                                                    <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Product</th>
                                                                    <th className="text-center px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Qty</th>
                                                                    <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Unit Price</th>
                                                                    <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Line Total</th>
                                                                    {isAdmin && <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Line Profit</th>}
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100">
                                                                {receipt.items.map(item => (
                                                                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                                                        <td className="px-4 py-2.5 font-medium text-slate-900">{item.name}</td>
                                                                        <td className="px-4 py-2.5 text-center">
                                                                            <span className="bg-slate-100 text-slate-700 font-bold text-xs px-2 py-0.5 rounded">×{item.quantity_sold}</span>
                                                                        </td>
                                                                        <td className="px-4 py-2.5 text-right font-mono text-slate-600 text-xs">Rs. {item.sold_price.toFixed(2)}</td>
                                                                        <td className="px-4 py-2.5 text-right font-bold text-slate-900 tabular-nums">Rs. {(item.sold_price * item.quantity_sold).toFixed(2)}</td>
                                                                        {isAdmin && <td className="px-4 py-2.5 text-right font-bold text-emerald-600 tabular-nums">Rs. {((item.sold_price - item.cost_price) * item.quantity_sold).toFixed(2)}</td>}
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                            <tfoot className="border-t border-slate-200 bg-slate-50">
                                                                <tr>
                                                                    <td colSpan={3} className="px-4 py-2.5 text-right text-xs font-bold text-slate-500 uppercase tracking-wide">Receipt Total</td>
                                                                    <td className="px-4 py-2.5 text-right font-extrabold text-slate-900 tabular-nums">Rs. {receipt.total.toFixed(2)}</td>
                                                                    {isAdmin && <td className="px-4 py-2.5 text-right font-extrabold text-emerald-600 tabular-nums">Rs. {receipt.profit.toFixed(2)}</td>}
                                                                </tr>
                                                            </tfoot>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>

                            {/* Table Footer */}
                            <div className="px-4 sm:px-5 py-3 border-t border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-1 sm:gap-2">
                                <p className="text-[11px] sm:text-xs text-slate-400 font-medium">
                                    Showing <span className="text-slate-700 font-bold">{filteredReceipts.length}</span> of{' '}
                                    <span className="text-slate-700 font-bold">{groupedReceipts.length}</span> transactions
                                </p>
                                <p className="text-[10px] sm:text-xs text-slate-400">
                                    Sorted by <span className="text-slate-600 font-semibold capitalize">{sortKey}</span>{' '}
                                    ({sortDir === 'desc' ? 'newest first' : 'oldest first'})
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════
                GENERATE RECEIPT OVERLAY  (screen only, triggers print)
            ══════════════════════════════════════════════════════ */}
            {printReceipt && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 no-print sm:pb-safe animate-in fade-in duration-200">
                    <div className="bg-white rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl w-full sm:max-w-sm flex flex-col overflow-hidden max-h-[95vh] animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                                    <Printer size={15} strokeWidth={2.5} />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-900 text-sm leading-tight">Receipt Preview</p>
                                    <p className="text-[10px] md:text-[11px] font-mono text-slate-400">{printReceipt.receipt_id}</p>
                                </div>
                            </div>
                            <button onClick={() => setPrintReceipt(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition-colors">
                                <X size={16} />
                            </button>
                        </div>

                        {/* Receipt Preview (scrollable) */}
                        <div className="overflow-y-auto max-h-[55vh] p-6 font-mono text-black text-[12px] bg-slate-50 border-b border-slate-100">
                            <div className="text-center mb-4">
                                <h2 className="text-lg font-bold uppercase tracking-widest mb-1">PARTY FAVOUR</h2>
                                <p className="text-[10px]">{receiptSettings.address1}</p>
                                {receiptSettings.address2 && <p className="text-[10px]">{receiptSettings.address2}</p>}
                                <p className="text-[10px] mt-1">Tel: {receiptSettings.phone}</p>
                                <div className="border-b border-dashed border-black/40 my-3" />
                            </div>
                            <div className="mb-3 text-[11px] leading-tight">
                                <div className="flex justify-between"><span>Receipt:</span><span className="font-bold">{printReceipt.receipt_id}</span></div>
                                <div className="flex justify-between mt-1"><span>Date:</span><span>{printReceipt.date.toLocaleString()}</span></div>
                            </div>
                            <div className="border-b border-dashed border-black/40 mb-2" />
                            <table className="w-full text-left mb-2 text-[11px]">
                                <thead>
                                    <tr className="border-b border-black/20">
                                        <th className="py-1 font-bold">Item</th>
                                        <th className="py-1 text-center font-bold">Qty</th>
                                        <th className="py-1 text-right font-bold">Price</th>
                                        <th className="py-1 text-right font-bold">Amt</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {printReceipt.items.map(item => (
                                        <tr key={item.id}>
                                            <td className="py-1.5 align-top">{item.name.length > 15 ? item.name.substring(0, 15) + '…' : item.name}</td>
                                            <td className="py-1.5 text-center align-top">{item.quantity_sold}</td>
                                            <td className="py-1.5 text-right align-top">{item.sold_price.toFixed(2)}</td>
                                            <td className="py-1.5 text-right font-bold align-top">{(item.sold_price * item.quantity_sold).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="border-b border-dashed border-black/40 mb-2" />
                            <div className="flex justify-between font-bold text-sm mb-1 mt-3">
                                <span>TOTAL AMOUNT:</span>
                                <span>Rs. {printReceipt.total.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-[11px] mb-4">
                                <span>Payment Method:</span><span>CASH / CARD</span>
                            </div>
                            <div className="text-center text-[10px] uppercase font-bold tracking-wider mb-2">
                                <p>*** Thank You ***</p>
                                <p className="mt-1">For Shopping With Us!</p>
                            </div>
                            <div className="text-center text-[8px] text-gray-400 mt-4">Powered by Mr² Labs</div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex gap-2 sm:gap-3 p-4 sm:p-5 pb-safe bg-slate-50 border-t border-slate-100">
                            <button
                                onClick={() => window.print()}
                                className="flex-1 h-12 flex items-center justify-center gap-2 bg-indigo-600 text-white text-sm sm:text-base font-bold rounded-2xl shadow-[0_4px_10px_rgb(79,70,229,0.3)] hover:bg-indigo-700 transition-all active:scale-95"
                            >
                                <Printer size={16} className="sm:w-[18px] sm:h-[18px]" /> Print Receipt
                            </button>
                            <button
                                onClick={() => setPrintReceipt(null)}
                                className="flex-1 h-12 flex items-center justify-center gap-2 bg-white text-slate-700 text-sm sm:text-base font-bold rounded-2xl hover:bg-slate-50 transition-all active:scale-95 border border-slate-200 shadow-sm"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════
                DELETE CONFIRMATION MODAL
            ══════════════════════════════ */}
            {confirmDelete && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 no-print animate-in fade-in duration-200">
                    <div className="bg-white rounded-[1.5rem] shadow-2xl w-full max-w-sm p-6 sm:p-7 flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 border-4 border-red-50">
                            <AlertTriangle size={28} className="text-red-600" />
                        </div>
                        <h3 className="text-xl font-extrabold text-slate-900 mb-2">Delete Transaction?</h3>
                        <p className="text-slate-500 text-sm mb-1">
                            This will permanently delete receipt
                        </p>
                        <p className="font-mono font-bold text-slate-800 text-sm mb-1">{confirmDelete.receipt_id}</p>
                        <p className="text-slate-500 text-sm mb-6">
                            ({confirmDelete.items.reduce((s, i) => s + i.quantity_sold, 0)} items · Rs. {confirmDelete.total.toFixed(2)})
                        </p>
                        <p className="text-xs text-red-500 font-semibold mb-6 bg-red-50 px-4 py-2 rounded-xl w-full border border-red-100">
                            ⚠️ This action cannot be undone.
                        </p>
                        <div className="flex gap-2 sm:gap-3 w-full">
                            <button
                                onClick={() => handleDelete(confirmDelete)}
                                className="flex-1 h-12 flex items-center justify-center gap-2 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 transition-all active:scale-95 text-sm sm:text-base shadow-[0_4px_10px_rgb(220,38,38,0.3)]"
                            >
                                {deletingId === confirmDelete.receipt_id
                                    ? <RefreshCw size={16} className="animate-spin" />
                                    : <><Trash2 size={16} /> Delete</>}
                            </button>
                            <button
                                onClick={() => setConfirmDelete(null)}
                                className="flex-1 h-12 flex items-center justify-center gap-2 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-200 transition-all active:scale-95 border border-slate-200 text-sm sm:text-base"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════
                CLEAR ALL CONFIRMATION MODAL
            ══════════════════════════════ */}
            {showClearAll && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 no-print animate-in fade-in duration-200">
                    <div className="bg-white rounded-[1.5rem] shadow-2xl w-full max-w-sm p-6 sm:p-7 flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 border-4 border-red-50">
                            <AlertTriangle size={28} className="text-red-600" />
                        </div>
                        <h3 className="text-xl font-extrabold text-slate-900 mb-2">Clear All Sales?</h3>
                        <p className="text-slate-500 text-sm mb-6">
                            This will permanently delete all <span className="font-bold text-slate-800">{groupedReceipts.length}</span> transactions
                            from the database. The inventory will <span className="font-semibold">not</span> be restored.
                        </p>
                        <p className="text-xs text-red-500 font-semibold mb-6 bg-red-50 px-4 py-2 rounded-xl w-full border border-red-100">
                            ⚠️ This action cannot be undone.
                        </p>
                        <div className="flex gap-2 sm:gap-3 w-full">
                            <button
                                onClick={handleClearAll}
                                disabled={isClearing}
                                className="flex-1 h-12 flex items-center justify-center gap-2 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 transition-all active:scale-95 disabled:opacity-60 text-sm sm:text-base shadow-[0_4px_10px_rgb(220,38,38,0.3)]"
                            >
                                {isClearing
                                    ? <RefreshCw size={16} className="animate-spin" />
                                    : <><Trash2 size={16} /> Clear All</>}
                            </button>
                            <button
                                onClick={() => setShowClearAll(false)}
                                disabled={isClearing}
                                className="flex-1 h-12 flex items-center justify-center gap-2 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-200 transition-all active:scale-95 border border-slate-200 disabled:opacity-60 text-sm sm:text-base"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════
                80mm THERMAL RECEIPT  (only visible on print)
            ══════════════════════════════════════════════ */}
            {printReceipt && (
                <div className="hidden print:block font-mono text-black text-[12px] bg-white w-full max-w-[80mm] p-3 mx-auto">
                    <div className="text-center mb-4">
                        <h1 className="text-xl font-bold uppercase tracking-widest mb-1">PARTY FAVOUR</h1>
                        <p className="text-[10px] whitespace-pre-wrap">{receiptSettings.address1}</p>
                        {receiptSettings.address2 && <p className="text-[10px]">{receiptSettings.address2}</p>}
                        <p className="text-[10px] mt-1">Tel: {receiptSettings.phone}</p>
                        <div className="border-b border-dashed border-black/50 my-3" />
                    </div>
                    <div className="mb-4 text-[11px] leading-tight">
                        <div className="flex justify-between"><span>Receipt:</span><span className="font-bold">{printReceipt.receipt_id}</span></div>
                        <div className="flex justify-between mt-1"><span>Date:</span><span>{printReceipt.date.toLocaleString()}</span></div>
                    </div>
                    <div className="border-b border-dashed border-black/50 mb-2" />
                    <table className="w-full text-left mb-2 text-[11px]">
                        <thead>
                            <tr className="border-b border-black/30">
                                <th className="py-1 font-bold">Item</th>
                                <th className="py-1 text-center font-bold">Qty</th>
                                <th className="py-1 text-right font-bold">Price</th>
                                <th className="py-1 text-right font-bold">Amt</th>
                            </tr>
                        </thead>
                        <tbody>
                            {printReceipt.items.map(item => (
                                <tr key={item.id}>
                                    <td className="py-1.5 align-top">{item.name.length > 15 ? item.name.substring(0, 15) + '...' : item.name}</td>
                                    <td className="py-1.5 text-center align-top">{item.quantity_sold}</td>
                                    <td className="py-1.5 text-right align-top">{item.sold_price.toFixed(2)}</td>
                                    <td className="py-1.5 text-right font-bold align-top">{(item.sold_price * item.quantity_sold).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="border-b border-dashed border-black/50 mt-1 mb-2" />
                    <div className="flex justify-between items-center font-bold text-sm mb-1 mt-3">
                        <span>TOTAL AMOUNT:</span><span>Rs. {printReceipt.total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[11px] mb-6">
                        <span>Payment Method:</span><span>CASH / CARD</span>
                    </div>
                    <div className="text-center mb-4 text-[10px] uppercase font-bold tracking-wider">
                        <p>*** Thank You ***</p>
                        <p className="mt-1">For Shopping With Us!</p>
                    </div>
                    <div className="text-center mt-6 text-[8px] text-gray-400">Powered by Mr² Labs</div>
                </div>
            )}
        </>
    );
}
