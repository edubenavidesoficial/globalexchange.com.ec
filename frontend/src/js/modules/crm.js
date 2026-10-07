import { getSession, signOut, validateInternalUser, onAuthSessionChange } from '../api/auth.js';

// Guard compartido por cualquier página que componga el shell [data-crm].
// La sesión identifica la operación; solo Express autoriza el contenido.
export function initCRM({ onAuthorized = () => {}, onInvalidate = () => {} } = {}) {
    const root = document.querySelector('[data-crm]');
    if (!root || root.dataset.initialized) return;
    root.dataset.initialized = 'true';
    const find = (name) => root.querySelector(`[data-crm-${name}]`);
    const all = (name) => root.querySelectorAll(`[data-crm-${name}]`);
    const shell = find('shell');
    const gate = find('gate');
    const message = find('message');
    const actions = find('actions');
    const retry = find('retry');
    const sidebar = find('sidebar');
    const menu = find('menu');
    const workspace = find('workspace');
    const overlay = find('overlay');
    const mobile = window.matchMedia('(max-width: 1023px)');
    let version = 0;
    let sessionKey = null;
    let running = null;
    let timer;
    let drawerOpen = false;
    let denied = false;
    let authorized = false;
    const keyOf = (session) => session ? `${session.user?.id}:${session.access_token}` : null;

    const route = (path) => path.replace(/\/index\.html$/, '/').replace(/\/?$/, '/');
    sidebar.querySelectorAll('.crm-nav a[href]').forEach((link) => {
        if (route(link.getAttribute('href')) === route(window.location.pathname)) {
            link.setAttribute('aria-current', 'page');
        } else link.removeAttribute('aria-current');
    });

    function drawer(open, restoreFocus = true) {
        drawerOpen = open && mobile.matches && !shell.hidden;
        sidebar.dataset.open = String(drawerOpen);
        sidebar.inert = mobile.matches && !drawerOpen;
        menu.setAttribute('aria-expanded', String(drawerOpen));
        menu.setAttribute('aria-label', drawerOpen ? 'Cerrar menú' : 'Abrir menú');
        overlay.hidden = !drawerOpen;
        workspace.inert = drawerOpen;
        root.classList.toggle('crm-page--drawer', drawerOpen);
        if (drawerOpen) {
            sidebar.setAttribute('role', 'dialog');
            sidebar.setAttribute('aria-modal', 'true');
            find('close').focus();
        } else {
            sidebar.removeAttribute('role');
            sidebar.removeAttribute('aria-modal');
            if (restoreFocus && mobile.matches && !shell.hidden) menu.focus();
        }
    }

    function block(text, canAct = false) {
        authorized = false;
        onInvalidate();
        drawer(false, false);
        shell.hidden = true;
        shell.inert = true;
        for (const field of ['name', 'role', 'avatar']) {
            all(field).forEach((element) => { element.textContent = ''; });
        }
        gate.hidden = false;
        message.textContent = text;
        actions.hidden = !canAct;
        retry.hidden = denied;
    }

    function busy(value) {
        for (const control of [retry, ...all('logout')]) control.disabled = value;
        gate.setAttribute('aria-busy', String(value));
    }

    function redirect() {
        block('Redirigiendo al inicio de sesión…');
        window.location.replace('/pages/login/');
    }

    function schedule() {
        clearTimeout(timer);
        // Fuera del callback Auth: no entrar al bloqueo del SDK desde él.
        timer = setTimeout(() => void perform('validate'), 0);
    }

    async function perform(action) {
        if (running) return;
        clearTimeout(timer);
        const currentVersion = version;
        const controller = new AbortController();
        const operation = {
            session: null,
            signal: controller.signal,
            isCurrent: () => currentVersion === version,
            controller,
        };
        running = operation;
        block(action === 'logout' ? 'Cerrando sesión…' : 'Verificando acceso…');
        busy(true);
        try {
            operation.session = await getSession();
            if (!operation.isCurrent()) return;
            // Un rechazo anterior solo corresponde a la sesión que se rechazó.
            // getSession también puede detectar un cambio antes del evento Auth.
            if (keyOf(operation.session) !== sessionKey) denied = false;
            sessionKey = keyOf(operation.session);
            if (!operation.session) { redirect(); return; }
            if (action === 'logout' || denied) {
                await signOut(operation);
                if (operation.isCurrent()) redirect();
                return;
            }
            const user = await validateInternalUser(operation);
            if (!operation.isCurrent()) return;
            sessionKey = keyOf(operation.session);
            all('name').forEach((element) => { element.textContent = user.fullName; });
            all('role').forEach((element) => { element.textContent = user.role; });
            const initials = user.fullName.trim().split(/\s+/u).slice(0, 2)
                .map((part) => Array.from(part)[0]).join('').toLocaleUpperCase('es');
            all('avatar').forEach((element) => { element.textContent = initials; });
            gate.hidden = true;
            shell.inert = false;
            shell.hidden = false;
            find('heading')?.focus();
            authorized = true;
            // Capacidad temporal: una página solo carga tras autorización de Express.
            const isCurrent = () => authorized && operation.isCurrent();
            onAuthorized({
                user: { fullName: user.fullName, role: user.role },
                session: operation.session,
                signal: operation.signal,
                isCurrent,
                revalidate() {
                    if (!isCurrent()) return;
                    invalidate();
                    schedule();
                },
                blockAccess() {
                    if (!isCurrent()) return;
                    invalidate();
                    block('No fue posible validar el acceso a esta sección. Vuelve a intentarlo.', true);
                    busy(false);
                    retry.focus();
                },
            });
        } catch (error) {
            if (!operation.isCurrent()) return;
            if (error?.code === 'stale') { schedule(); return; }
            if (['expired', 'denied'].includes(error?.code)) {
                denied = true;
                sessionKey = keyOf(operation.session);
                try {
                    // signOut confirma token/cuenta antes de tocar la sesión local.
                    if (operation.session) await signOut(operation);
                    if (operation.isCurrent()) redirect();
                } catch (closeError) {
                    if (!operation.isCurrent()) return;
                    if (closeError?.code === 'stale') { schedule(); return; }
                    block('No fue posible confirmar el cierre de sesión. Intenta nuevamente.', true);
                }
            } else {
                block(action === 'logout' || denied
                    ? 'No fue posible confirmar el cierre de sesión. Intenta nuevamente.'
                    : 'El servicio no está disponible en este momento.', true);
            }
        } finally {
            // Una respuesta de A nunca libera controles ni cambia la UI de B.
            if (running === operation) {
                running = null;
                busy(false);
                if (operation.isCurrent() && !actions.hidden) {
                    (denied ? actions.querySelector('[data-crm-logout]') : retry).focus();
                }
            }
        }
    }

    function invalidate() {
        version += 1;
        running?.controller.abort();
        running = null;
        clearTimeout(timer);
        block('Verificando acceso…');
    }

    retry.addEventListener('click', () => void perform('validate'));
    all('logout').forEach((button) => button.addEventListener('click', () => void perform('logout')));
    menu.addEventListener('click', () => drawer(!drawerOpen));
    find('close').addEventListener('click', () => drawer(false));
    overlay.addEventListener('click', () => drawer(false));
    sidebar.querySelectorAll('a[href]').forEach((link) => link.addEventListener('click', () => drawer(false)));
    root.addEventListener('keydown', (event) => {
        if (!drawerOpen) return;
        if (event.key === 'Escape') { event.preventDefault(); drawer(false); }
        if (event.key !== 'Tab') return;
        const controls = [...sidebar.querySelectorAll('a[href], button:not(:disabled)')];
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && (document.activeElement === first || document.activeElement === sidebar)) {
            event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault(); first.focus();
        }
    });
    mobile.addEventListener('change', () => {
        const focusWasInSidebar = sidebar.contains(document.activeElement);
        drawer(false, mobile.matches && focusWasInSidebar);
        if (!mobile.matches && document.activeElement === find('close')) find('heading')?.focus();
    });
    drawer(false, false);
    try {
        onAuthSessionChange((event, session) => {
            const nextKey = event === 'SIGNED_OUT' ? null : keyOf(session);
            if (event === 'SIGNED_IN' && nextKey === sessionKey) return;
            invalidate();
            sessionKey = nextKey;
            denied = false;
            schedule();
        });
    } catch {
        // perform muestra un bloqueo genérico también ante configuración ausente.
    }
    // Una restauración desde bfcache debe autorizarse de nuevo antes de mostrar datos.
    window.addEventListener('pagehide', invalidate);
    window.addEventListener('pageshow', (event) => { if (event.persisted) schedule(); });
    void perform('validate');
}
