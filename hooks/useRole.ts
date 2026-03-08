"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../app/lib/supabase';

export type UserRole = 'admin' | 'cashier' | null;

export interface UserProfile {
    id: string;
    name: string | null;
    role: UserRole;
    email: string | null;
}

let cachedProfile: UserProfile | null = null;

export function useRole() {
    const [profile, setProfile] = useState<UserProfile | null>(cachedProfile);
    const [loading, setLoading] = useState(!cachedProfile);

    useEffect(() => {
        if (cachedProfile) { setProfile(cachedProfile); setLoading(false); return; }
        loadProfile();
    }, []);

    async function loadProfile() {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }

        const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        const p: UserProfile = {
            id: user.id,
            name: data?.name ?? user.email?.split('@')[0] ?? 'User',
            role: data?.role ?? 'cashier',
            email: user.email ?? null,
        };
        cachedProfile = p;
        setProfile(p);
        setLoading(false);
    }

    return { profile, loading, isAdmin: profile?.role === 'admin', isCashier: profile?.role === 'cashier' };
}

// Call when logging out to clear the cache
export function clearRoleCache() { cachedProfile = null; }
