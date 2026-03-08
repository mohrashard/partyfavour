import { createClient } from '@supabase/supabase-js';

// Server-only Supabase client with service role (bypasses RLS)
// ONLY used in API routes, never exposed to browser
export function createAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}
