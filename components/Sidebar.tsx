"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '../app/lib/supabase';
import { useRole, clearRoleCache } from '@/hooks/useRole';
import {
    Home, LayoutDashboard, Calculator, Package, Menu, X,
    PartyPopper, Settings, Bell, LogOut, Receipt, Users, Shield
} from 'lucide-react';

export default function Sidebar() {
    const [isOpen, setIsOpen] = useState(false);
    const [hasUnread, setHasUnread] = useState(false);
    const pathname = usePathname();
    const router = useRouter();
    const { profile, isAdmin } = useRole();

    const handleLogout = async () => {
        clearRoleCache();
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
    };

    useEffect(() => {
        let timeoutId: NodeJS.Timeout;
        const handleDbChange = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => checkNotifications(), 300);
        };
        checkNotifications();
        const channelName = 'sidebar_badge_' + Math.random().toString(36).substring(7);
        const channel = supabase.channel(channelName);
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, handleDbChange).subscribe();
        return () => { clearTimeout(timeoutId); supabase.removeChannel(channel); };
    }, []);

    async function checkNotifications() {
        const { count, error } = await supabase.from('notifications').select('*', { count: 'exact', head: true });
        setHasUnread(!error && (count ?? 0) > 0);
    }

    const isActive = (href: string) => href === '/' ? pathname === '/' : pathname.startsWith(href);

    // Build nav items based on role
    const navItems = [
        { name: 'Home', href: '/', icon: Home, adminOnly: false },
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, adminOnly: true },
        { name: 'POS Register', href: '/pos', icon: Calculator, adminOnly: false },
        { name: 'Inventory', href: '/inventory', icon: Package, adminOnly: false },
        { name: 'Sales History', href: '/sales', icon: Receipt, adminOnly: false },
        { name: 'Notifications', href: '/notifications', icon: Bell, adminOnly: false },
        { name: 'Staff', href: '/staff', icon: Users, adminOnly: true },
        { name: 'Settings', href: '/settings', icon: Settings, adminOnly: true },
    ].filter(item => !item.adminOnly || isAdmin);

    return (
        <>
            {/* Mobile Menu Button */}
            <button
                onClick={() => setIsOpen(true)}
                className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-white border border-slate-200 text-slate-600 shadow-sm"
            >
                <Menu size={20} />
            </button>

            {/* Mobile Backdrop */}
            {isOpen && (
                <div className="md:hidden fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed top-0 left-0 bottom-0 z-50 w-64 bg-white border-r border-slate-200 
                transform transition-transform duration-300 ease-in-out flex flex-col
                ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
                md:translate-x-0 print:hidden
            `}>
                {/* Header */}
                <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100">
                    <Link href="/" className="flex items-center gap-2 group" onClick={() => setIsOpen(false)}>
                        <div className="flex items-center justify-center translate-y-[-1px]">
                            <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
                        </div>
                        <span className="font-bold text-slate-900 tracking-tight">Party Favour</span>
                    </Link>
                    <button onClick={() => setIsOpen(false)} className="md:hidden p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                        <X size={18} />
                    </button>
                </div>

                {/* Role Badge */}
                {profile && (
                    <div className={`mx-4 mt-4 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border ${isAdmin ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                        {isAdmin ? <Shield size={13} /> : <Users size={13} />}
                        <span className="truncate">{profile.name}</span>
                        <span className={`ml-auto px-1.5 py-0.5 rounded-full text-[9px] font-extrabold tracking-wider uppercase ${isAdmin ? 'bg-violet-200 text-violet-800' : 'bg-emerald-200 text-emerald-800'}`}>
                            {isAdmin ? 'Admin' : 'Cashier'}
                        </span>
                    </div>
                )}

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-4 px-4 space-y-1 mt-2">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.href);
                        const isNotifications = item.name === 'Notifications';
                        const isStaff = item.name === 'Staff';

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setIsOpen(false)}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-md font-medium text-sm transition-all ${active
                                    ? isStaff ? 'bg-violet-50 text-violet-700' : 'bg-indigo-50 text-indigo-700'
                                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                    }`}
                            >
                                <div className="relative">
                                    <Icon size={18} className={active ? (isStaff ? 'text-violet-600' : 'text-indigo-600') : 'text-slate-400'} />
                                    {isNotifications && hasUnread && (
                                        <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                        </span>
                                    )}
                                </div>
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md font-medium text-sm text-red-500 hover:bg-red-50 transition-all cursor-pointer"
                    >
                        <LogOut size={18} />
                        Log out
                    </button>
                </div>
            </aside>
        </>
    );
}
