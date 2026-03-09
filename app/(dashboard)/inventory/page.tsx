"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
    Package, Plus, Trash2, ArrowLeft, Search, RefreshCw, Edit2, X,
    Printer, Tag, Truck, LayoutGrid, ChevronDown, Barcode, MoreVertical
} from 'lucide-react';
import Link from 'next/link';
import { useRole } from '@/hooks/useRole';
import JsBarcode from 'jsbarcode';

// ── Category config ─────────────────────────────────────────────────────────
const CATEGORIES = [
    { value: '', label: 'All', color: 'bg-slate-100 text-slate-700 border-slate-200' },
    { value: 'Balloons', label: '🎈 Balloons', color: 'bg-sky-100 text-sky-700 border-sky-200' },
    { value: 'Decorations', label: '🎀 Decorations', color: 'bg-pink-100 text-pink-700 border-pink-200' },
    { value: 'Candles', label: '🕯️ Candles', color: 'bg-amber-100 text-amber-700 border-amber-200' },
    { value: 'Toys', label: '🧸 Toys', color: 'bg-violet-100 text-violet-700 border-violet-200' },
    { value: 'Stationery', label: '📝 Stationery', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    { value: 'Costumes', label: '🎭 Costumes', color: 'bg-orange-100 text-orange-700 border-orange-200' },
    { value: 'Other', label: '📦 Other', color: 'bg-slate-100 text-slate-600 border-slate-200' },
];

const CAT_MAP: Record<string, string> = Object.fromEntries(
    CATEGORIES.filter(c => c.value).map(c => [c.value, c.color])
);

// ── Responsive Hook ──────────────────────────────────────────────────────────
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

// ── Barcode Label component ──────────────────────────────────────────────────
function BarcodeLabel({ item }: { item: any }) {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (svgRef.current && item?.item_code) {
            try {
                JsBarcode(svgRef.current, item.item_code, {
                    format: 'CODE128',
                    width: 2,
                    height: 50,
                    displayValue: true,
                    fontSize: 11,
                    margin: 6,
                    background: '#ffffff',
                    lineColor: '#000000',
                });
            } catch (_) { /* invalid barcode chars – silently skip */ }
        }
    }, [item]);

    return (
        <div className="barcode-label bg-white border border-slate-200 rounded-lg p-3 flex flex-col items-center text-center w-[200px]">
            <p className="text-[11px] font-bold text-slate-800 mb-1 w-full truncate">{item.name}</p>
            <svg ref={svgRef} className="w-full" />
            <p className="text-[10px] text-slate-500 mt-1">Rs. {Number(item.selling_price).toFixed(2)}</p>
        </div>
    );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function InventoryPage() {
    const { isAdmin, loading: roleLoading } = useRole();
    const { isMobile, isTablet } = useBreakpoint();
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Filter states
    const [showMobileFilter, setShowMobileFilter] = useState(false);
    // Menu state for individual items in mobile
    const [activeItemMenu, setActiveItemMenu] = useState<string | null>(null);

    // Barcode modal
    const [barcodeModal, setBarcodeModal] = useState<any[] | null>(null);

    const emptyForm = {
        item_code: '', name: '', category: '', supplier: '',
        cost_price: '', selling_price: '', quantity: ''
    };
    const [formData, setFormData] = useState(emptyForm);

    useEffect(() => { fetchInventory(); }, []);

    // Close menus when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setActiveItemMenu(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    async function fetchInventory() {
        setLoading(true);
        const query = supabase.from('inventory').select(isAdmin ? '*' : 'id,item_code,name,category,supplier,selling_price,quantity,created_at').order('created_at', { ascending: false });
        const { data, error } = await query;
        if (!error && data) setItems(data);
        setLoading(false);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setIsSubmitting(true);

        const payload: any = {
            item_code: formData.item_code,
            name: formData.name,
            category: formData.category || null,
            supplier: formData.supplier || null,
            selling_price: parseFloat(formData.selling_price),
            quantity: parseInt(formData.quantity),
        };

        if (isAdmin) {
            payload.cost_price = parseFloat(formData.cost_price);
        } else if (!editingId) {
            // Cashier adding a new item doesn't have access to cost price, default to 0
            payload.cost_price = 0;
        }

        if (editingId) {
            const { error } = await supabase.from('inventory').update(payload).eq('id', editingId);
            if (error) alert('Error updating product: ' + error.message);
            else { setFormData(emptyForm); setEditingId(null); fetchInventory(); }
        } else {
            const { error } = await supabase.from('inventory').insert([payload]);
            if (error) alert('Error adding product: ' + error.message);
            else { setFormData(emptyForm); fetchInventory(); }
        }
        setIsSubmitting(false);
    }

    async function handleDelete(id: string, name: string) {
        if (!confirm('Are you sure you want to delete "' + name + '"?')) return;

        const { error } = await supabase.from('inventory').delete().eq('id', id);

        if (error) {
            if (error.code === '23503') { // Foreign key violation
                if (confirm('This product has associated sales records. Deleting it will also remove those sales from history. Proceed with force delete?')) {
                    // First delete associated sales
                    const { error: salesError } = await supabase.from('sales').delete().eq('item_id', id);
                    if (salesError) {
                        alert('Error deleting associated sales: ' + salesError.message);
                        return;
                    }
                    // Then try deleting the product again
                    const { error: retryError } = await supabase.from('inventory').delete().eq('id', id);
                    if (retryError) alert('Error during force delete: ' + retryError.message);
                    else fetchInventory();
                }
            } else {
                alert('Error deleting product: ' + error.message);
            }
        } else {
            fetchInventory();
        }
    }

    async function handleClearAll() {
        if (!confirm('DANGER: This will permanently delete ALL products in the inventory and ALL associated sales records. This cannot be undone. Are you absolutely sure?')) return;

        setLoading(true);
        // Delete all sales first to satisfy FK constraints
        const { error: salesError } = await supabase.from('sales').delete().not('id', 'is', null);
        if (salesError) {
            alert('Error clearing sales history: ' + salesError.message);
            setLoading(false);
            return;
        }

        // Delete all inventory
        const { error: invError } = await supabase.from('inventory').delete().not('id', 'is', null);
        if (invError) {
            alert('Error clearing inventory: ' + invError.message);
        } else {
            setItems([]);
        }
        setLoading(false);
    }

    function handleEdit(item: any) {
        setEditingId(item.id);
        setFormData({
            item_code: item.item_code ?? '',
            name: item.name ?? '',
            category: item.category ?? '',
            supplier: item.supplier ?? '',
            cost_price: item.cost_price?.toString() ?? '',
            selling_price: item.selling_price?.toString() ?? '',
            quantity: item.quantity?.toString() ?? '',
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function cancelEdit() {
        setEditingId(null);
        setFormData(emptyForm);
    }

    function openBarcodeModal(item?: any) {
        // if item passed, show just that one; else show all filtered
        setBarcodeModal(item ? [item] : filteredItems);
    }

    const filteredItems = items.filter(item => {
        const matchSearch =
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.item_code ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.supplier ?? '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchCat = !activeCategory || item.category === activeCategory;
        return matchSearch && matchCat;
    });

    // Unique supplier list for datalist autocomplete
    const supplierList = [...new Set(items.map(i => i.supplier).filter(Boolean))];

    return (
        <div className="min-h-screen min-h-[100dvh] bg-[#FDFDFD] text-slate-900 font-sans selection:bg-indigo-100 safe-area-top safe-area-bottom overflow-x-hidden">

            {/* Print styles */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    .no-print { display: none !important; }
                    .print-area { display: flex !important; flex-wrap: wrap; gap: 12px; padding: 16px; justify-content: flex-start; }
                    .barcode-label { page-break-inside: avoid; border-color: #000; }
                    @page { margin: 10mm; }
                }
                @media screen {
                    .print-area { display: flex; flex-wrap: wrap; gap: 12px; padding: 16px; justify-content: center; }
                }
            `}} />

            {/* Navbar */}
            <nav className="no-print sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-slate-200/60 transition-all">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                        <Link href="/" className="w-8 h-8 sm:w-10 sm:h-10 flex flex-shrink-0 items-center justify-center rounded-full hover:bg-slate-100 text-slate-600 transition-colors">
                            <ArrowLeft size={18} />
                        </Link>
                        <div className="h-5 sm:h-6 w-px bg-slate-200 flex-shrink-0"></div>
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-50 flex flex-shrink-0 items-center justify-center text-indigo-600 border border-indigo-100">
                                <Package size={16} />
                            </div>
                            <span className="font-semibold text-base sm:text-lg text-slate-900 truncate">Inventory</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            onClick={() => openBarcodeModal()}
                            disabled={filteredItems.length === 0}
                            className="h-8 sm:h-9 px-3 sm:px-4 flex items-center gap-2 bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs sm:text-sm font-semibold transition-all hover:bg-slate-200 disabled:opacity-50"
                        >
                            <Printer size={15} />
                            <span className="hidden xs:inline">Print Labels</span>
                        </button>
                        <Link href="/pos" className="h-8 sm:h-9 px-3 sm:px-4 flex items-center justify-center bg-slate-900 text-white rounded-lg text-xs sm:text-sm font-medium transition-all hover:bg-slate-800 shadow-sm">
                            <span className="hidden xs:inline">Open </span>POS
                        </Link>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8 no-print">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-8">

                    {/* ── Left/Top: Add / Edit form ── */}
                    <div className="lg:col-span-4 order-last lg:order-first">
                        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 sm:p-6 lg:sticky lg:top-24">
                            <div className="flex items-center gap-2 mb-4 sm:mb-6">
                                {editingId ? <Edit2 size={20} className="text-amber-500" /> : <Plus size={20} className="text-indigo-600" />}
                                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                                    {editingId ? 'Edit Product' : 'Add New Product'}
                                </h2>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                                {/* Item Code */}
                                <div>
                                    <label className="block text-xs sm:text-sm font-medium text-slate-600 mb-1 sm:mb-1.5">Item Code (SKU)</label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.item_code}
                                        onChange={e => setFormData({ ...formData, item_code: e.target.value })}
                                        placeholder="e.g. BLN-001"
                                        className="w-full h-10 sm:h-11 px-3 sm:px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono text-slate-900 placeholder-slate-500"
                                    />
                                </div>

                                {/* Product Name */}
                                <div>
                                    <label className="block text-xs sm:text-sm font-medium text-slate-600 mb-1 sm:mb-1.5">Product Name</label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="e.g. Red Helium Balloon"
                                        className="w-full h-10 sm:h-11 px-3 sm:px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-900 placeholder-slate-500"
                                    />
                                </div>

                                {/* Category */}
                                <div>
                                    <label className="block text-xs sm:text-sm font-medium text-slate-600 mb-1 sm:mb-1.5 flex items-center gap-1.5">
                                        <Tag size={13} className="text-slate-400" /> Category
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={formData.category}
                                            onChange={e => setFormData({ ...formData, category: e.target.value })}
                                            className="w-full h-10 sm:h-11 px-3 sm:px-4 pr-9 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none font-medium"
                                        >
                                            <option value="">— Select a category —</option>
                                            {CATEGORIES.filter(c => c.value).map(cat => (
                                                <option key={cat.value} value={cat.value}>{cat.label}</option>
                                            ))}
                                        </select>
                                        <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>

                                {/* Supplier */}
                                <div>
                                    <label className="block text-xs sm:text-sm font-medium text-slate-600 mb-1 sm:mb-1.5 flex items-center gap-1.5">
                                        <Truck size={13} className="text-slate-400" /> Supplier
                                    </label>
                                    <input
                                        type="text"
                                        list="supplier-list"
                                        value={formData.supplier}
                                        onChange={e => setFormData({ ...formData, supplier: e.target.value })}
                                        placeholder="e.g. ABC Wholesale Co."
                                        className="w-full h-10 sm:h-11 px-3 sm:px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-900 placeholder-slate-500"
                                    />
                                    <datalist id="supplier-list">
                                        {supplierList.map(s => <option key={s} value={s} />)}
                                    </datalist>
                                </div>

                                {/* Prices & Quantity (Responsive Grid) */}
                                <div className="grid grid-cols-2 lg:grid-cols-2 gap-3">
                                    {isAdmin && (
                                        <div className="col-span-1">
                                            <label className="block text-xs sm:text-sm font-medium text-slate-600 mb-1 sm:mb-1.5">Cost (Rs.)</label>
                                            <input
                                                required type="number" step="0.01" min="0"
                                                value={formData.cost_price}
                                                onChange={e => setFormData({ ...formData, cost_price: e.target.value })}
                                                placeholder="0.00"
                                                className="w-full h-10 sm:h-11 px-3 sm:px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-900 placeholder-slate-500"
                                            />
                                        </div>
                                    )}
                                    <div className="col-span-1">
                                        <label className="block text-xs sm:text-sm font-medium text-slate-600 mb-1 sm:mb-1.5">Sell (Rs.)</label>
                                        <input
                                            required type="number" step="0.01" min="0"
                                            value={formData.selling_price}
                                            onChange={e => setFormData({ ...formData, selling_price: e.target.value })}
                                            placeholder="0.00"
                                            className="w-full h-10 sm:h-11 px-3 sm:px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-900 placeholder-slate-500"
                                        />
                                    </div>
                                    <div className={`col-span-2 ${isAdmin ? 'lg:col-span-2' : ''}`}>
                                        <label className="block text-xs sm:text-sm font-medium text-slate-600 mb-1 sm:mb-1.5">Quantity</label>
                                        <input
                                            required type="number" min="0"
                                            value={formData.quantity}
                                            onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                                            placeholder="0"
                                            className="w-full h-10 sm:h-11 px-3 sm:px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-900 placeholder-slate-500"
                                        />
                                    </div>
                                </div>

                                <div className="pt-2 sm:pt-4 flex gap-2 sm:gap-3">
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className={`flex-1 h-11 sm:h-12 flex items-center justify-center gap-2 text-white rounded-xl text-sm font-bold transition-all shadow-md disabled:opacity-70 ${editingId ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'}`}
                                    >
                                        {isSubmitting ? <RefreshCw size={18} className="animate-spin" /> : editingId ? <Edit2 size={18} /> : <Plus size={18} />}
                                        {isSubmitting ? (editingId ? 'Updating...' : 'Adding...') : (editingId ? 'Update Product' : 'Add Product')}
                                    </button>
                                    {editingId && (
                                        <button type="button" onClick={cancelEdit} className="w-11 h-11 sm:w-12 sm:h-12 flex flex-shrink-0 items-center justify-center bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl transition-all" title="Cancel Edit">
                                            <X size={18} />
                                        </button>
                                    )}
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* ── Right/Bottom: Product Table ── */}
                    <div className="lg:col-span-8 order-first lg:order-last">
                        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col min-h-0 sm:min-h-[600px]">

                            {/* Header (Search & Actions) */}
                            <div className="p-4 sm:p-5 md:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-slate-50/30">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                                        <DatabaseIcon />
                                        <span className="hidden xs:inline">Products</span>
                                        <span className="bg-slate-100 text-slate-600 py-0.5 px-2 rounded-full text-[11px] sm:text-xs font-semibold ml-1">
                                            {filteredItems.length}
                                        </span>
                                    </h2>

                                    {/* Mobile: Filter Toggle & Clear All */}
                                    <div className="flex items-center gap-2 sm:hidden">
                                        {isAdmin && items.length > 0 && (
                                            <button
                                                onClick={handleClearAll}
                                                className="h-8 w-8 flex items-center justify-center bg-red-50 text-red-600 rounded-lg text-xs font-bold transition-all hover:bg-red-100"
                                                title="Clear All"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setShowMobileFilter(!showMobileFilter)}
                                            className={`h-8 w-8 flex items-center justify-center rounded-lg transition-all ${showMobileFilter ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}
                                        >
                                            <Search size={14} />
                                        </button>
                                    </div>
                                </div>

                                {/* Search input & Clear action (Desktop) / Expanded Search (Mobile) */}
                                <div className={`flex flex-row items-center gap-2 sm:gap-3 transition-all ${!isMobile ? 'flex' : (showMobileFilter ? 'flex flex-col mt-2' : 'hidden')}`}>
                                    {isAdmin && items.length > 0 && !isMobile && (
                                        <button
                                            onClick={handleClearAll}
                                            className="h-9 px-3 flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs font-bold transition-all hover:bg-red-100 shadow-sm active:scale-95 flex-shrink-0"
                                        >
                                            <Trash2 size={14} />
                                            Clear All
                                        </button>
                                    )}
                                    <div className="relative w-full sm:w-64 flex-shrink-0">
                                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Search inventory..."
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                            className="w-full h-10 pl-9 pr-4 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-900 placeholder-slate-400 shadow-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Category Filter Chips */}
                            <div className="px-4 py-2 bg-slate-50/50 flex gap-1.5 sm:gap-2 overflow-x-auto border-b border-slate-100 scrollbar-hide">
                                {CATEGORIES.map(cat => (
                                    <button
                                        key={cat.value}
                                        onClick={() => setActiveCategory(cat.value)}
                                        className={`flex-shrink-0 h-8 px-3 rounded-full text-[11px] sm:text-xs font-bold border transition-all hover:scale-[1.02] active:scale-95 ${activeCategory === cat.value ? cat.color + ' ring-1 ring-black/5' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700 shadow-sm'}`}
                                    >
                                        {cat.label}
                                    </button>
                                ))}
                            </div>

                            {/* Loading State */}
                            {loading && (
                                <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400">
                                    <RefreshCw size={28} className="animate-spin mb-3 opacity-50" />
                                    <p className="text-sm font-medium">Loading inventory...</p>
                                </div>
                            )}

                            {/* Empty State */}
                            {!loading && filteredItems.length === 0 && (
                                <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400">
                                    <Package size={40} className="mb-3 opacity-30" />
                                    <p className="text-sm font-medium text-slate-500">No products found.</p>
                                    {(searchTerm || activeCategory) && (
                                        <button
                                            onClick={() => { setSearchTerm(''); setActiveCategory(''); }}
                                            className="mt-3 text-xs font-bold text-indigo-500 hover:text-indigo-600 underline"
                                        >
                                            Clear Filters
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Mobile: Card View */}
                            {isMobile && !loading && filteredItems.length > 0 && (
                                <div className="flex-1 overflow-y-auto bg-slate-50/30 p-3 flex flex-col gap-3">
                                    {filteredItems.map(item => (
                                        <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm relative">
                                            {/* Top context row */}
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex-1 pr-8">
                                                    <p className="font-bold text-slate-900 text-[13px] leading-tight mb-1">{item.name}</p>
                                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                        <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                                                            {item.item_code}
                                                        </span>
                                                        {item.category && (
                                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${CAT_MAP[item.category] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                                                {item.category}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Mobile Actions Menu Toggle */}
                                                <div className="absolute top-3 right-2">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setActiveItemMenu(activeItemMenu === item.id ? null : item.id); }}
                                                        className="p-1.5 text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-md transition-colors"
                                                    >
                                                        <MoreVertical size={16} />
                                                    </button>

                                                    {/* Floating Actions Menu */}
                                                    {activeItemMenu === item.id && (
                                                        <div
                                                            className="absolute right-0 top-full mt-1 w-40 bg-white border border-slate-200 shadow-xl rounded-xl overflow-hidden z-20 animate-in fade-in zoom-in-95 duration-100 origin-top-right"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <button className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 border-b border-slate-100" onClick={() => { openBarcodeModal(item); setActiveItemMenu(null); }}>
                                                                <Barcode size={14} className="text-slate-400" /> Print Label
                                                            </button>
                                                            <button className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 border-b border-slate-100" onClick={() => { handleEdit(item); setActiveItemMenu(null); }}>
                                                                <Edit2 size={14} className="text-amber-500" /> Edit Product
                                                            </button>
                                                            {isAdmin && (
                                                                <button className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-medium text-red-600 hover:bg-red-50" onClick={() => { handleDelete(item.id, item.name); setActiveItemMenu(null); }}>
                                                                    <Trash2 size={14} className="text-red-500" /> Delete
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Stat row */}
                                            <div className="flex items-end justify-between mt-3 pt-3 border-t border-slate-100">
                                                <div className="space-y-1">
                                                    <p className="text-[10px] text-slate-500 font-medium">Stock</p>
                                                    <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[11px] font-bold ${item.quantity > 10 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : item.quantity > 0 ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                                                        {item.quantity} units
                                                    </span>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] text-slate-500 font-medium mb-0.5">Price</p>
                                                    <p className="text-sm font-bold text-indigo-600">Rs. {Number(item.selling_price).toFixed(2)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Desktop/Tablet: Table View */}
                            {!isMobile && !loading && filteredItems.length > 0 && (
                                <div className="flex-1 overflow-x-auto">
                                    <table className="w-full text-left text-sm whitespace-nowrap min-w-[700px]">
                                        <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                                            <tr>
                                                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">Item Details</th>
                                                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">Category & Vendor</th>
                                                {isAdmin && <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-right">Cost</th>}
                                                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-right">Price</th>
                                                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-center">Stock</th>
                                                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredItems.map(item => (
                                                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                                                    <td className="px-4 py-3 max-w-[200px]">
                                                        <div className="truncate font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">{item.name}</div>
                                                        <div className="font-mono text-[10px] text-slate-400 mt-0.5">{item.item_code}</div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col gap-1 items-start">
                                                            {item.category ? (
                                                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${CAT_MAP[item.category] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                                                    {item.category}
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-300 text-[10px]">—</span>
                                                            )}
                                                            {item.supplier && (
                                                                <span className="flex items-center gap-1 text-[10px] text-slate-500 max-w-[120px] truncate">
                                                                    <Truck size={10} className="text-slate-300" />{item.supplier}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    {isAdmin && <td className="px-4 py-3 text-right text-slate-500 text-xs">Rs. {Number(item.cost_price).toFixed(2)}</td>}
                                                    <td className="px-4 py-3 text-right font-bold text-indigo-700">Rs. {Number(item.selling_price).toFixed(2)}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-bold border ${item.quantity > 10 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : item.quantity > 0 ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                                            {item.quantity}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => openBarcodeModal(item)}
                                                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all h-8 w-8 flex items-center justify-center"
                                                                title="Print Barcode Label"
                                                            >
                                                                <Barcode size={15} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleEdit(item)}
                                                                className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-all h-8 w-8 flex items-center justify-center"
                                                                title="Edit"
                                                            >
                                                                <Edit2 size={15} />
                                                            </button>
                                                            {isAdmin && (
                                                                <button
                                                                    onClick={() => handleDelete(item.id, item.name)}
                                                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all h-8 w-8 flex items-center justify-center"
                                                                    title="Delete"
                                                                >
                                                                    <Trash2 size={15} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* ── BARCODE PRINT MODAL ── */}
            {barcodeModal && (
                <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 no-print sm:pb-safe">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div>
                                <h3 className="text-base sm:text-lg font-bold text-slate-900">Barcode Labels</h3>
                                <p className="text-xs sm:text-sm text-slate-500">{barcodeModal.length} label{barcodeModal.length > 1 ? 's' : ''} ready</p>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-3">
                                <button
                                    onClick={() => window.print()}
                                    className="h-9 sm:h-10 px-3 sm:px-5 flex items-center gap-2 bg-indigo-600 text-white rounded-xl text-xs sm:text-sm font-bold hover:bg-indigo-700 shadow-[0_4px_10px_rgba(79,70,229,0.3)] transition-all active:scale-95"
                                >
                                    <Printer size={16} className="hidden xs:block" /> Print
                                </button>
                                <button onClick={() => setBarcodeModal(null)} className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                        <div className="overflow-y-auto p-4 sm:p-6 bg-slate-50/30 flex-1">
                            {/* Make print area a flex block that centers items on screen, but align-start on print */}
                            <div className="print-area">
                                {barcodeModal.map(item => (
                                    <BarcodeLabel key={item.id} item={item} />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Print-only area (hidden on screen but printed) */}
            <div className="hidden print:block">
                {barcodeModal && (
                    <div className="print-area">
                        {barcodeModal.map(item => (
                            <BarcodeLabel key={item.id} item={item} />
                        ))}
                    </div>
                )}
            </div>

        </div>
    );
}

function DatabaseIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500">
            <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
        </svg>
    );
}
