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

export class InternalMutationError extends Error {
    constructor(code, status) {
        super(code);
        this.code = code;
        this.status = status;
    }
}

function internalPath(path) {
    if (typeof path !== 'string' || !/^\/api\/[a-z0-9/-]+$/i.test(path) || /[\r\n]/.test(path)) {
        throw new AuthError('configuration');
    }
}

// Conserva la firma anterior; query es un mapa opcional de strings.
export async function getInternal(path, access, signal, query) {
    internalPath(path);
    if (query !== undefined) {
        if (!query || typeof query !== 'object' || Array.isArray(query) ||
            ![Object.prototype, null].includes(Object.getPrototypeOf(query)) ||
            Object.values(query).some(value => typeof value !== 'string')) throw new AuthError('configuration');
        const params = new URLSearchParams(Object.entries(query));
        if (params.size) path += `?${params}`;
    }
    return requestInternal(path, access, signal);
}

export async function postInternal(path, access, signal, payload, idempotencyKey) {
    return mutateInternal(path, access, signal, payload, idempotencyKey, 'POST', 201);
}

export async function patchInternal(path, access, signal, payload, idempotencyKey) {
    return mutateInternal(path, access, signal, payload, idempotencyKey, 'PATCH', 200);
}

// Solo PATCH reconoce estos códigos, vinculados a su estado HTTP esperado.
const patchDomainCodes = new Map([
    ['MEETING_VERSION_CONFLICT', 409], ['IDEMPOTENCY_KEY_REUSED', 409],
    ['MEETING_NOT_FOUND', 404], ['MEETING_NOT_SCHEDULED', 409],
    ['CONSULTATION_STATE_INCONSISTENT', 409],
    ['MEETING_NOT_IN_FUTURE', 422], ['INVALID_TIME_ZONE', 422], ['INVALID_LOCAL_TIME', 422],
]);

// Política exclusiva de resultados; no ampliar los contratos históricos PATCH.
const outcomePath = /^\/api\/admin\/meetings\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/(?:complete|no-show)$/i;
const outcomeDomainCodes = new Map([
    ['ACTOR_NOT_ALLOWED', 403], ['MEETING_NOT_FOUND', 404],
    ['MEETING_NOT_SCHEDULED', 409], ['MEETING_VERSION_CONFLICT', 409],
    ['CONSULTATION_STATE_INCONSISTENT', 409], ['IDEMPOTENCY_KEY_REUSED', 409],
    ['MEETING_TOO_EARLY', 422], ['WORKFLOW_ISOLATION_NOT_SUPPORTED', 500], ['INTERNAL_ERROR', 500],
]);

// Solo datos propios; no ejecutar accesores ni consultar valores heredados.
function ownData(value, key) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
}

function mutateInternal(path, access, signal, payload, idempotencyKey, method, successStatus) {
    internalPath(path);
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length !== 36 ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
        throw new AuthError('configuration');
    }
    return requestInternal(path, access, signal, {
        body: JSON.stringify(payload), idempotencyKey, method, successStatus,
    });
}

// No conserva tokens, no reintenta ni implementa otro refresh/guard.
async function requestInternal(path, access, signal, mutation) {
    const isOutcome = mutation?.method === 'PATCH' && outcomePath.test(path);
    const domainCodes = isOutcome ? outcomeDomainCodes : patchDomainCodes;
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
    let domainCode;
    let failure;
    try {
        response = await waitFor(fetch(path, {
            method: mutation ? mutation.method : 'GET',
            headers: { Authorization: `Bearer ${session.access_token}`,
                ...(mutation ? { 'Content-Type': 'application/json', 'Idempotency-Key': mutation.idempotencyKey } : {}),
            },
            ...(mutation ? { body: mutation.body } : {}),
            cache: 'no-store',
            credentials: 'omit',
            redirect: 'error',
            signal: requestSignal,
        }), requestSignal);
        // Cada mutation exige su estado exacto. Clasificar tras confirmar sesión.
        if (response.ok && (!mutation || response.status === mutation.successStatus)) {
            try {
                body = await waitFor(response.json(), requestSignal);
            } catch (error) {
                if (!mutation || requestSignal.aborted) throw error;
                failure = new InternalMutationError('invalid_response', response.status);
            }
        }
        if (mutation?.method === 'PATCH' &&
            (isOutcome ? [403, 404, 409, 422, 500] : [400, 404, 409, 422]).includes(response.status)) {
            try {
                const errorBody = await waitFor(response.json(), requestSignal);
                const candidate = ownData(ownData(errorBody, 'error'), 'code');
                if (typeof candidate === 'string' && domainCodes.get(candidate) === response.status) domainCode = candidate;
            } catch {
                // Un error HTTP con JSON ilegible conserva su clasificación por status.
                if (requestSignal.aborted) throw new AuthError('timeout');
            }
        }
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
        if (response?.status === 403 && !mutation) throw new AuthError('denied');
        throw error;
    }
    if (failure) throw failure;
    if (response.status === 401) throw new AuthError('expired');
    if (mutation) {
        if (!response.ok) {
            const error = new InternalMutationError(response.status >= 500 ? 'server'
                : response.status === 403 ? 'forbidden' : 'operation', response.status);
            // code sigue siendo la clasificación existente; nunca copiar el error bruto.
            if (domainCode !== undefined) error.domainCode = domainCode;
            throw error;
        }
        if (response.status !== mutation.successStatus) throw new InternalMutationError('invalid_response', response.status);
    }
    if (response.status === 403) throw new AuthError('denied');
    if (!response.ok) throw new AuthError(response.status >= 500 ? 'server' : 'unavailable');
    return body;
}
