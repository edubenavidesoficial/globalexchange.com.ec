import { getSupabaseClient, withAuthMutation, withAuthStorageLock } from '../../config/supabase.js';

export class AuthError extends Error {
    constructor(code) {
        super(code);
        this.code = code;
    }
}

function authClient() {
    try {
        return getSupabaseClient().auth;
    } catch (error) {
        throw new AuthError(error.message === 'AUTH_COORDINATION' ? 'unavailable' : 'configuration');
    }
}

function providerError(error, fallback) {
    if (error?.name === 'AuthRetryableFetchError' || error instanceof TypeError) {
        return new AuthError('network');
    }
    if (error?.status >= 500 || error?.status === 429) {
        return new AuthError('unavailable');
    }
    return new AuthError(fallback);
}

async function sdkCall(operation, fallback) {
    let result;
    try {
        result = await operation();
    } catch (error) {
        if (error instanceof AuthError) throw error;
        throw providerError(error, fallback);
    }
    if (result.error) throw providerError(result.error, fallback);
    return result.data;
}

async function coordinate(action) {
    try {
        return await withAuthMutation(action);
    } catch (error) {
        if (error instanceof AuthError) throw error;
        throw new AuthError('unavailable');
    }
}

export async function signIn(email, password) {
    return coordinate(async () => {
        const auth = authClient();
        // Inicializar antes de tomar el lock que también utiliza la inicialización.
        await auth.initialize();
        const data = await withAuthStorageLock(() => sdkCall(
            () => auth.signInWithPassword({ email, password }), 'credentials',
        ));
        if (!data?.session?.access_token) throw new AuthError('unavailable');
        return data.session;
    });
}

async function readSession() {
    const data = await sdkCall(() => authClient().getSession(), 'expired');
    return data?.session ?? null;
}

export function getSession() {
    // getSession puede refrescar tokens: participa también en la coordinación.
    return coordinate(readSession);
}

function assertCurrent(operation) {
    if (!operation.isCurrent()) throw new AuthError('stale');
}

async function confirmSession(operation, coordinated = false) {
    assertCurrent(operation);
    const current = await (coordinated ? readSession() : getSession());
    assertCurrent(operation);
    if (current?.access_token !== operation.session?.access_token ||
        current?.user?.id !== operation.session?.user?.id) {
        throw new AuthError('stale');
    }
}

export async function signOut(operation) {
    return coordinate(() => closeSession(operation));
}

async function closeSession(operation) {
    // Revalidar DESPUÉS de esperar turno. Nunca cerrar una cuenta nueva en cola.
    await confirmSession(operation, true);
    assertCurrent(operation);
    try {
        await sdkCall(() => authClient().signOut({ scope: 'local' }), 'logout');
    } catch {
        // Un fallo remoto no implica que el SDK conserve la sesión local.
        let remaining;
        try {
            remaining = await readSession();
        } catch {
            throw new AuthError('logoutUnknown');
        }
        if (!remaining) return;
        assertCurrent(operation);
        if (remaining.access_token !== operation.session?.access_token ||
            remaining.user?.id !== operation.session?.user?.id) {
            throw new AuthError('stale');
        }
        throw new AuthError('logout');
    }
}

async function requestInternalUser(token, signal) {
    let response;
    try {
        response = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
            signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
        });
    } catch {
        throw new AuthError('network');
    }

    if (response.status === 401) throw new AuthError('expired');
    if (response.status === 403) throw new AuthError('denied');
    if (!response.ok) throw new AuthError('unavailable');

    const body = await response.json().catch(() => null);
    const user = body?.data;
    if (!user || typeof user.id !== 'string' || !user.id ||
        typeof user.fullName !== 'string' || !user.fullName.trim() ||
        !['admin', 'agendadora', 'vendedora'].includes(user.role)) {
        throw new AuthError('unavailable');
    }

    // Solo los datos necesarios para el estado temporal de la Fase 1.
    return { fullName: user.fullName, role: user.role };
}

export async function validateInternalUser(operation) {
    // Dos GET como máximo; las decisiones de cierre pertenecen al orquestador.
    for (let attempt = 0; attempt < 2; attempt += 1) {
        assertCurrent(operation);
        if (!operation.session?.access_token) throw new AuthError('expired');
        let user;
        let failure;
        try {
            user = await requestInternalUser(operation.session.access_token, operation.signal);
        } catch (error) {
            failure = error;
        }
        await confirmSession(operation);
        if (!failure) return user;
        if (failure.code !== 'expired' || attempt === 1) throw failure;

        await coordinate(async () => {
            await confirmSession(operation, true);
            const previous = operation.session;
            // Refrescar A solo si sigue vigente al adquirir el turno.
            const data = await sdkCall(
                () => authClient().refreshSession({ refresh_token: previous.refresh_token }),
                'expired',
            );
            assertCurrent(operation);
            if (!data?.session?.access_token) throw new AuthError('expired');
            if (data.session.user?.id !== previous.user?.id) throw new AuthError('stale');
            operation.session = data.session;
            await confirmSession(operation, true);
        });
    }
}

export function onAuthSessionChange(callback) {
    // El consumidor solo invalida estado y programa trabajo fuera del callback.
    const { data } = authClient().onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') callback(event, session);
    });
    return () => data.subscription.unsubscribe();
}
