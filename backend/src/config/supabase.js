import { createClient } from '@supabase/supabase-js';

import env from './env.js';

const supabase = createClient(
    env.supabase.url,
    env.supabase.secretKey,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
);

export default supabase;