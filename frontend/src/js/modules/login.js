import { getSession, signIn, signOut, validateInternalUser, onAuthSessionChange } from '../api/auth.js';

const messages = {
    credentials: 'El correo o la contraseña no son correctos.',
    denied: 'No tienes acceso al sistema interno.',
    expired: 'Tu sesión ha expirado. Inicia sesión nuevamente.',
    unavailable: 'El servicio no está disponible en este momento. Intenta nuevamente.',
    network: 'No fue posible conectar con el servidor. Verifica tu conexión.',
    logout: 'No fue posible cerrar sesión. Intenta nuevamente.',
    logoutUnknown: 'No fue posible confirmar el cierre de sesión. Intenta nuevamente.',
    configuration: 'El acceso no está configurado. Configura VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en el entorno del frontend.',
};

export function initLogin() {
    const root = document.querySelector('[data-login]');
    if (!root || root.dataset.initialized) return;
    root.dataset.initialized = 'true';

    const find = (name) => root.querySelector(`[data-login-${name}]`);
    const form = find('form');
    const email = form.elements.email;
    const password = form.elements.password;
    const submit = find('submit');
    const message = find('message');
    const verified = find('verified');
    const actions = find('actions');
    const retry = find('retry');
    const logout = find('logout');
    let busy = false;
    let mode = 'form';
    let sessionVersion = 0;
    let denied = false;
    let sessionKey = null;
    let running = null;
    let restoreQueued = false;
    let restoreTimer;
    let closingMessage = null;

    // Identidad y token se usan solo para sincronizar, nunca para autorizar.
    const keyOf = (session) => session
        ? `${session.user?.id}:${session.access_token}` : null;

    function announce(text = '', tone = 'info') {
        message.textContent = text;
        message.dataset.tone = tone;
    }

    function clearProfile() {
        find('name').textContent = '';
        find('role').textContent = '';
    }

    function render() {
        form.hidden = mode !== 'form';
        verified.hidden = mode !== 'verified';
        actions.hidden = mode === 'form';
        retry.hidden = mode !== 'pending' || denied;
        form.setAttribute('aria-busy', String(busy));
        for (const control of [email, password, submit, retry, logout]) control.disabled = busy;
        submit.textContent = busy ? 'Verificando…' : 'Iniciar sesión';
        logout.textContent = busy ? 'Espera…' : 'Cerrar sesión';
    }

    function scheduleRestore() {
        restoreQueued = true;
        clearTimeout(restoreTimer);
        // Una tarea posterior sale del callback y del bloqueo interno del SDK.
        restoreTimer = setTimeout(() => {
            if (running || !restoreQueued) return;
            restoreQueued = false;
            void perform('restore');
        }, 0);
    }

    function showClosed(text) {
        clearProfile();
        sessionKey = null;
        mode = 'form';
        form.reset();
        announce(text);
    }

    async function closeSession(operation, text) {
        closingMessage = { operation, text };
        try {
            await signOut(operation);
            if (operation.isCurrent()) showClosed(text);
        } finally {
            if (closingMessage?.operation === operation) closingMessage = null;
        }
    }

    async function perform(action) {
        if (running) return;
        busy = true;
        if (action !== 'logout') denied = false;
        const version = sessionVersion;
        const controller = new AbortController();
        const operation = {
            session: null,
            signal: controller.signal,
            isCurrent: () => version === sessionVersion,
            controller,
        };
        running = operation;
        announce(action === 'logout' ? 'Cerrando sesión…' : 'Verificando acceso…');
        render();

        try {
            const session = action === 'login'
                ? await signIn(email.value.trim(), password.value)
                : await getSession();
            password.value = '';
            // SIGNED_IN propio entrega la continuación a la restauración en cola.
            if (!operation.isCurrent()) return;
            operation.session = session;
            sessionKey = keyOf(session);
            if (!session) {
                showClosed(action === 'logout' ? 'Sesión cerrada.' : '');
                return;
            }

            mode = 'pending';
            clearProfile();
            render();
            if (action === 'logout') {
                denied = true;
                await closeSession(operation, 'Sesión cerrada.');
                return;
            }
            const user = await validateInternalUser(operation);
            if (!operation.isCurrent()) return;
            sessionKey = keyOf(operation.session);
            find('name').textContent = user.fullName;
            find('role').textContent = user.role;
            mode = 'verified';
            announce('Acceso verificado.');
            window.location.replace('/pages/crm/');
        } catch (error) {
            if (!operation.isCurrent()) return;
            const code = error?.code ?? 'unavailable';
            if (code === 'stale') {
                clearProfile();
                mode = 'pending';
                scheduleRestore();
                return;
            }
            if (action !== 'login' || operation.session) {
                mode = 'pending';
                clearProfile();
            }
            if (['denied', 'expired'].includes(code)) {
                clearProfile();
                denied = true;
                if (operation.session) {
                    try {
                        await closeSession(operation, messages[code]);
                    } catch (closeError) {
                        if (!operation.isCurrent()) return;
                        if (closeError.code === 'stale') {
                            scheduleRestore();
                            return;
                        }
                        announce(`${messages[code]} ${messages[closeError.code] ?? messages.logoutUnknown}`, 'error');
                    }
                    return;
                }
                mode = 'form';
            }
            announce(messages[code] ?? messages.unavailable, 'error');
        } finally {
            password.value = '';
            running = null;
            busy = restoreQueued;
            render();
            if (restoreQueued) {
                scheduleRestore();
                return;
            }
            if (!operation.isCurrent()) return;
            if (mode === 'verified') find('heading').focus();
            else if (mode === 'pending') (denied ? logout : retry).focus();
            else if (action !== 'restore') email.focus();
        }
    }

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        if (busy) return;
        if (!form.reportValidity()) return;
        void perform('login');
    });
    retry.addEventListener('click', () => void perform('restore'));
    logout.addEventListener('click', () => void perform('logout'));

    try {
        onAuthSessionChange((event, session) => {
            const nextKey = event === 'SIGNED_OUT' ? null : keyOf(session);
            if (event === 'SIGNED_IN' && nextKey === sessionKey) return;
            const closedText = closingMessage?.operation.isCurrent()
                ? closingMessage.text : 'Sesión cerrada. Inicia sesión nuevamente.';
            sessionVersion += 1;
            sessionKey = nextKey;
            running?.controller.abort();
            clearProfile();
            password.value = '';
            closingMessage = null;
            denied = false;
            if (event === 'SIGNED_OUT') {
                restoreQueued = false;
                clearTimeout(restoreTimer);
                showClosed(closedText);
            } else {
                mode = 'pending';
                announce('Verificando acceso…');
                scheduleRestore();
            }
            busy = Boolean(running) || restoreQueued;
            render();
        });
    } catch {
        // La restauración muestra el mismo error de configuración de forma accesible.
    }
    void perform('restore');
}
