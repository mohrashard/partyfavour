import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/app/lib/supabase-admin';
import { createBrowserClient } from '@supabase/ssr';

export async function POST(req: NextRequest) {
    try {
        // Verify the requesting user is an admin
        const anonClient = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const authHeader = req.headers.get('authorization');
        if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const token = authHeader.replace('Bearer ', '');
        const { data: { user: requester } } = await anonClient.auth.getUser(token);
        if (!requester) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Check requester is admin in profiles table
        const adminClient = createAdminClient();
        const { data: profile } = await adminClient
            .from('profiles')
            .select('role')
            .eq('id', requester.id)
            .single();

        if (profile?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 });
        }

        const body = await req.json();
        const { email, password, name } = body;

        if (!email || !password || !name) {
            return NextResponse.json({ error: 'email, password, and name are required' }, { status: 400 });
        }

        // Create the auth user
        const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
        });

        if (createError || !newUser.user) {
            return NextResponse.json({ error: createError?.message ?? 'Failed to create user' }, { status: 400 });
        }

        // Insert into profiles as cashier
        await adminClient.from('profiles').insert({
            id: newUser.user.id,
            name,
            email,
            role: 'cashier',
        });

        return NextResponse.json({ success: true, userId: newUser.user.id });
    } catch (err: any) {
        console.error('create-user error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const anonClient = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const authHeader = req.headers.get('authorization');
        if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const token = authHeader.replace('Bearer ', '');
        const { data: { user: requester } } = await anonClient.auth.getUser(token);
        if (!requester) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const adminClient = createAdminClient();
        const { data: profile } = await adminClient
            .from('profiles')
            .select('role')
            .eq('id', requester.id)
            .single();

        if (profile?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 });
        }

        const { userId } = await req.json();
        if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

        // Prevent deleting yourself
        if (userId === requester.id) {
            return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
        }

        // Delete from auth (profiles cascade deletes)
        const { error } = await adminClient.auth.admin.deleteUser(userId);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
