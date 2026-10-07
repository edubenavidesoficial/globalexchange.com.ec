import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { consultationsFixture } from './fixtures/consultations.mjs';

// Solo inspección visual local. No carga Vite, .env ni conexiones Supabase.
// Nunca incluir este servidor de fixtures en un despliegue.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
async function includes(file) {
    let html = await readFile(file, 'utf8');
    for (const match of html.matchAll(/@@include\('([^']+)'\)/g)) {
        html = html.replace(match[0], await includes(resolve(dirname(file), match[1])));
    }
    return html;
}
const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    try {
        if (pathname === '/src/config/supabase.js') {
            response.setHeader('Content-Type', 'text/javascript');
            response.end(`
                export const withAuthMutation = action => navigator.locks.request('globalexchange:preview:mutations', action);
                export const withAuthStorageLock = action => navigator.locks.request('globalexchange:preview:storage', action);
                let session = { access_token: 'fixture-only', user: { id: 'fixture' } };
                let listener = () => {};
                export const getSupabaseClient = () => ({ auth: {
                    getSession: async () => ({ data: { session } }),
                    onAuthStateChange: callback => { listener = callback; return { data: { subscription: { unsubscribe() {} } } }; },
                    signOut: async () => { session = null; listener('SIGNED_OUT', null); return { data: {} }; }
                } });
            `);
        } else if (pathname === '/api/auth/me') {
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ data: { id: 'fixture', fullName: 'Usuario de Prueba', role: 'admin' } }));
        } else if (pathname === '/src/js/main.js') {
            response.setHeader('Content-Type', 'text/javascript');
            response.end("import { initCRM } from '/src/js/modules/crm.js'; import { initCRMConsultations } from '/src/js/modules/crm-consultations.js'; initCRM(document.querySelector('[data-consultations]') ? initCRMConsultations() : undefined);");
        } else if (pathname === '/api/admin/consultations') {
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ data: consultationsFixture }));
        } else if (pathname === '/api/admin/internal-users') {
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ data: [] }));
        } else if (['/pages/crm/', '/pages/crm/solicitudes/'].includes(pathname)) {
            response.setHeader('Content-Type', 'text/html; charset=utf-8');
            response.end(await includes(resolve(root, `.${pathname}index.html`)));
        } else if (pathname.startsWith('/src/')) {
            const path = resolve(root, `.${pathname}`);
            if (!path.startsWith(`${root}${sep}src${sep}`) || !/\.(css|js)$/.test(path)) {
                response.writeHead(404); response.end(); return;
            }
            response.setHeader('Content-Type', pathname.endsWith('.css') ? 'text/css' : 'text/javascript');
            response.end(await readFile(path));
        } else {
            response.setHeader('Content-Type', 'text/html; charset=utf-8');
            response.end('<p>Vista de prueba local. Sesión simulada cerrada.</p>');
        }
    } catch { response.writeHead(500); response.end('Error de vista de prueba'); }
});
server.listen(4178, '127.0.0.1', () => console.log('Vista con mocks: http://127.0.0.1:4178/pages/crm/'));
