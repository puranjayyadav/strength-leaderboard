import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('Supabase URL and Service Role Key are required for server-side authentication');
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
