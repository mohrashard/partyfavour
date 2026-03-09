"use client";

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import {
    Package, Plus, Trash2, ArrowLeft, Search, RefreshCw, Edit2, X,
    Printer, Tag, Truck, LayoutGrid, ChevronDown, Barcode
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
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Barcode modal
    const [barcodeModal, setBarcodeModal] = useState<any[] | null>(null);

    const emptyForm = {
        item_code: '', name: '', category: '', supplier: '',
        cost_price: '', selling_price: '', quantity: ''
    };
    const [formData, setFormData] = useState(emptyForm);

    useEffect(() => { fetchInventory(); }, []);

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
        <div className="min-h-screen bg-[#FDFDFD] text-slate-900 font-sans selection:bg-indigo-100">

            {/* Print styles */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    .no-print { display: none !important; }
                    .print-area { display: flex !important; flex-wrap: wrap; gap: 12px; padding: 16px; }
                    .barcode-label { page-break-inside: avoid; }
                    @page { margin: 10mm; }
                }
                @media screen {
                    .print-area { display: flex; flex-wrap: wrap; gap: 12px; padding: 16px; }
                }
            `}} />

            {/* Navbar */}
            <nav className="no-print sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-600 transition-colors">
                            <ArrowLeft size={20} />
                        </Link>
                        <div className="h-6 w-px bg-slate-200"></div>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
                                <Package size={18} />
                            </div>
                            <span className="font-semibold text-lg text-slate-900">Inventory Management</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => openBarcodeModal()}
                            disabled={filteredItems.length === 0}
                            className="h-9 px-4 flex items-center gap-2 bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-all hover:bg-slate-200 disabled:opacity-50"
                        >
                            <Printer size={15} /> Print Labels
                        </button>
                        <Link href="/pos" className="h-9 px-4 flex items-center justify-center bg-slate-900 text-white rounded-lg text-sm font-medium transition-all hover:bg-slate-800 shadow-sm">
                            Open POS
                        </Link>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-6 py-8 no-print">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* ── Left: Add / Edit form ── */}
                    <div className="lg:col-span-4">
                        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 sticky top-24">
                            <div className="flex items-center gap-2 mb-6">
                                {editingId ? <Edit2 size={20} className="text-amber-500" /> : <Plus size={20} className="text-indigo-600" />}
                                <h2 className="text-lg font-bold text-slate-900">
                                    {editingId ? 'Edit Product' : 'Add New Product'}
                                </h2>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* Item Code */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1.5">Item Code (SKU / Barcode)</label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.item_code}
                                        onChange={e => setFormData({ ...formData, item_code: e.target.value })}
                                        placeholder="e.g. BLN-001"
                                        className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono text-slate-900 placeholder-slate-500"
                                    />
                                </div>

                                {/* Product Name */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1.5">Product Name</label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="e.g. Red Helium Balloon"
                                        className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-900 placeholder-slate-500"
                                    />
                                </div>

                                {/* Category */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
                                        <Tag size={13} className="text-slate-400" /> Category
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={formData.category}
                                            onChange={e => setFormData({ ...formData, category: e.target.value })}
                                            className="w-full h-11 px-4 pr-9 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none font-medium"
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
                                    <label className="block text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
                                        <Truck size={13} className="text-slate-400" /> Supplier / Vendor
                                    </label>
                                    <input
                                        type="text"
                                        list="supplier-list"
                                        value={formData.supplier}
                                        onChange={e => setFormData({ ...formData, supplier: e.target.value })}
                                        placeholder="e.g. ABC Wholesale Co."
                                        className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-900 placeholder-slate-500"
                                    />
                                    <datalist id="supplier-list">
                                        {supplierList.map(s => <option key={s} value={s} />)}
                                    </datalist>
                                </div>

                                {/* Prices */}
                                <div className="grid grid-cols-2 gap-3">
                                    {isAdmin && (
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-1.5">Cost Price (Rs.)</label>
                                            <input
                                                required type="number" step="0.01" min="0"
                                                value={formData.cost_price}
                                                onChange={e => setFormData({ ...formData, cost_price: e.target.value })}
                                                placeholder="0.00"
                                                className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-900 placeholder-slate-500"
                                            />
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-1.5">Selling Price (Rs.)</label>
                                        <input
                                            required type="number" step="0.01" min="0"
                                            value={formData.selling_price}
                                            onChange={e => setFormData({ ...formData, selling_price: e.target.value })}
                                            placeholder="0.00"
                                            className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-900 placeholder-slate-500"
                                        />
                                    </div>
                                </div>

                                {/* Quantity */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1.5">Initial Quantity</label>
                                    <input
                                        required type="number" min="0"
                                        value={formData.quantity}
                                        onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                                        placeholder="0"
                                        className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-900 placeholder-slate-500"
                                    />
                                </div>

                                <div className="pt-2 flex gap-3">
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className={`flex-1 h-12 flex items-center justify-center gap-2 text-white rounded-xl text-sm font-bold transition-all shadow-md disabled:opacity-70 ${editingId ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'}`}
                                    >
                                        {isSubmitting ? <RefreshCw size={18} className="animate-spin" /> : editingId ? <Edit2 size={18} /> : <Plus size={18} />}
                                        {isSubmitting ? (editingId ? 'Updating...' : 'Adding...') : (editingId ? 'Update Product' : 'Add to Inventory')}
                                    </button>
                                    {editingId && (
                                        <button type="button" onClick={cancelEdit} className="w-12 h-12 flex items-center justify-center bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl transition-all" title="Cancel Edit">
                                            <X size={18} />
                                        </button>
                                    )}
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* ── Right: Product Table ── */}
                    <div className="lg:col-span-8">
                        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col min-h-[600px]">

                            {/* Header */}
                            <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <DatabaseIcon />
                                    Products
                                    <span className="bg-slate-100 text-slate-600 py-0.5 px-2.5 rounded-full text-xs font-semibold ml-1">
                                        {filteredItems.length} / {items.length}
                                    </span>
                                </h2>
                                <div className="flex items-center gap-3">
                                    {isAdmin && items.length > 0 && (
                                        <button
                                            onClick={handleClearAll}
                                            className="h-9 px-3 flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs font-bold transition-all hover:bg-red-100 shadow-sm active:scale-95"
                                        >
                                            <Trash2 size={14} />
                                            Clear All
                                        </button>
                                    )}
                                    <div className="relative w-full sm:w-64">
                                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Name, code, or supplier..."
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                            className="w-full h-10 pl-9 pr-4 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-900 placeholder-slate-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Category Filter Chips */}
                            <div className="px-4 sm:px-6 py-3 flex gap-2 overflow-x-auto border-b border-slate-100 scrollbar-hide">
                                {CATEGORIES.map(cat => (
                                    <button
                                        key={cat.value}
                                        onClick={() => setActiveCategory(cat.value)}
                                        className={`flex-shrink-0 h-8 px-3 rounded-full text-xs font-bold border transition-all ${activeCategory === cat.value ? cat.color + ' shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                                    >
                                        {cat.label}
                                    </button>
                                ))}
                            </div>

                            {/* Table */}
                            <div className="flex-1 overflow-x-auto">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-slate-50/50 text-slate-500 border-b border-slate-100">
                                        <tr>
                                            <th className="px-4 py-3.5 font-semibold">Code</th>
                                            <th className="px-4 py-3.5 font-semibold">Product</th>
                                            <th className="px-4 py-3.5 font-semibold">Category</th>
                                            <th className="px-4 py-3.5 font-semibold">Supplier</th>
                                            {isAdmin && <th className="px-4 py-3.5 font-semibold text-right">Cost</th>}
                                            <th className="px-4 py-3.5 font-semibold text-right">Price</th>
                                            <th className="px-4 py-3.5 font-semibold text-center">Stock</th>
                                            <th className="px-4 py-3.5 font-semibold text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                                                    <RefreshCw size={24} className="animate-spin mx-auto mb-3 opacity-50" />
                                                    <p>Loading inventory...</p>
                                                </td>
                                            </tr>
                                        ) : filteredItems.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                                                    <Package size={24} className="mx-auto mb-3 opacity-30" />
                                                    <p>No products found.</p>
                                                </td>
                                            </tr>
                                        ) : filteredItems.map(item => (
                                            <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-4 py-3.5 font-mono text-[11px] text-slate-500">{item.item_code}</td>
                                                <td className="px-4 py-3.5 font-semibold text-slate-900 max-w-[160px] truncate">{item.name}</td>
                                                <td className="px-4 py-3.5">
                                                    {item.category ? (
                                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${CAT_MAP[item.category] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                                            {item.category}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-300 text-xs">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3.5 text-slate-500 text-xs max-w-[120px] truncate">
                                                    {item.supplier ? (
                                                        <span className="flex items-center gap-1"><Truck size={11} className="text-slate-300" />{item.supplier}</span>
                                                    ) : <span className="text-slate-300">—</span>}
                                                </td>
                                                {isAdmin && <td className="px-4 py-3.5 text-right text-slate-500 text-xs">{Number(item.cost_price).toFixed(2)}</td>}
                                                <td className="px-4 py-3.5 text-right font-bold text-indigo-700">{Number(item.selling_price).toFixed(2)}</td>
                                                <td className="px-4 py-3.5 text-center">
                                                    <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-md text-xs font-bold ${item.quantity > 10 ? 'bg-emerald-50 text-emerald-700' : item.quantity > 0 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                                                        {item.quantity}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5 text-right">
                                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => openBarcodeModal(item)}
                                                            className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-md transition-all"
                                                            title="Print Barcode Label"
                                                        >
                                                            <Barcode size={15} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleEdit(item)}
                                                            className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-md transition-all"
                                                            title="Edit"
                                                        >
                                                            <Edit2 size={15} />
                                                        </button>
                                                        {isAdmin && (
                                                            <button
                                                                onClick={() => handleDelete(item.id, item.name)}
                                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
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
                        </div>
                    </div>
                </div>
            </main>

            {/* ── BARCODE PRINT MODAL ── */}
            {barcodeModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 no-print">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">Barcode Labels</h3>
                                <p className="text-sm text-slate-500">{barcodeModal.length} label{barcodeModal.length > 1 ? 's' : ''} ready to print</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => window.print()}
                                    className="h-10 px-5 flex items-center gap-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-[0_4px_10px_rgba(79,70,229,0.3)] transition-all active:scale-95"
                                >
                                    <Printer size={16} /> Print Now
                                </button>
                                <button onClick={() => setBarcodeModal(null)} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 transition-colors">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>
                        <div className="overflow-y-auto p-6">
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
