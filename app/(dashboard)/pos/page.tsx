"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRole } from '@/hooks/useRole';
import { Package, Plus, Trash2, ArrowLeft, Search, RefreshCw, ShoppingCart, Minus, Printer, CheckCircle, Ticket, ArrowRight, AlertTriangle, X, RotateCcw, CreditCard, Banknote, QrCode, SplitSquareHorizontal, CheckCircle2, Users, Clock, ClipboardList, Phone, UserPlus, ArrowDownRight } from 'lucide-react';
import Link from 'next/link';

export default function POSPage() {
    const [inventory, setInventory] = useState<any[]>([]);
    const [cart, setCart] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState('');
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isReturnMode, setIsReturnMode] = useState(false);
    const [discount, setDiscount] = useState({ type: 'fixed', value: 0 });
    const [taxRate, setTaxRate] = useState(0);
    const [checkoutModal, setCheckoutModal] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'upi' | 'split'>('cash');
    const [tenderedAmount, setTenderedAmount] = useState('');
    const [splitAmounts, setSplitAmounts] = useState({ cash: '', card: '', upi: '' });
    const [toasts, setToasts] = useState<{ id: string, message: string }[]>([]);
    const [receiptMode, setReceiptMode] = useState<{
        show: boolean,
        cart: any[],
        receiptId: string,
        total: number,
        discountAmount: number,
        taxAmount: number,
        date: Date,
        isRefund: boolean,
        paymentMethod: string,
        tendered: number,
        change: number
    } | null>(null);
    const [receiptSettings, setReceiptSettings] = useState({
        address1: '123 Party Lane',
        address2: 'Celebration City',
        phone: '(555) 019-2831'
    });

    // ── CRM ──────────────────────────────────────────────────────────────────
    const [customerSearch, setCustomerSearch] = useState('');
    const [customerResults, setCustomerResults] = useState<any[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
    const [newCustomerName, setNewCustomerName] = useState('');
    const [newCustomerPhone, setNewCustomerPhone] = useState('');
    const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);

    // ── Shift Management ─────────────────────────────────────────────────────
    const [activeShift, setActiveShift] = useState<any | null>(null);
    const [shiftModal, setShiftModal] = useState<'open' | 'close' | null>(null);
    const [openingCash, setOpeningCash] = useState('');
    const [closingCash, setClosingCash] = useState('');
    const [shiftSalesTotal, setShiftSalesTotal] = useState(0);
    const [shiftRefundsTotal, setShiftRefundsTotal] = useState(0);
    const [shiftPayoutsTotal, setShiftPayoutsTotal] = useState(0);
    const [shiftLoading, setShiftLoading] = useState(false);
    const [payoutModal, setPayoutModal] = useState(false);
    const [payoutAmount, setPayoutAmount] = useState('');
    const [payoutReason, setPayoutReason] = useState('');
    const [refundSearch, setRefundSearch] = useState('');
    const [refundError, setRefundError] = useState<string | null>(null);
    const [originalReceipt, setOriginalReceipt] = useState<any[] | null>(null);

    // ── RBAC ─────────────────────────────────────────────────────────────────
    const { profile, isAdmin } = useRole();

    useEffect(() => {
        fetchInventory();
        loadReceiptSettings();
        fetchActiveShift();

        // Setup Supabase Real-Time Listeners for POS updates
        const posSubscription = supabase.channel('pos-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'inventory' },
                () => {
                    // Fetch inventory silently so we don't trigger the full loading spinner
                    fetchInventory(true);
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'sales' },
                () => fetchActiveShift()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'payouts' },
                () => fetchActiveShift()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'shifts' },
                () => fetchActiveShift()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(posSubscription);
        };
    }, []);

    async function loadReceiptSettings() {
        const { data } = await supabase.from('settings').select('address1, address2, phone, pos_tax_rate').eq('id', 'store').single();
        if (data) {
            const s = { address1: data.address1 ?? '', address2: data.address2 ?? '', phone: data.phone ?? '' };
            setReceiptSettings(s);
            if (data.pos_tax_rate) setTaxRate(Number(data.pos_tax_rate));
            localStorage.setItem('pos_receipt_settings', JSON.stringify(s));
            if (data.pos_tax_rate) localStorage.setItem('pos_tax_rate', data.pos_tax_rate.toString());
        } else {
            const cached = localStorage.getItem('pos_receipt_settings');
            const cachedTax = localStorage.getItem('pos_tax_rate');
            if (cached) { try { setReceiptSettings(JSON.parse(cached)); } catch (_) { } }
            if (cachedTax) setTaxRate(Number(cachedTax));
        }
    }

    async function fetchInventory(silent = false) {
        if (!silent) setLoading(true);
        const { data: invData, error } = await supabase.from('inventory').select('*').order('name');
        if (!error && invData) setInventory(invData);
        if (!silent) setLoading(false);
    }

    // ── Shift helpers ────────────────────────────────────────────────────────
    async function fetchActiveShift() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from('shifts').select('*').eq('status', 'open').eq('cashier_id', user.id).order('opened_at', { ascending: false }).limit(1).single();
        setActiveShift(data ?? null);
        if (data) {
            const { data: sales } = await supabase.from('sales').select('cash_amount, quantity_sold').gte('created_at', data.opened_at);
            if (sales) {
                const salesTotal = sales.reduce((sum: number, s: any) => sum + (s.cash_amount > 0 ? Number(s.cash_amount) : 0), 0);
                const refundsTotal = sales.reduce((sum: number, s: any) => sum + (s.cash_amount < 0 ? Math.abs(Number(s.cash_amount)) : 0), 0);
                setShiftSalesTotal(salesTotal);
                setShiftRefundsTotal(refundsTotal);
            }

            const { data: payouts } = await supabase.from('payouts').select('amount').eq('shift_id', data.id);
            if (payouts) setShiftPayoutsTotal(payouts.reduce((sum: number, p: any) => sum + Number(p.amount), 0));
        }
    }

    async function openShift() {
        const amt = parseFloat(openingCash);
        if (isNaN(amt) || amt < 0) { alert('Enter a valid opening cash amount'); return; }
        setShiftLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        const { data } = await supabase.from('shifts').insert({
            cashier_id: user?.id,
            cashier_name: profile?.name ?? 'Unknown',
            opening_cash: amt,
            status: 'open'
        }).select().single();
        setActiveShift(data);
        setShiftSalesTotal(0);
        setShiftPayoutsTotal(0);
        setOpeningCash('');
        setShiftModal(null);
        setShiftLoading(false);
    }

    async function closeShift() {
        if (!activeShift) return;
        const amt = parseFloat(closingCash);
        if (isNaN(amt) || amt < 0) { alert('Enter closing cash amount'); return; }
        setShiftLoading(true);
        const expectedCash = (activeShift.opening_cash ?? 0) + shiftSalesTotal - shiftPayoutsTotal;
        await supabase.from('shifts').update({
            closed_at: new Date().toISOString(),
            closing_cash: amt,
            expected_cash: expectedCash,
            status: 'closed'
        }).eq('id', activeShift.id);
        setActiveShift(null);
        setClosingCash('');
        setShiftModal(null);
        setShiftLoading(false);
    }

    async function registerPayout() {
        if (!activeShift) return;
        const amt = parseFloat(payoutAmount);
        if (isNaN(amt) || amt <= 0) { alert('Enter a valid payout amount'); return; }
        if (!payoutReason.trim()) { alert('Enter a reason for the payout'); return; }
        setShiftLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('payouts').insert({
            shift_id: activeShift.id,
            cashier_id: user?.id,
            amount: amt,
            reason: payoutReason
        });
        setShiftPayoutsTotal(prev => prev + amt);
        setPayoutAmount('');
        setPayoutReason('');
        setPayoutModal(false);
        setShiftLoading(false);
    }

    // ── CRM helpers ──────────────────────────────────────────────────────────
    async function searchCustomers(term: string) {
        setCustomerSearch(term);
        if (term.length < 2) { setCustomerResults([]); return; }
        const { data } = await supabase.from('customers').select('*').or('name.ilike.%' + term + '%,phone.ilike.%' + term + '%').limit(5);
        setCustomerResults(data ?? []);
    }

    async function createAndSelectCustomer() {
        if (!newCustomerName) return;
        const { data, error } = await supabase.from('customers').insert({ name: newCustomerName, phone: newCustomerPhone || null }).select().single();
        if (!error && data) {
            setSelectedCustomer(data);
            setShowNewCustomerForm(false);
            setNewCustomerName('');
            setNewCustomerPhone('');
            setCustomerSearch('');
            setCustomerResults([]);
        }
    }

    async function fetchReceiptItems() {
        if (!refundSearch.trim()) return;
        setLoading(true);
        setRefundError(null);
        setOriginalReceipt(null);

        const term = refundSearch.trim().toUpperCase();

        // Try searching for the exact term, or with RCT- or REF- prefix if not provided
        const searchTerms = [term];
        if (!term.startsWith('RCT-') && !term.startsWith('REF-')) {
            searchTerms.push('RCT-' + term);
            searchTerms.push('REF-' + term);
        }

        const { data, error } = await supabase
            .from('sales')
            .select('*')
            .in('receipt_id', searchTerms);

        if (error) {
            setRefundError('Error searching receipt: ' + error.message);
        } else if (!data || data.length === 0) {
            setRefundError('Receipt "' + term + '" not found. Please check the Sales History.');
        } else if (data[0].quantity_sold < 0) {
            setRefundError('This is already a refund receipt.');
        } else {
            setOriginalReceipt(data);
            // Auto-populate cart with all items for refund
            // IMPORTANT: use item.item_id (inventory FK), NOT item.id (sales PK) to avoid FK violation on re-insert
            const refundItems = data.map(item => ({
                ...item,
                id: item.item_id,           // <-- must be the inventory UUID for item_id FK
                selling_price: item.sold_price,
                cartQty: Math.abs(item.quantity_sold)
            }));
            setCart(refundItems);


            // If the receipt has a customer, select them
            if (data[0].customer_id) {
                const { data: cust } = await supabase.from('customers').select('*').eq('id', data[0].customer_id).single();
                if (cust) setSelectedCustomer(cust);
            }
        }
        setLoading(false);
    }

    const rawSubtotal = cart.reduce((sum, item) => sum + (item.selling_price * (Number(item.cartQty) || 0)), 0);
    let discountAmount = discount.type === 'percent' ? rawSubtotal * (discount.value / 100) : discount.value;
    if (discountAmount > rawSubtotal) discountAmount = rawSubtotal;
    const taxableAmount = Math.max(0, rawSubtotal - discountAmount);
    const taxAmount = taxableAmount * (taxRate / 100);
    const cartTotalNormal = taxableAmount + taxAmount;
    const finalCartTotal = isReturnMode ? -cartTotalNormal : cartTotalNormal;
    const parsedTendered = Number(tenderedAmount) || 0;
    const changeDue = parsedTendered - finalCartTotal;
    const splitTotal = (Number(splitAmounts.cash) || 0) + (Number(splitAmounts.card) || 0) + (Number(splitAmounts.upi) || 0);

    function addToCart(item: any) {
        setCart(prev => {
            const existing = prev.find(i => i.id === (item.id || item.item_id));
            if (existing) {
                let currentQty = Number(existing.cartQty) || 0;

                if (isReturnMode && originalReceipt) {
                    const originalLine = originalReceipt.find(l => l.item_id === (item.id || item.item_id));
                    if (originalLine && currentQty >= Math.abs(originalLine.quantity_sold)) {
                        alert('Cannot refund more than originally purchased (' + Math.abs(originalLine.quantity_sold) + ')');
                        return prev;
                    }
                } else if (!isReturnMode && currentQty >= item.quantity) {
                    alert('Cannot add more. Only ' + item.quantity + ' in stock.');
                    return prev;
                }

                return prev.map(i => i.id === (item.id || item.item_id) ? { ...i, cartQty: currentQty + 1 } : i);
            } else {
                if (isReturnMode && originalReceipt) {
                    const originalLine = originalReceipt.find(l => l.item_id === (item.id || item.item_id));
                    if (!originalLine) {
                        alert('This item was not part of the original receipt.');
                        return prev;
                    }
                } else if (!isReturnMode && item.quantity < 1) {
                    alert("Item out of stock!");
                    return prev;
                }
                return [...prev, { ...item, id: item.id || item.item_id, cartQty: 1 }];
            }
        });
    }

    function decrementCart(id: string) {
        setCart(prev => {
            const existing = prev.find(i => i.id === id);
            if (existing) {
                let currentQty = Number(existing.cartQty) || 0;
                if (currentQty > 1) return prev.map(i => i.id === id ? { ...i, cartQty: currentQty - 1 } : i);
            }
            return prev.filter(i => i.id !== id);
        });
    }

    function removeFromCart(id: string) {
        setCart(prev => prev.filter(i => i.id !== id));
    }

    function updateCartItemQty(id: string, val: string, maxQty: number) {
        if (val === '') {
            setCart(prev => prev.map(i => i.id === id ? { ...i, cartQty: '' } : i));
            return;
        }
        let qty = parseInt(val, 10);
        if (isNaN(qty)) return;
        if (!isReturnMode && qty > maxQty) {
            alert('Cannot add more. Only ' + maxQty + ' in stock.');
            qty = maxQty;
        }
        setCart(prev => prev.map(i => i.id === id ? { ...i, cartQty: qty } : i));
    }

    function handleQtyBlur(id: string, currentQty: any) {
        let qty = parseInt(currentQty, 10);
        if (isNaN(qty) || qty <= 0) qty = 1;
        setCart(prev => prev.map(i => i.id === id ? { ...i, cartQty: qty } : i));
    }

    function openPaymentModal() {
        if (cart.length === 0) return;
        if (isReturnMode) {
            setTenderedAmount(cartTotalNormal.toFixed(2));
        } else {
            setTenderedAmount('');
        }
        setSplitAmounts({ cash: '', card: '', upi: '' });
        setPaymentMethod('cash');
        setCheckoutModal(true);
    }

    async function processCheckout() {
        if (paymentMethod === 'split' && Math.abs(splitTotal - Math.abs(finalCartTotal)) > 0.01) {
            alert('Split amounts must equal the total. Remaining: Rs ' + (Math.abs(finalCartTotal) - splitTotal).toFixed(2));
            return;
        }
        if (paymentMethod === 'cash' && parsedTendered < finalCartTotal && !isReturnMode) {
            alert("Tendered amount is less than total due!");
            return;
        }

        setIsProcessing(true);

        const genId = Math.random().toString(36).substring(2, 10).toUpperCase();
        const receiptId = isReturnMode ? (refundSearch || 'REF-' + genId) : ('RCT-' + genId);
        const sign = isReturnMode ? -1 : 1;

        const salesInserts: any[] = [];

        const cashAmountToRecord = isReturnMode
            ? -(paymentMethod === 'cash' ? Math.abs(finalCartTotal) : paymentMethod === 'split' ? parseFloat(splitAmounts.cash || '0') : 0)
            : (paymentMethod === 'cash' ? finalCartTotal : paymentMethod === 'split' ? parseFloat(splitAmounts.cash || '0') : 0);

        cart.forEach((item, index) => {
            const qty = (Number(item.cartQty) || 1) * sign;
            salesInserts.push({
                receipt_id: receiptId,
                item_id: item.id,
                name: item.name,
                cost_price: item.cost_price,
                sold_price: item.selling_price,
                quantity_sold: qty,
                customer_id: selectedCustomer?.id ?? null,
                payment_method: paymentMethod,
                cash_amount: index === 0 ? cashAmountToRecord : 0
            });
        });

        // Note: discount & tax are not stored as line items (item_id must be a valid UUID).
        // They are tracked in receiptMode state for receipt display only.
        const { error: salesError } = await supabase.from('sales').insert(salesInserts);

        if (salesError) {
            alert('Error processing checkout: ' + salesError.message);
            setIsProcessing(false);
            return;
        }

        let lowStockAlerts: string[] = [];

        for (const item of cart) {
            const currentQtyInCart = Number(item.cartQty) || 1;

            // Fetch latest inventory quantity to avoid out-of-sync or NaN issues (especially during refunds)
            const { data: invData } = await supabase
                .from('inventory')
                .select('quantity')
                .eq('id', item.id)
                .single();

            const currentInventoryQty = invData?.quantity ?? 0;
            const newQty = currentInventoryQty - (currentQtyInCart * sign);
            const finalQty = newQty < 0 ? 0 : newQty;

            await supabase.from('inventory').update({ quantity: finalQty }).eq('id', item.id);

            if (!isReturnMode) {
                const milestones = [100, 50, 20, 10, 5];
                for (const milestone of milestones) {
                    if (currentInventoryQty >= milestone && finalQty < milestone) {
                        lowStockAlerts.push('\u26a0\ufe0f "' + item.name + '" stock just dropped below ' + milestone + '! (Now: ' + finalQty + ')');
                        break;
                    }
                }
            }
        }

        if (lowStockAlerts.length > 0) {
            const newToasts = lowStockAlerts.map(msg => ({ id: Math.random().toString(), message: msg }));
            setToasts(prev => [...prev, ...newToasts]);
            newToasts.forEach(t => setTimeout(() => setToasts(prev => prev.filter(toast => toast.id !== t.id)), 6000));
            const historyEntries = lowStockAlerts.map(msg => ({ title: 'Low Stock Alert', message: msg, type: 'warning' }));
            supabase.from('notifications').insert(historyEntries).then();
        }

        let finalPaymentStr = paymentMethod.toUpperCase();
        if (paymentMethod === 'split') {
            const parts: string[] = [];
            if (Number(splitAmounts.cash) > 0) parts.push('CASH: ' + splitAmounts.cash);
            if (Number(splitAmounts.card) > 0) parts.push('CARD: ' + splitAmounts.card);
            if (Number(splitAmounts.upi) > 0) parts.push('UPI: ' + splitAmounts.upi);
            finalPaymentStr = 'SPLIT (' + parts.join(', ') + ')';
        }

        setReceiptMode({
            show: true,
            cart: [...cart],
            receiptId,
            total: finalCartTotal,
            discountAmount,
            taxAmount,
            date: new Date(),
            isRefund: isReturnMode,
            paymentMethod: finalPaymentStr,
            tendered: paymentMethod === 'cash' ? parsedTendered : Math.abs(finalCartTotal),
            change: paymentMethod === 'cash' && !isReturnMode ? changeDue : 0
        });

        setCart([]);
        setDiscount({ type: 'fixed', value: 0 });
        setIsReturnMode(false);
        setRefundSearch('');
        setRefundError(null);
        setOriginalReceipt(null);
        setCheckoutModal(false);

        // Update customer stats if a customer was selected
        if (selectedCustomer && !isReturnMode) {
            await supabase.from('customers').update({
                total_spent: (selectedCustomer.total_spent ?? 0) + Math.abs(finalCartTotal),
                visit_count: (selectedCustomer.visit_count ?? 0) + 1
            }).eq('id', selectedCustomer.id);
        }
        setSelectedCustomer(null);
        setCustomerSearch('');
        setIsProcessing(false);
        // We still fetch explicitly just in case Realtime was delayed, silently.
        fetchInventory(true);
    }

    const POS_CATEGORIES = ['All', 'Balloons', 'Decorations', 'Candles', 'Toys', 'Stationery', 'Costumes', 'Other'];
    const filteredInventory = inventory.filter(item => {
        const matchSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.item_code ?? '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchCat = !activeCategory || activeCategory === 'All' || item.category === activeCategory;
        return matchSearch && matchCat;
    });

    return (
        <>
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page { margin: 0; size: 80mm auto; }
                    body { margin: 0; -webkit-print-color-adjust: exact; }
                    ::-webkit-scrollbar { display: none; }
                }
            `}} />

            <div className={`h-screen flex flex-col overflow-hidden print:hidden select-none font-sans text-slate-900 transition-colors duration-500 ${isReturnMode ? 'bg-red-50/30' : 'bg-slate-50'}`}>

                {/* Navbar */}
                <nav className={`h-16 flex-shrink-0 bg-white border-b px-4 sm:px-6 flex items-center justify-between z-10 shadow-sm transition-colors ${isReturnMode ? 'border-red-200' : 'border-slate-200/80'}`}>
                    <div className="flex items-center gap-4">
                        <Link href="/" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-600 transition-colors">
                            <ArrowLeft size={20} />
                        </Link>
                        <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-md ${isReturnMode ? 'bg-red-600 shadow-red-200' : 'bg-indigo-600 shadow-indigo-200'}`}>
                                {isReturnMode ? <RotateCcw size={16} strokeWidth={2.5} /> : <Ticket size={18} strokeWidth={2.5} />}
                            </div>
                            <span className="font-bold text-lg tracking-tight text-slate-900 hidden sm:block">
                                {isReturnMode ? 'Refund Register' : 'Cash Register'}
                            </span>
                        </div>
                    </div>

                    <div className="flex-1 max-w-xl mx-4 sm:mx-8 relative">
                        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search products by name or SKU..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full h-11 pl-11 pr-4 bg-slate-100/70 border border-slate-200/80 rounded-full text-sm font-medium focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-inner placeholder-slate-500 text-slate-900"
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Payout Button */}
                        {activeShift && (
                            <button
                                onClick={() => setPayoutModal(true)}
                                className="h-9 px-3 flex items-center gap-2 rounded-lg text-sm font-bold transition-all border shadow-sm bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                            >
                                <ArrowDownRight size={16} strokeWidth={2.5} />
                                <span className="hidden sm:block">Payout Exp.</span>
                            </button>
                        )}

                        {/* Shift Button */}
                        <button
                            onClick={() => setShiftModal(activeShift ? 'close' : 'open')}
                            className={`h-9 px-3 flex items-center gap-2 rounded-lg text-sm font-bold transition-all border shadow-sm ${activeShift ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                }`}
                        >
                            <Clock size={14} />
                            <span className="hidden sm:inline">{activeShift ? 'Close Shift' : 'Open Shift'}</span>
                        </button>
                        <button
                            onClick={() => {
                                if (isReturnMode) {
                                    setRefundSearch('');
                                    setRefundError(null);
                                    setOriginalReceipt(null);
                                }
                                setIsReturnMode(!isReturnMode);
                                setCart([]);
                            }}
                            className={`h-9 px-4 flex items-center gap-2 rounded-lg text-sm font-bold transition-all border shadow-sm ${isReturnMode ? 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200' : 'bg-white text-slate-700 border-slate-200 hover:bg-red-50 hover:text-red-600'}`}
                        >
                            <RotateCcw size={14} />
                            {isReturnMode ? 'Exit Refund Mode' : 'Refund Mode'}
                        </button>
                    </div>
                </nav>

                {/* Shift Status Banner */}
                {!activeShift && (
                    <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center gap-2 text-amber-800 text-sm font-semibold">
                        <AlertTriangle size={15} className="text-amber-500" />
                        No active shift. Sales are still recorded, but{' '}
                        <button onClick={() => setShiftModal('open')} className="underline hover:text-amber-900">click here to open a shift</button>
                        {' '}to track cash drawer.
                    </div>
                )}
                {activeShift && (
                    <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2 flex items-center justify-between text-emerald-700 text-xs font-semibold overflow-x-auto no-scrollbar gap-4">
                        <div className="flex items-center gap-4 flex-shrink-0">
                            <div className="flex items-center gap-1.5"><Clock size={13} className="text-emerald-500" /> Opened {new Date(activeShift.opened_at).toLocaleTimeString()}</div>
                            <div className="flex items-center gap-1.5"><Users size={13} className="text-emerald-500" /> {activeShift.cashier_name}</div>
                            <div className="flex items-center gap-1.5 font-bold">Float Rs.{activeShift.opening_cash}</div>
                        </div>
                        <div className="flex items-center gap-6 flex-shrink-0">
                            <div className="flex items-center gap-1.5">Sales <span className="font-extrabold">Rs. {shiftSalesTotal.toFixed(2)}</span></div>
                            <div className="flex items-center gap-1.5 text-red-600">Refunds <span className="font-extrabold">Rs. {shiftRefundsTotal.toFixed(2)}</span></div>
                            <div className="flex items-center gap-1.5 text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
                                Net Cash <span className="font-extrabold">Rs. {(activeShift.opening_cash + shiftSalesTotal - shiftRefundsTotal - shiftPayoutsTotal).toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Main Content Area */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left Side: Product Grid */}
                    <div className="flex-1 overflow-y-auto relative flex flex-col">
                        {/* Category Filter Bar or Refund Search */}
                        <div className="flex-shrink-0 px-4 pt-4 pb-2 border-b border-slate-200/80 bg-white/80 backdrop-blur-sm sticky top-0 z-10 transition-all">
                            {isReturnMode ? (
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-3">
                                        <div className="relative flex-1">
                                            <Ticket size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-red-400" />
                                            <input
                                                type="text"
                                                placeholder="Enter original Receipt ID (e.g. RCT-XXXXX)..."
                                                value={refundSearch}
                                                onChange={e => setRefundSearch(e.target.value.toUpperCase())}
                                                className="w-full h-10 pl-9 pr-4 bg-red-50/50 border border-red-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 placeholder-red-300 text-red-900"
                                                onKeyDown={e => e.key === 'Enter' && fetchReceiptItems()}
                                            />
                                        </div>
                                        <button
                                            onClick={fetchReceiptItems}
                                            disabled={loading || !refundSearch}
                                            className="h-10 px-6 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                                        >
                                            {loading ? <RefreshCw size={16} className="animate-spin" /> : 'Fetch Receipt'}
                                        </button>
                                    </div>
                                    {refundError && (
                                        <div className="flex items-center gap-2 text-red-600 text-xs font-bold animate-in fade-in duration-300">
                                            <AlertTriangle size={14} /> {refundError}
                                        </div>
                                    )}
                                    {originalReceipt && (
                                        <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold animate-in fade-in duration-300">
                                            <CheckCircle2 size={14} /> Receipt found! You can now adjust items to refund.
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                                    {POS_CATEGORIES.map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => setActiveCategory(cat === 'All' ? '' : cat)}
                                            className={`flex-shrink-0 h-8 px-3 rounded-full text-xs font-bold border transition-all ${(cat === 'All' && !activeCategory) || activeCategory === cat
                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                                : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                                                }`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 sm:p-5 pb-24">
                            {loading ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                                    <RefreshCw size={32} className="animate-spin opacity-50 text-indigo-500" />
                                    <p className="font-medium text-slate-500">Loading catalog...</p>
                                </div>
                            ) : filteredInventory.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                                    <Package size={48} className="opacity-20 text-slate-500" />
                                    <p className="font-medium text-slate-500 text-lg">No products found.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 relative z-0">
                                    {filteredInventory.map((item) => {
                                        const outOfStock = item.quantity < 1 && !isReturnMode;
                                        return (
                                            <button
                                                key={item.id}
                                                onClick={() => addToCart(item)}
                                                disabled={outOfStock}
                                                className={`relative flex flex-col text-left bg-white border p-4 rounded-2xl transition-all duration-200 group ${outOfStock ? 'border-slate-100 opacity-60 grayscale cursor-not-allowed' : isReturnMode ? 'border-slate-200 shadow-sm hover:shadow-md hover:border-red-300 hover:-translate-y-0.5 active:scale-95' : 'border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 hover:-translate-y-0.5 active:scale-95 active:translate-y-0'}`}
                                            >
                                                <div className={`absolute top-3 right-3 font-bold px-2 py-1 rounded-lg text-xs border transition-colors ${isReturnMode ? 'bg-red-50 text-red-700 border-red-100 group-hover:bg-red-600 group-hover:text-white' : 'bg-indigo-50 text-indigo-700 border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white'}`}>
                                                    Rs. {item.selling_price.toFixed(2)}
                                                </div>
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors border ${isReturnMode ? 'bg-red-50 text-red-400 group-hover:bg-red-100 group-hover:text-red-500 border-red-50' : 'bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 border-slate-100'}`}>
                                                    <Package size={24} />
                                                </div>
                                                <h3 className="font-bold text-slate-900 text-sm leading-tight mb-1">{item.name}</h3>
                                                <p className="font-mono text-[10px] text-slate-400 mb-3">{item.item_code}</p>
                                                <div className="mt-auto">
                                                    <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase ${item.quantity < 1 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                        {item.quantity < 1 ? 'Out of Stock' : item.quantity + ' In Stock'}
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Side: Smart Cart */}
                    <div className="w-[360px] lg:w-[420px] flex-shrink-0 bg-white border-l border-slate-200 shadow-2xl flex flex-col z-20">
                        {/* Cart Header */}
                        <div className={`h-16 flex items-center justify-between px-6 border-b border-slate-100 ${isReturnMode ? 'bg-red-50/50' : ''}`}>
                            <h2 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                                <ShoppingCart size={20} className={isReturnMode ? "text-red-500" : "text-indigo-500"} />
                                {isReturnMode ? 'Refunding Items' : 'Current Sale'}
                            </h2>
                            <div className="flex items-center gap-2">
                                {cart.length > 0 && (
                                    <button
                                        onClick={() => {
                                            if (confirm('Clear all items from cart?')) {
                                                setCart([]);
                                                setDiscount({ type: 'fixed', value: 0 });
                                            }
                                        }}
                                        className="text-[10px] font-bold text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-md transition-colors"
                                    >
                                        Clear
                                    </button>
                                )}
                                <span className="bg-slate-100 text-slate-600 font-bold text-xs px-2.5 py-1 rounded-md">
                                    {cart.reduce((sum, item) => sum + (Number(item.cartQty) || 0), 0)} Items
                                </span>
                            </div>
                        </div>

                        {/* Cart Items List */}
                        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                            {cart.length === 0 ? (
                                <div className="m-auto flex flex-col items-center justify-center text-slate-400 text-center px-6">
                                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                                        <ShoppingCart size={32} className="text-slate-300" strokeWidth={1.5} />
                                    </div>
                                    <p className="font-medium text-slate-600 mb-1">Cart is empty</p>
                                    <p className="text-sm">Scan items or click on products to add them to the sale.</p>
                                </div>
                            ) : (
                                cart.map(item => {
                                    const qty = Number(item.cartQty) || 0;
                                    const rowTotal = item.selling_price * qty;
                                    return (
                                        <div key={item.id} className={`bg-white border p-3 rounded-xl shadow-sm flex flex-col gap-3 group transition-colors ${isReturnMode ? 'border-red-100 hover:border-red-300' : 'border-slate-200/80 hover:border-indigo-200'}`}>
                                            <div className="flex justify-between items-start">
                                                <div className="pr-4">
                                                    <h4 className="font-bold text-slate-900 text-sm leading-tight mb-0.5">{item.name}</h4>
                                                    <p className="font-mono text-xs text-slate-400">Rs. {item.selling_price.toFixed(2)} / ea</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className={`font-bold text-sm ${isReturnMode ? 'text-red-600' : 'text-slate-900'}`}>
                                                        {isReturnMode ? '-' : ''}Rs. {rowTotal.toFixed(2)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5">
                                                    <button onClick={() => decrementCart(item.id)} className="w-7 h-7 flex items-center justify-center bg-white border border-slate-200 rounded-md text-slate-600 hover:bg-slate-100 hover:text-red-500 transition-colors active:scale-95 shadow-sm">
                                                        <Minus size={14} />
                                                    </button>
                                                    <input
                                                        type="number"
                                                        value={item.cartQty}
                                                        onChange={e => updateCartItemQty(item.id, e.target.value, item.quantity)}
                                                        onBlur={() => handleQtyBlur(item.id, item.cartQty)}
                                                        className="w-10 text-center font-bold text-slate-800 text-xs bg-transparent border-none focus:outline-none focus:ring-0 p-0 m-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    />
                                                    <button onClick={() => addToCart(item)} className={`w-7 h-7 flex items-center justify-center bg-white border border-slate-200 rounded-md text-slate-600 transition-colors active:scale-95 shadow-sm ${isReturnMode ? 'hover:bg-red-50 hover:text-red-600 hover:border-red-200' : 'hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200'}`}>
                                                        <Plus size={14} />
                                                    </button>
                                                </div>
                                                <button onClick={() => removeFromCart(item.id)} className="text-xs font-semibold text-slate-400 hover:text-red-600 flex items-center gap-1 transition-colors px-2 py-1 rounded-md hover:bg-red-50">
                                                    <Trash2 size={12} /> Remove
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Cart Math & Discounts */}
                        <div className="bg-slate-50 border-t border-slate-200">
                            {!isReturnMode && (
                                <div className="px-4 pt-4 pb-2 flex gap-2 border-b border-slate-100/50">
                                    <div className="flex-1 flex bg-white border border-slate-200 rounded-lg overflow-hidden focus-within:border-indigo-500 focus-within:ring-2 ring-indigo-500/20 transition-all">
                                        <button
                                            onClick={() => setDiscount(d => ({ ...d, type: d.type === 'fixed' ? 'percent' : 'fixed' }))}
                                            className="px-3 bg-slate-50 border-r border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                                        >
                                            {discount.type === 'fixed' ? 'Rs.' : '%'}
                                        </button>
                                        <input
                                            type="number"
                                            placeholder="Discount"
                                            value={discount.value === 0 ? '' : discount.value}
                                            onChange={e => setDiscount(d => ({ ...d, value: Math.max(0, Number(e.target.value)) }))}
                                            className="w-full text-sm font-medium px-3 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-slate-900 placeholder-slate-500"
                                        />
                                    </div>
                                    <div className="flex-1 flex bg-white border border-slate-200 rounded-lg overflow-hidden focus-within:border-indigo-500 focus-within:ring-2 ring-indigo-500/20 transition-all">
                                        <div className="px-3 flex items-center bg-slate-50 border-r border-slate-200 text-xs font-bold text-slate-600">
                                            Tax %
                                        </div>
                                        <input
                                            type="number"
                                            placeholder="0"
                                            value={taxRate === 0 ? '' : taxRate}
                                            onChange={e => setTaxRate(Math.max(0, Number(e.target.value)))}
                                            className="w-full text-sm font-medium px-3 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-slate-900 placeholder-slate-500"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="p-6 pb-8 sm:pb-6">
                                <div className="flex justify-between items-center mb-1.5 text-slate-500 text-sm">
                                    <span>Subtotal</span>
                                    <span className="font-semibold text-slate-700">Rs. {rawSubtotal.toFixed(2)}</span>
                                </div>
                                {!isReturnMode && discountAmount > 0 && (
                                    <div className="flex justify-between items-center mb-1.5 text-emerald-500 text-sm font-medium">
                                        <span>Discount {discount.type === 'percent' ? '(' + discount.value + '%)' : ''}</span>
                                        <span>- Rs. {discountAmount.toFixed(2)}</span>
                                    </div>
                                )}
                                {!isReturnMode && taxAmount > 0 && (
                                    <div className="flex justify-between items-center mb-4 text-slate-500 text-sm">
                                        <span>Tax ({taxRate}%)</span>
                                        <span className="font-semibold text-slate-700">+ Rs. {taxAmount.toFixed(2)}</span>
                                    </div>
                                )}

                                <div className="flex justify-between items-end mb-6 mt-4 pt-4 border-t border-slate-200">
                                    <span className="font-bold text-slate-900 text-lg">Total</span>
                                    <span className={`font-extrabold text-4xl tracking-tight ${isReturnMode ? 'text-red-600' : 'text-indigo-600'}`}>
                                        {isReturnMode ? '-' : ''}Rs. {cartTotalNormal.toFixed(2)}
                                    </span>
                                </div>

                                <button
                                    onClick={openPaymentModal}
                                    disabled={cart.length === 0}
                                    className={`w-full h-16 flex items-center justify-center gap-2 text-white rounded-[1rem] text-lg font-bold hover:shadow-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 disabled:hover:shadow-none ${isReturnMode ? 'bg-red-600 hover:bg-red-700 hover:shadow-red-200' : 'bg-slate-900 hover:bg-slate-800 hover:shadow-slate-300'}`}
                                >
                                    {isReturnMode ? (
                                        <>Refund Rs. {cartTotalNormal.toFixed(2)} <RotateCcw size={20} className="ml-1 opacity-70" /></>
                                    ) : (
                                        <>Charge Rs. {cartTotalNormal.toFixed(2)} <ArrowRight size={20} className="ml-1 opacity-70" /></>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- PAYMENT TENDERING MODAL --- */}
            {checkoutModal && (
                <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[1.5rem] shadow-2xl w-full max-w-lg flex flex-col max-h-[95vh] overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 flex-shrink-0 z-10">
                            <div>
                                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Complete Payment</h2>
                                <p className="text-slate-500 text-sm mt-0.5">Select a payment method to finalize the sale.</p>
                            </div>
                            <button onClick={() => setCheckoutModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="py-5 px-6 bg-slate-900 flex flex-col items-center justify-center text-white relative overflow-hidden flex-shrink-0">
                            <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
                            <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl"></div>
                            <p className="text-slate-300 font-medium text-sm mb-1 z-10 uppercase tracking-widest">{isReturnMode ? 'Total Refund Due' : 'Total Amount Due'}</p>
                            <p className="text-5xl font-extrabold tracking-tight z-10">Rs. {Math.abs(finalCartTotal).toFixed(2)}</p>
                        </div>

                        <div className="flex-1 overflow-y-auto min-h-0 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-300">
                            <div className="p-6">
                                <div className="grid grid-cols-4 gap-2 mb-6 p-1 bg-slate-100 rounded-xl">
                                    {[
                                        { id: 'cash', label: 'Cash', icon: Banknote },
                                        { id: 'card', label: 'Card', icon: CreditCard },
                                        { id: 'upi', label: 'UPI', icon: QrCode },
                                        { id: 'split', label: 'Split', icon: SplitSquareHorizontal },
                                    ].map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => {
                                                setPaymentMethod(tab.id as any);
                                                if (tab.id === 'cash') setTenderedAmount(Math.abs(finalCartTotal).toFixed(2));
                                            }}
                                            className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-lg text-xs font-bold transition-all ${paymentMethod === tab.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                                        >
                                            <tab.icon size={18} className={paymentMethod === tab.id ? "text-indigo-500" : "opacity-70"} />
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>

                                <div className="min-h-[140px] flex flex-col justify-center">
                                    {paymentMethod === 'cash' && (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-bold text-slate-700 mb-2">Tendered Amount (Rs.)</label>
                                                <div className="relative">
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">Rs.</span>
                                                    <input
                                                        type="number"
                                                        autoFocus
                                                        value={tenderedAmount}
                                                        onChange={e => setTenderedAmount(e.target.value)}
                                                        className="w-full text-2xl font-extrabold pl-12 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-4 ring-indigo-500/10 transition-all text-slate-900"
                                                    />
                                                </div>
                                                {!isReturnMode && (
                                                    <div className={`flex justify-between items-center p-4 rounded-xl border ${changeDue >= 0 ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-800'}`}>
                                                        <span className="font-bold">{changeDue >= 0 ? 'Change Due:' : 'Insufficient:'}</span>
                                                        <span className="text-xl font-extrabold tabular-nums">Rs. {Math.abs(changeDue).toFixed(2)}</span>
                                                    </div>
                                                )}
                                                {isReturnMode && (
                                                    <div className={`flex justify-between items-center p-4 rounded-xl border ${Number(tenderedAmount) >= Math.abs(finalCartTotal) ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-800'}`}>
                                                        <span className="font-bold">{Number(tenderedAmount) >= Math.abs(finalCartTotal) ? 'Refund Amount:' : 'Insufficient Tender:'}</span>
                                                        <span className="text-xl font-extrabold tabular-nums">Rs. {Math.abs(finalCartTotal).toFixed(2)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {(paymentMethod === 'card' || paymentMethod === 'upi') && (
                                        <div className="text-center py-4">
                                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                                {paymentMethod === 'card' ? <CreditCard size={32} className="text-slate-400" /> : <QrCode size={32} className="text-slate-400" />}
                                            </div>
                                            <p className="font-bold text-slate-700 text-lg mb-1">Process via {paymentMethod === 'card' ? 'Terminal' : 'App'}</p>
                                            <p className="text-slate-500 text-sm">Collect Rs. {Math.abs(finalCartTotal).toFixed(2)} externally, then confirm below.</p>
                                        </div>
                                    )}

                                    {paymentMethod === 'split' && (
                                        <div className="space-y-3">
                                            <div className="grid grid-cols-3 gap-3">
                                                {['cash', 'card', 'upi'].map(type => (
                                                    <div key={type}>
                                                        <label className="block text-xs font-bold text-slate-500 mb-1 uppercase pl-1">{type}</label>
                                                        <input
                                                            type="number"
                                                            placeholder="0.00"
                                                            value={splitAmounts[type as keyof typeof splitAmounts]}
                                                            onChange={e => setSplitAmounts(prev => ({ ...prev, [type]: e.target.value }))}
                                                            className="w-full text-sm font-bold px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 ring-indigo-500/20 transition-all text-slate-900 placeholder-slate-500"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex justify-between items-center px-2 pt-2">
                                                <span className="text-sm font-bold text-slate-500">Remaining:</span>
                                                <span className={`font-bold ${Math.abs(Math.abs(finalCartTotal) - splitTotal) < 0.01 ? 'text-emerald-500' : 'text-amber-500'}`}>
                                                    Rs. {Math.max(0, Math.abs(finalCartTotal) - splitTotal).toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* --- REDESIGNED CRM LOOKUP --- */}
                            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <Users size={14} className="text-indigo-500" />
                                    Attach Customer <span className="font-normal normal-case text-slate-400">(Optional)</span>
                                </label>
                                {selectedCustomer ? (
                                    <div className="flex items-center justify-between bg-white border-2 border-indigo-100 shadow-sm rounded-xl px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm">
                                                {selectedCustomer.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800 text-sm leading-tight">{selectedCustomer.name}</p>
                                                {selectedCustomer.phone && <p className="text-xs text-slate-500">{selectedCustomer.phone}</p>}
                                            </div>
                                        </div>
                                        <button onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                                            <X size={16} />
                                        </button>
                                    </div>
                                ) : showNewCustomerForm ? (
                                    <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-3 shadow-sm">
                                        <div className="space-y-2">
                                            <input
                                                autoFocus
                                                type="text" placeholder="Full Name *"
                                                value={newCustomerName}
                                                onChange={e => setNewCustomerName(e.target.value)}
                                                className="w-full h-10 px-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 ring-indigo-500/20 text-slate-900 placeholder-slate-500"
                                            />
                                            <input
                                                type="tel" placeholder="Phone number (optional)"
                                                value={newCustomerPhone}
                                                onChange={e => setNewCustomerPhone(e.target.value)}
                                                className="w-full h-10 px-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 ring-indigo-500/20 text-slate-900 placeholder-slate-500"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => setShowNewCustomerForm(false)} className="flex-1 h-10 text-xs font-bold bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors">Cancel</button>
                                            <button onClick={createAndSelectCustomer} disabled={!newCustomerName} className="flex-[2] h-10 text-xs font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">Save & Attach</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text" placeholder="Search by name or phone..."
                                            value={customerSearch}
                                            onChange={e => searchCustomers(e.target.value)}
                                            className="w-full h-11 pl-10 pr-10 text-sm bg-white border border-slate-200 shadow-sm rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 ring-indigo-500/20 transition-all text-slate-900 placeholder-slate-500"
                                        />
                                        {customerSearch && (
                                            <button onClick={() => { setCustomerSearch(''); setCustomerResults([]); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                                <X size={16} />
                                            </button>
                                        )}
                                        {customerResults.length > 0 && (
                                            <div className="absolute bottom-[50px] left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-[100] overflow-hidden max-h-48 overflow-y-auto">
                                                {customerResults.map(c => (
                                                    <button key={c.id} onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); setCustomerResults([]); }}
                                                        className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100 last:border-0 transition-colors">
                                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs flex-shrink-0">
                                                            {c.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-slate-800">{c.name}</p>
                                                            <p className="text-xs text-slate-400">{c.phone ?? 'No phone'}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {customerSearch.length >= 2 && customerResults.length === 0 && (
                                            <div className="absolute bottom-[50px] left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-[100] p-2">
                                                <p className="text-sm text-slate-500 px-2 py-1 text-center mb-1">No customers found.</p>
                                                <button onClick={() => { setNewCustomerName(customerSearch); setShowNewCustomerForm(true); setCustomerResults([]); }}
                                                    className="w-full py-2.5 flex items-center justify-center gap-2 text-sm text-white bg-indigo-600 rounded-lg font-semibold hover:bg-indigo-700 transition-colors">
                                                    <UserPlus size={16} /> Add "{customerSearch}"
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer Buttons */}
                        <div className="p-5 border-t border-slate-100 bg-slate-50 rounded-b-[1.5rem] flex gap-3 flex-shrink-0 z-10">
                            <button
                                onClick={() => setCheckoutModal(false)}
                                className="flex-1 h-14 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-100 transition-all active:scale-95"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={processCheckout}
                                disabled={isProcessing || (paymentMethod === 'cash' && changeDue < 0 && !isReturnMode)}
                                className="flex-[2] h-14 flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-xl font-bold shadow-[0_4px_14px_rgba(79,70,229,0.3)] hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none disabled:active:scale-100"
                            >
                                {isProcessing ? <RefreshCw size={20} className="animate-spin" /> : <><CheckCircle2 size={20} /> Confirm Sale</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- SHIFT OPEN MODAL --- */}
            {shiftModal === 'open' && (
                <div className="fixed inset-0 z-[80] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-amber-500 px-6 py-5 text-white">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"><Clock size={20} /></div>
                                <div><p className="font-extrabold text-lg">Open New Shift</p><p className="text-amber-100 text-sm">Declare your starting cash</p></div>
                            </div>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Opening Cash in Drawer (Rs.)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">Rs.</span>
                                    <input autoFocus type="number" value={openingCash} onChange={e => setOpeningCash(e.target.value)}
                                        placeholder="e.g. 2000"
                                        className="w-full h-14 pl-12 text-2xl font-extrabold bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 focus:ring-4 ring-amber-500/10 transition-all text-slate-900 placeholder-slate-500"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setShiftModal(null)} className="flex-1 h-12 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all">Cancel</button>
                                <button onClick={openShift} disabled={shiftLoading} className="flex-[2] h-12 flex items-center justify-center gap-2 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-all active:scale-95 disabled:opacity-60">
                                    {shiftLoading ? <RefreshCw size={18} className="animate-spin" /> : <><Clock size={18} /> Open Shift</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- PAYOUT MODAL --- */}
            {payoutModal && activeShift && (
                <div className="fixed inset-0 z-[80] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-indigo-600 px-6 py-5 text-white">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"><ArrowDownRight size={20} /></div>
                                <div><p className="font-extrabold text-lg">Register Payout</p><p className="text-indigo-100 text-sm">Takes cash out of current drawer</p></div>
                            </div>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Payout Amount (Rs.)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">Rs.</span>
                                    <input autoFocus type="number" value={payoutAmount} onChange={e => setPayoutAmount(e.target.value)}
                                        placeholder="e.g. 500"
                                        className="w-full h-14 pl-12 text-xl font-extrabold bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-4 ring-indigo-500/10 transition-all text-slate-900 placeholder-slate-500"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Reason (Required)</label>
                                <input type="text" value={payoutReason} onChange={e => setPayoutReason(e.target.value)}
                                    placeholder="e.g. Cleaners, Lunch..."
                                    className="w-full h-14 px-4 text-sm font-medium bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-4 ring-indigo-500/10 transition-all text-slate-900 placeholder-slate-500"
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setPayoutModal(false)} className="flex-1 h-12 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all">Cancel</button>
                                <button onClick={registerPayout} disabled={shiftLoading} className="flex-[2] h-12 flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-60">
                                    {shiftLoading ? <RefreshCw size={18} className="animate-spin" /> : <><CheckCircle2 size={18} /> Save Payout</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- SHIFT CLOSE / Z-REPORT MODAL --- */}
            {shiftModal === 'close' && activeShift && (
                <div className="fixed inset-0 z-[80] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-slate-800 px-6 py-5 text-white">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"><ClipboardList size={20} /></div>
                                <div><p className="font-extrabold text-lg">Close Shift (Z-Report)</p><p className="text-slate-400 text-sm">Count your drawer and confirm</p></div>
                            </div>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* Z-Report Summary */}
                            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-slate-600">Shift Opened</span><span className="font-semibold text-slate-800">{new Date(activeShift.opened_at).toLocaleTimeString()}</span></div>
                                <div className="flex justify-between"><span className="text-slate-600">Cashier</span><span className="font-semibold text-slate-800">{activeShift.cashier_name}</span></div>
                                <div className="flex justify-between"><span className="text-slate-600">Opening Float</span><span className="font-semibold text-slate-800">Rs. {activeShift.opening_cash}</span></div>
                                <div className="flex justify-between border-t border-slate-200 pt-2 mt-2"><span className="text-slate-600">Gross Cash Sales</span><span className="font-bold text-slate-900">Rs. {shiftSalesTotal.toFixed(2)}</span></div>
                                <div className="flex justify-between"><span className="text-red-600 font-medium">Total Refunds</span><span className="font-bold text-red-600">- Rs. {shiftRefundsTotal.toFixed(2)}</span></div>
                                <div className="flex justify-between"><span className="text-amber-600 font-medium">Payouts (Expenses)</span><span className="font-bold text-amber-600">- Rs. {shiftPayoutsTotal.toFixed(2)}</span></div>
                                <div className="flex justify-between border-t-2 border-slate-300 pt-2 mt-2"><span className="font-bold text-slate-900 text-base">Net Cash to Count</span><span className="font-extrabold text-emerald-600 text-lg">Rs. {(activeShift.opening_cash + shiftSalesTotal - shiftRefundsTotal - shiftPayoutsTotal).toFixed(2)}</span></div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Actual Cash in Drawer (Rs.)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">Rs.</span>
                                    <input autoFocus type="number" value={closingCash} onChange={e => setClosingCash(e.target.value)}
                                        placeholder="Count drawer..."
                                        className="w-full h-14 pl-12 text-2xl font-extrabold bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-slate-700 focus:ring-4 ring-slate-500/10 transition-all text-slate-900 placeholder-slate-500"
                                    />
                                </div>
                                {closingCash && (
                                    <p className={`mt-2 text-sm font-bold text-center ${Math.abs(parseFloat(closingCash) - (activeShift.opening_cash + shiftSalesTotal - shiftRefundsTotal - shiftPayoutsTotal)) < 1
                                        ? 'text-emerald-600' : 'text-red-500'
                                        }`}>
                                        {parseFloat(closingCash) > (activeShift.opening_cash + shiftSalesTotal - shiftRefundsTotal - shiftPayoutsTotal)
                                            ? '↑ Over by Rs. ' + (parseFloat(closingCash) - (activeShift.opening_cash + shiftSalesTotal - shiftRefundsTotal - shiftPayoutsTotal)).toFixed(2)
                                            : parseFloat(closingCash) < (activeShift.opening_cash + shiftSalesTotal - shiftRefundsTotal - shiftPayoutsTotal)
                                                ? '↓ Short by Rs. ' + ((activeShift.opening_cash + shiftSalesTotal - shiftRefundsTotal - shiftPayoutsTotal) - parseFloat(closingCash)).toFixed(2)
                                                : '✓ Drawer balanced!'}
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setShiftModal(null)} className="flex-1 h-12 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all">Cancel</button>
                                <button onClick={closeShift} disabled={shiftLoading} className="flex-[2] h-12 flex items-center justify-center gap-2 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-all active:scale-95 disabled:opacity-60">
                                    {shiftLoading ? <RefreshCw size={18} className="animate-spin" /> : <><ClipboardList size={18} /> Close Shift</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- THERMAL RECEIPT MODAL --- */}
            {receiptMode && (
                <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center overflow-y-auto py-10 print:py-0 print:p-0">
                    <div className="w-[300px] bg-white p-6 shadow-xl border border-gray-100 print:shadow-none print:border-none">
                        <div className="flex justify-center mb-6">
                            <button
                                onClick={() => setReceiptMode(null)}
                                className="print:hidden h-10 px-4 bg-slate-900 text-white rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-800 transition-all"
                            >
                                <Plus size={16} /> New Sale
                            </button>
                        </div>

                        <div id="receipt-content" className="text-black font-mono text-[12px] leading-tight">
                            <div className="text-center mb-4 uppercase">
                                <h2 className="font-bold text-sm mb-1">PARTY FAVOUR</h2>
                                <p>{receiptSettings.address1}</p>
                                <p>{receiptSettings.address2}</p>
                                <p>Tel: {receiptSettings.phone}</p>
                            </div>
                            <div className="border-b border-black border-dashed my-2"></div>
                            <div className="mb-2 uppercase text-[10px]">
                                <div className="flex justify-between"><span>Receipt:</span><span className="font-bold">{receiptMode.receiptId}</span></div>
                                <div className="flex justify-between"><span>Date:</span><span>{new Date(receiptMode.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span></div>
                                {selectedCustomer && (
                                    <div className="flex justify-between"><span>Customer:</span><span>{selectedCustomer.name}</span></div>
                                )}
                            </div>
                            <div className="border-b border-black border-dashed my-2"></div>
                            <div className="uppercase font-bold text-[10px] mb-1 flex justify-between">
                                <span className="w-1/2">Item</span>
                                <span className="w-1/6 text-center">Qty</span>
                                <span className="w-1/3 text-right">Total</span>
                            </div>
                            <div className="space-y-1">
                                {receiptMode.cart.map((item: any, i: number) => (
                                    <div key={i} className="flex justify-between text-[11px]">
                                        <span className="w-1/2 overflow-hidden whitespace-nowrap overflow-ellipsis">{item.name}</span>
                                        <span className="w-1/6 text-center">{Math.abs(item.cartQty)}</span>
                                        <span className="w-1/3 text-right">Rs. {(item.selling_price * Math.abs(item.cartQty)).toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="border-b border-black border-dashed my-3"></div>
                            <div className="space-y-1 uppercase text-[11px]">
                                {receiptMode.discountAmount > 0 && (
                                    <div className="flex justify-between"><span>Discount:</span><span>- {receiptMode.discountAmount.toFixed(2)}</span></div>
                                )}
                                {receiptMode.taxAmount > 0 && (
                                    <div className="flex justify-between"><span>Tax:</span><span>+ {receiptMode.taxAmount.toFixed(2)}</span></div>
                                )}
                            </div>
                            <div className="flex justify-between items-center font-extrabold text-sm mb-2 mt-3 p-1 border border-black/20">
                                <span>TOTAL AMOUNT:</span><span>Rs. {Math.abs(receiptMode.total).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-[11px] mb-1">
                                <span>Paid Via:</span><span className="font-bold">{receiptMode.paymentMethod}</span>
                            </div>
                            {receiptMode.paymentMethod === 'CASH' && !receiptMode.isRefund && (
                                <>
                                    <div className="flex justify-between text-[11px] mb-1"><span>Tendered:</span><span>Rs. {receiptMode.tendered.toFixed(2)}</span></div>
                                    <div className="flex justify-between text-[11px] font-bold"><span>Change Given:</span><span>Rs. {receiptMode.change.toFixed(2)}</span></div>
                                </>
                            )}
                            <div className="text-center mt-8 mb-4 text-[10px] uppercase font-bold tracking-wider">
                                <p>{receiptMode.isRefund ? '*** Refreshed & Returned ***' : '*** Thank You ***'}</p>
                                <p className="mt-1">For Shopping With Us!</p>
                            </div>
                            <div className="text-center mt-6 text-[8px] text-gray-400">Powered by Mr² Labs</div>
                        </div>

                        <div className="flex gap-2 mt-8 print:hidden">
                            <button onClick={() => window.print()} className="flex-1 h-12 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all border border-slate-700">
                                <Printer size={18} /> Print
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- TOAST NOTIFICATIONS OVERLAY --- */}
            <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[9999] flex flex-col gap-3 pointer-events-none print:hidden">
                {toasts.map((toast: any) => (
                    <div key={toast.id} className="pointer-events-auto w-full sm:w-[350px] bg-white border-l-4 border-amber-500 rounded-xl shadow-2xl p-4 flex gap-3 animate-in slide-in-from-right-8 fade-in duration-300">
                        <AlertTriangle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <h4 className="text-sm font-bold text-slate-900 mb-0.5">Low Stock Warning</h4>
                            <p className="text-sm text-slate-600 leading-snug">{toast.message}</p>
                        </div>
                        <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} className="flex-shrink-0 text-slate-400 hover:text-slate-600 rounded-md p-1 -mt-1 -mr-1 transition-colors self-start">
                            <X size={16} />
                        </button>
                    </div>
                ))}
            </div>
        </>
    );
}