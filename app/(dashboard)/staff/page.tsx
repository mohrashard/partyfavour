"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRole } from '@/hooks/useRole';
import { useRouter } from 'next/navigation';
import {
    Users, Plus, Trash2, RefreshCw, Shield, User,
    Eye, EyeOff, ArrowLeft, Mail, Lock, UserCheck, AlertTriangle
} from 'lucide-react';
import Link from 'next/link';

interface StaffMember {
    id: string;
    name: string;
    role: string;
    email: string;
    created_at: string;
}

export default function StaffPage() {
    const { profile, isAdmin, loading: roleLoading } = useRole();
    const router = useRouter();

    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    const [form, setForm] = useState({ name: '', email: '', password: '' });
    const [formError, setFormError] = useState('');

    useEffect(() => {
        if (!roleLoading && !isAdmin) {
            router.replace('/dashboard');
        }
    }, [roleLoading, isAdmin]);

    useEffect(() => {
        if (isAdmin) fetchStaff();
    }, [isAdmin]);

    async function fetchStaff() {
        setLoading(true);
        // Fetch all profiles + join with auth.users email via a DB view or just use profiles table
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: true });

        if (!error && data) {
            setStaff(data as StaffMember[]);
        }
        setLoading(false);
    }

    async function handleAddEmployee(e: React.FormEvent) {
        e.preventDefault();
        setFormError('');

        if (form.password.length < 8) {
            setFormError('Password must be at least 8 characters.');
            return;
        }

        setIsSubmitting(true);

        // Get current session token to authenticate the API call
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setFormError('Not authenticated'); setIsSubmitting(false); return; }

        const res = await fetch('/api/create-user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + session.access_token
            },
            body: JSON.stringify({ name: form.name, email: form.email, password: form.password })
        });

        const json = await res.json();
        if (!res.ok) {
            setFormError(json.error ?? 'Failed to create employee');
        } else {
            setForm({ name: '', email: '', password: '' });
            setShowForm(false);
            fetchStaff();
        }
        setIsSubmitting(false);
    }

    async function handleDelete(member: StaffMember) {
        if (member.id === profile?.id) {
            alert("You can't delete your own account.");
            return;
        }
        if (!confirm('Remove "' + member.name + '" from staff? They will lose access immediately.')) return;

        setDeletingId(member.id);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setDeletingId(null); return; }

        const res = await fetch('/api/create-user', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + session.access_token
            },
            body: JSON.stringify({ userId: member.id })
        });

        const json = await res.json();
        if (!res.ok) alert(json.error ?? 'Failed to delete employee');
        else fetchStaff();
        setDeletingId(null);
    }

    if (roleLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <RefreshCw size={28} className="animate-spin text-indigo-500" />
            </div>
        );
    }

    if (!isAdmin) return null;

    return (
        <div className="min-h-[100dvh] bg-slate-50 font-sans text-slate-900 pb-20 sm:pb-0">
            {/* Navbar */}
            <nav className="sticky top-0 z-40 bg-white border-b border-slate-200/60 backdrop-blur-xl">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2 sm:gap-4">
                        <Link href="/dashboard" className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-600 transition-colors">
                            <ArrowLeft size={18} className="sm:w-5 sm:h-5" />
                        </Link>
                        <div className="flex items-center gap-2 sm:gap-3">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-violet-50 flex items-center justify-center text-violet-600 border border-violet-100">
                                <Users size={16} className="sm:w-4 sm:h-4" />
                            </div>
                            <span className="font-bold text-base sm:text-lg text-slate-900">Staff Management</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                        <span className="hidden sm:flex items-center gap-1.5 text-[10px] sm:text-xs font-semibold text-violet-600 bg-violet-50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full border border-violet-100">
                            <Shield size={12} /> Admin View
                        </span>
                        <button
                            onClick={() => { setShowForm(true); setFormError(''); }}
                            className="h-9 px-3 sm:px-4 flex items-center gap-1.5 sm:gap-2 bg-violet-600 text-white rounded-lg text-xs sm:text-sm font-bold hover:bg-violet-700 shadow-[0_2px_10px_rgba(124,58,237,0.3)] transition-all active:scale-95"
                        >
                            <Plus size={16} /> <span className="hidden xs:inline">Add</span><span className="hidden md:inline"> Employee</span>
                        </button>
                    </div>
                </div>
            </nav>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4 sm:space-y-6">

                {/* Info Banner */}
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
                    <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                        <p className="font-bold text-amber-800 mb-1">Employee Permissions (Cashier Role)</p>
                        <p className="text-amber-700">Cashiers can: ring sales, view products & stock levels, see their own shift summary.</p>
                        <p className="text-amber-700 mt-0.5">Cashiers <strong>cannot</strong>: see cost prices or profit margins, delete inventory items, access this Staff page, or view the Settings page.</p>
                    </div>
                </div>

                {/* Staff List */}
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                    <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex items-center justify-between">
                        <h2 className="font-bold text-slate-900 flex items-center gap-2 text-sm sm:text-base">
                            <UserCheck size={18} className="text-violet-500 sm:w-5 sm:h-5" />
                            All Staff
                            <span className="bg-slate-100 text-slate-600 py-0.5 px-2 rounded-full text-[10px] sm:text-xs font-semibold">{staff.length}</span>
                        </h2>
                        <button onClick={fetchStaff} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                            <RefreshCw size={15} />
                        </button>
                    </div>

                    {loading ? (
                        <div className="py-16 flex items-center justify-center text-slate-400 gap-3">
                            <RefreshCw size={22} className="animate-spin opacity-50" />
                            <p>Loading staff...</p>
                        </div>
                    ) : staff.length === 0 ? (
                        <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
                            <Users size={36} className="opacity-20" />
                            <p className="font-medium text-slate-500">No staff added yet.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {staff.map(member => {
                                const isSelf = member.id === profile?.id;
                                const isAdminMember = member.role === 'admin';
                                return (
                                    <div key={member.id} className="px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between group">
                                        <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 pr-2">
                                            <div className={`flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-sm ${isAdminMember ? 'bg-violet-100 text-violet-700 border-2 border-violet-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                                                {(member.name ?? 'U').charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="font-semibold text-slate-900 text-xs sm:text-sm truncate">{member.name ?? '—'}</p>
                                                    {isSelf && <span className="text-[9px] sm:text-[10px] font-bold bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full border border-indigo-100">YOU</span>}
                                                </div>
                                                <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate">{member.email ?? 'No email'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                                            <span className={`text-[10px] flex sm:hidden font-bold px-2.5 py-1 rounded-full border ${isAdminMember ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                                                {isAdminMember ? '👑' : '🧾'}
                                            </span>
                                            <span className={`text-[11px] hidden sm:flex font-bold px-2.5 py-1 rounded-full border ${isAdminMember ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                                                {isAdminMember ? '👑 Admin' : '🧾 Cashier'}
                                            </span>
                                            {!isSelf && !isAdminMember && (
                                                <button
                                                    onClick={() => handleDelete(member)}
                                                    disabled={deletingId === member.id}
                                                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                    title="Remove employee"
                                                >
                                                    {deletingId === member.id ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={16} className="sm:w-[14px] sm:h-[14px]" />}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>

            {/* Add Employee Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
                        <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-slate-100 bg-slate-50">
                            <h3 className="text-base sm:text-lg font-extrabold text-slate-900">Add New Employee</h3>
                            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">They will be assigned the Cashier role and can log in immediately.</p>
                        </div>

                        <form onSubmit={handleAddEmployee} className="p-5 sm:p-6 space-y-4">
                            <div>
                                <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                                    <User size={13} className="text-slate-400" /> Full Name
                                </label>
                                <input
                                    required
                                    type="text"
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    placeholder="e.g. Raju Kumar"
                                    className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all text-slate-900 placeholder-slate-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                                    <Mail size={13} className="text-slate-400" /> Email Address
                                </label>
                                <input
                                    required
                                    type="email"
                                    value={form.email}
                                    onChange={e => setForm({ ...form, email: e.target.value })}
                                    placeholder="employee@example.com"
                                    className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all text-slate-900 placeholder-slate-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                                    <Lock size={13} className="text-slate-400" /> Password
                                </label>
                                <div className="relative">
                                    <input
                                        required
                                        type={showPassword ? 'text' : 'password'}
                                        value={form.password}
                                        onChange={e => setForm({ ...form, password: e.target.value })}
                                        placeholder="min. 8 characters"
                                        className="w-full h-11 px-4 pr-12 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all text-slate-900 placeholder-slate-500"
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1">
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            {formError && (
                                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 font-medium">
                                    {formError}
                                </div>
                            )}

                            <div className="flex gap-2 sm:gap-3 pt-2 pb-safe">
                                <button type="button" onClick={() => setShowForm(false)} className="flex-1 h-12 bg-slate-100 text-slate-700 rounded-xl text-sm sm:text-base font-bold hover:bg-slate-200 transition-all active:scale-95">
                                    Cancel
                                </button>
                                <button type="submit" disabled={isSubmitting} className="flex-[2] h-12 flex items-center justify-center gap-2 bg-violet-600 text-white rounded-xl text-sm sm:text-base font-bold hover:bg-violet-700 shadow-[0_4px_14px_rgba(124,58,237,0.3)] transition-all active:scale-95 disabled:opacity-60">
                                    {isSubmitting ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
                                    {isSubmitting ? 'Creating...' : 'Create Employee'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
