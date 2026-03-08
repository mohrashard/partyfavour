"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Save, Settings, Printer, MapPin, Phone, Building2, CheckCircle, RefreshCw, AlertTriangle } from 'lucide-react';

const SETTINGS_ROW_ID = 'store';

export default function SettingsPage() {
    const [settings, setSettings] = useState({
        address1: '123 Party Lane',
        address2: 'Celebration City',
        phone: '(555) 019-2831',
    });
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadSettings();
    }, []);

    async function loadSettings() {
        setLoading(true);
        setError(null);

        // 1. Try Supabase first (source of truth)
        const { data, error: dbError } = await supabase
            .from('settings')
            .select('address1, address2, phone')
            .eq('id', SETTINGS_ROW_ID)
            .single();

        if (!dbError && data) {
            const loaded = {
                address1: data.address1 ?? '',
                address2: data.address2 ?? '',
                phone: data.phone ?? '',
            };
            setSettings(loaded);
            // Keep localStorage in sync as a cache
            localStorage.setItem('pos_receipt_settings', JSON.stringify(loaded));
        } else {
            // 2. Fallback: localStorage cache if Supabase unreachable
            const cached = localStorage.getItem('pos_receipt_settings');
            if (cached) {
                try {
                    setSettings(JSON.parse(cached));
                } catch (_) { }
            }
            if (dbError) {
                setError('Could not load settings from database. Showing cached values.');
            }
        }

        setLoading(false);
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        setIsSaving(true);
        setError(null);

        const { error: dbError } = await supabase
            .from('settings')
            .upsert(
                { id: SETTINGS_ROW_ID, ...settings, updated_at: new Date().toISOString() },
                { onConflict: 'id' }
            );

        if (dbError) {
            setError(`Failed to save: ${dbError.message}`);
        } else {
            // Mirror to localStorage so POS/Sales pages load instantly offline
            localStorage.setItem('pos_receipt_settings', JSON.stringify(settings));
            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 3000);
        }

        setIsSaving(false);
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans">
                <RefreshCw size={40} className="animate-spin text-indigo-500 mb-4 opacity-50" />
                <p className="text-slate-500 font-medium">Loading Settings...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8 font-sans text-slate-900">
            <div className="max-w-3xl mx-auto">

                {/* Header */}
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-200 shadow-sm">
                        <Settings size={20} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">System Settings</h1>
                        <p className="text-sm text-slate-500 mt-0.5">
                            Customize your receipt details — saved to the cloud across all devices.
                        </p>
                    </div>
                </div>

                {/* Error banner */}
                {error && (
                    <div className="mb-6 flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-sm font-medium">
                        <AlertTriangle size={18} className="flex-shrink-0 mt-0.5 text-amber-500" />
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                    {/* Settings Form */}
                    <div className="md:col-span-2">
                        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                            <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                                <Printer size={18} className="text-slate-500" />
                                <h2 className="text-base font-bold text-slate-900">Receipt Details</h2>
                            </div>

                            <div className="p-5 sm:p-6 space-y-6">
                                {/* Disabled Business Name */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
                                        <Building2 size={16} /> Business Name
                                    </label>
                                    <input
                                        type="text"
                                        disabled
                                        value="Party Favour"
                                        className="w-full h-11 px-4 bg-slate-100 border border-slate-200 rounded-xl text-sm font-semibold text-slate-500 cursor-not-allowed select-none"
                                    />
                                    <p className="text-xs text-slate-400 mt-1.5">* Registered business name cannot be changed.</p>
                                </div>

                                {/* Address Line 1 */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
                                        <MapPin size={16} /> Address Line 1
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={settings.address1}
                                        onChange={e => setSettings({ ...settings, address1: e.target.value })}
                                        placeholder="e.g. 123 Party Lane"
                                        className="w-full h-11 px-4 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-900 placeholder-slate-500"
                                    />
                                </div>

                                {/* Address Line 2 */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
                                        <MapPin size={16} /> Address Line 2
                                    </label>
                                    <input
                                        type="text"
                                        value={settings.address2}
                                        onChange={e => setSettings({ ...settings, address2: e.target.value })}
                                        placeholder="e.g. Celebration City"
                                        className="w-full h-11 px-4 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-900 placeholder-slate-500"
                                    />
                                </div>

                                {/* Phone Number */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
                                        <Phone size={16} /> Phone Number
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={settings.phone}
                                        onChange={e => setSettings({ ...settings, phone: e.target.value })}
                                        placeholder="e.g. 011 234 5678"
                                        className="w-full h-11 px-4 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-900 placeholder-slate-500"
                                    />
                                </div>
                            </div>

                            <div className="p-5 sm:p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                                {isSaved ? (
                                    <span className="text-emerald-600 font-semibold text-sm flex items-center gap-1.5 animate-in fade-in duration-300">
                                        <CheckCircle size={16} /> Saved to cloud ✓
                                    </span>
                                ) : (
                                    <span className="text-xs text-slate-400">Changes are synced across all devices.</span>
                                )}

                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="h-11 px-6 flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-[0_4px_10px_rgb(79,70,229,0.2)] active:scale-95 disabled:opacity-70 disabled:active:scale-100"
                                >
                                    {isSaving
                                        ? <><RefreshCw size={16} className="animate-spin" /> Saving...</>
                                        : <><Save size={18} /> Save Settings</>}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Receipt Live Preview */}
                    <div className="md:col-span-1">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 px-1">Live Preview</h3>
                        <div className="bg-white p-4 shadow-xl border border-slate-200 mx-auto w-full max-w-[80mm] print:shadow-none min-h-[300px] flex flex-col items-center">
                            <div className="text-center mb-6 w-full font-mono text-black">
                                <h1 className="text-[16px] font-bold uppercase tracking-widest mb-1">Party Favour</h1>
                                <p className="text-[10px] leading-snug">{settings.address1 || 'Address Line 1'}</p>
                                {settings.address2 && <p className="text-[10px] leading-snug">{settings.address2}</p>}
                                <p className="text-[10px] leading-snug">Tel: {settings.phone || 'Phone Number'}</p>
                                <div className="border-b border-dashed border-black/40 my-3 w-full" />
                                <p className="text-[10px] text-gray-500 mt-4 mb-2 opacity-50 italic">List of Items...</p>
                                <p className="text-[10px] text-gray-500 opacity-50 italic">Total Amount...</p>
                                <div className="border-b border-dashed border-black/40 my-3 w-full" />
                                <div className="text-center mt-6 text-[8px] text-gray-400 font-sans">
                                    Powered by Mr² Labs
                                </div>
                            </div>
                        </div>
                        <p className="text-xs text-slate-400 text-center mt-4">80mm Thermal Receipt Format</p>
                    </div>

                </div>
            </div>
        </div>
    );
}
