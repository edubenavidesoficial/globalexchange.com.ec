import { createClient } from '@supabase/supabase-js';

let client;

// Inicialización diferida: las páginas públicas no necesitan configuración Auth.
export function getSupabaseClient() {
    if (client) return client;

    const url = import.meta.env.VITE_SUPABASE_URL?.trim();
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

    if (!url || !key) {
        throw new Error('AUTH_CONFIGURATION');
    }

    try {
        const parsed = new URL(url);
        if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error();
        client = createClient(url, key, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: false,
            },
        });
    } catch {
        throw new Error('AUTH_CONFIGURATION');
    }

    return client;
}
