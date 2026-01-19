import { createClient } from '@supabase/supabase-js';

let _supabaseAdmin: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdmin() {
    if (!_supabaseAdmin) {
        const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Supabase URL and Service Role Key are required for server-side operations');
        }
        _supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    }
    return _supabaseAdmin;
}
