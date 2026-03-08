import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Force .env.local loading
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSales() {
    const { data, error } = await supabase
        .from('sales')
        .select('receipt_id, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error fetching sales:', error);
    } else {
        console.log('Recent Receipt IDs:');
        data?.forEach(s => console.log(`- ${s.receipt_id} (${s.created_at})`));
    }
}

checkSales();
