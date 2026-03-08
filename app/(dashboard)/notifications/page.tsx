"use client";

import { useEffect, useState } from 'react';
import { Bell, AlertTriangle, Calendar, Info, CheckCircle2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<any[]>([]);

    useEffect(() => {
        fetchNotifications();

        // Listen for new notifications in real-time
        const channelName = `notifications_page_${Math.random().toString(36).substring(7)}`;
        const channel = supabase
            .channel(channelName)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, (payload) => {
                console.log("Realtime change detected in NotificationsPage:", payload);
                if (payload.eventType === 'INSERT') {
                    setNotifications(prev => [payload.new, ...prev]);
                } else {
                    fetchNotifications();
                }
            })
            .subscribe((status) => {
                console.log(`NotificationsPage realtime status: ${status}`);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    async function fetchNotifications() {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && data) {
            setNotifications(data);
        }
    }

    async function clearNotifications() {
        if (!confirm("Are you sure you want to clear all notifications?")) return;

        const { error } = await supabase.from('notifications').delete().neq('id', 0); // Hack to delete all
        if (!error) {
            setNotifications([]);
        } else {
            alert('Failed to clear notifications');
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8 font-sans text-slate-900">
            <div className="max-w-4xl mx-auto">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-200 shadow-sm relative">
                            <Bell size={20} />
                            {notifications.length > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                </span>
                            )}
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-slate-900">System Notifications</h1>
                            <p className="text-sm text-slate-500 mt-0.5">Alerts, low stock warnings, and important events.</p>
                        </div>
                    </div>

                    {notifications.length > 0 && (
                        <button
                            onClick={clearNotifications}
                            className="h-10 px-4 flex items-center gap-2 text-sm font-semibold rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-all shadow-sm"
                        >
                            <Trash2 size={16} /> Clear All
                        </button>
                    )}
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                    {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 px-6 text-center text-slate-400">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                                <CheckCircle2 size={32} className="text-emerald-400" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-700 mb-1">You're all caught up!</h3>
                            <p className="text-sm">There are no new notifications or low stock alerts right now.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {notifications.map((notif, idx) => (
                                <div key={idx} className="p-5 sm:p-6 hover:bg-slate-50/50 transition-colors flex gap-4">
                                    <div className="flex-shrink-0 mt-0.5">
                                        {notif.type === 'warning' ? (
                                            <div className="w-10 h-10 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center border border-amber-100 placeholder-slate-400">
                                                <AlertTriangle size={20} />
                                            </div>
                                        ) : (
                                            <div className="w-10 h-10 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center border border-slate-200">
                                                <Info size={20} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                                            <h4 className="text-sm font-bold text-slate-900">{notif.title || 'System Alert'}</h4>
                                            <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                                                <Calendar size={12} /> {format(new Date(notif.created_at), 'PP p')}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-600 leading-relaxed">{notif.message}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
