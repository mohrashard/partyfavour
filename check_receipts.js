const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) env[key.trim()] = value.trim();
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
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
        data?.forEach(s => console.log(`- "${s.receipt_id}" (${s.created_at})`));
    }
}

checkSales();
