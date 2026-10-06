import { createClient, NavigatorLockAcquireTimeoutError } from '@supabase/supabase-js';

let client;

// Dos niveles, siempre en este orden: aplicación -> almacenamiento SDK.
// El SDK no bloquea signInWithPassword; sí bloquea refresh, recuperación y logout.
function locks() {
    if (!globalThis.navigator?.locks?.request) throw new Error('AUTH_COORDINATION');
    return globalThis.navigator.locks;
}

export function withAuthMutation(action) {
    return locks().request('globalexchange.com.ec:crm:auth-mutations', {
        mode: 'exclusive', signal: AbortSignal.timeout(15000),
    }, action);
}

export function withAuthStorageLock(action, timeout = -1) {
    const options = { mode: 'exclusive' };
    if (timeout === 0) options.ifAvailable = true;
    else if (timeout > 0) options.signal = AbortSignal.timeout(timeout);
    return locks().request('globalexchange.com.ec:crm:auth-storage', options, (lock) => {
        if (!lock) throw new NavigatorLockAcquireTimeoutError('Auth storage busy');
        return action();
    });
}

// Inicialización diferida: las páginas públicas no necesitan configuración Auth.
export function getSupabaseClient() {
    // Sin coordinación entre pestañas no iniciar operaciones ni recuperación SDK.
    locks();
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
                lock: (_name, timeout, action) => withAuthStorageLock(action, timeout),
            },
        });
    } catch {
        throw new Error('AUTH_CONFIGURATION');
    }

    return client;
}
