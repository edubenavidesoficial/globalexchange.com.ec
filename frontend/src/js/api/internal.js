import { getSession, AuthError } from './auth.js';

// Aborta solo la espera del consumidor, nunca la operación Auth ni sus locks.
function waitFor(promise, signal) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const finish = (settle, value) => {
            if (settled) return;
            settled = true;
            signal.removeEventListener('abort', onAbort);
            settle(value);
        };
        const onAbort = () => finish(reject, signal.reason);
        // Registrar ambos handlers incluso si la señal ya llegó abortada.
        Promise.resolve(promise).then(
            value => finish(resolve, value),
            error => finish(reject, error),
        );
        if (signal.aborted) onAbort();
        else signal.addEventListener('abort', onAbort, { once: true });
    });
}

// Solo GET internos. No conserva tokens ni implementa otro refresh/guard.
export async function getInternal(path, access, signal) {
    if (!/^\/api\/[a-z0-9/-]+$/i.test(path)) throw new AuthError('configuration');
    const requestSignal = AbortSignal.any([access.signal, signal, AbortSignal.timeout(15000)]);
    const assertCurrent = () => {
        if (!access.isCurrent() || signal.aborted || access.signal.aborted) throw new AuthError('stale');
        if (requestSignal.aborted) throw new AuthError('timeout');
    };
    const confirm = async () => {
        assertCurrent();
        let session;
        try {
            session = await waitFor(getSession(), requestSignal);
        } catch (error) {
            // Conserva stale para invalidaciones y timeout para el plazo vencido.
            assertCurrent();
            throw error;
        }
        assertCurrent();
        if (!session) throw new AuthError('expired');
        if (session.user?.id !== access.session.user?.id ||
            session.access_token !== access.session.access_token) throw new AuthError('stale');
        return session;
    };
    const session = await confirm();
    let response;
    let body;
    let failure;
    try {
        response = await fetch(path, {
            method: 'GET',
            headers: { Authorization: `Bearer ${session.access_token}` },
            cache: 'no-store',
            credentials: 'omit',
            redirect: 'error',
            signal: requestSignal,
        });
        if (response.ok) body = await response.json();
    } catch {
        failure = new AuthError(requestSignal.aborted && !signal.aborted && !access.signal.aborted
            ? 'timeout' : 'network');
    }
    // Incluso un 401 tardío debe descartarse si pertenece a otra cuenta.
    if (!access.isCurrent() || signal.aborted || access.signal.aborted) throw new AuthError('stale');
    if (requestSignal.aborted) throw failure ?? new AuthError('timeout');
    try {
        await confirm();
    } catch (error) {
        if (['stale', 'expired'].includes(error?.code)) throw error;
        // Si no se puede confirmar la sesión tras una denegación, bloquear es seguro.
        if (response?.status === 401) throw new AuthError('expired');
        if (response?.status === 403) throw new AuthError('denied');
        throw error;
    }
    if (failure) throw failure;
    if (response.status === 401) throw new AuthError('expired');
    if (response.status === 403) throw new AuthError('denied');
    if (!response.ok) throw new AuthError(response.status >= 500 ? 'server' : 'unavailable');
    return body;
}
