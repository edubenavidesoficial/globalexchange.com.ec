# Fase 2: shell protegido del CRM

Implementada el 5 de octubre de 2026. Solo estructura, identidad y autenticación; sin operaciones ni indicadores comerciales.

1. **Git inicial:** rama `migracion-vite`, árbol limpio, commit `3f0b33f feat: agregar login interno del CRM`.
2. **Arquitectura:** Vite multipágina, includes `@@include` (convención real del proyecto), CSS aislado y ES Modules. `crm.js` concentra el guard y la interacción del shell. `auth.js` y `config/supabase.js` coordinan ahora las mutaciones Auth mediante Web Locks. Express sigue siendo la autoridad de acceso.
3. **Creados:** `pages/crm/index.html`, `src/components/crm/CRM_Sidebar.html`, `src/components/crm/CRM_Topbar.html`, `src/components/pages/crm/CRM_Home.html`, `src/css/layouts/crm.css`, `src/js/modules/crm.js`, `tests/crm-shell.test.mjs`, `tests/preview-crm.mjs` y este documento. Rutas relativas a `frontend/`.
4. **Modificados:** `src/components/pages/login/Login_Page.html`, `src/js/modules/login.js`, `src/js/main.js`, `vite.config.js`, `package.json`, `package-lock.json`, `src/js/api/auth.js` y `src/config/supabase.js`. Se incorpora jsdom únicamente como dependencia de desarrollo para las pruebas.
5. **Login → CRM:** tanto el inicio de sesión como la restauración validan `/api/auth/me` antes de `window.location.replace('/pages/crm/')`. Se conserva la orquestación de concurrencia de Fase 1.
6. **CRM → login:** logout local mediante el `signOut(operation)` existente. Se ocultan y borran los datos antes del cierre. Solo se redirige cuando el cierre está confirmado o `getSession()` confirma ausencia de sesión. Si falla, quedan controles para recuperarse.
7. **Guard:** HTML protegido inicialmente `hidden` e `inert`; `getSession()` → `validateInternalUser()` → Express `/api/auth/me`. La identidad solo aparece tras el resultado autorizado y vigente. Las futuras páginas componen el mismo shell y reutilizan `initCRM()`; el contenido principal y la ruta activa deberán corresponder a cada página.
8. **Errores:** 401 admite como máximo un refresh y un segundo GET por validación. Segundo 401 o 403 intenta limpiar solo la sesión vigente y vuelve a login cuando es seguro. Si no puede confirmar el cierre, mantiene el bloqueo. 500/red conservan la sesión y muestran el mensaje de servicio no disponible con Reintentar y Cerrar sesión. No se revelan causas internas de denegación.
9. **Sincronización:** eventos SIGNED_IN/SIGNED_OUT invalidan la versión, cancelan peticiones, ocultan y borran la identidad inmediatamente. El trabajo Auth se programa fuera del callback del SDK. Las comprobaciones de vigencia protegen la UI; para impedir que un logout pendiente destruya otra sesión también se requiere la coordinación de mutaciones descrita abajo. Una denegación no se hereda por otra sesión detectada antes del evento. La restauración desde bfcache exige nueva validación.
10. **Sidebar:** marca Global Exchange CRM, Dashboard activo y diez módulos futuros, incluido Solicitudes. Los módulos futuros son elementos sin `href` ni foco de teclado, con `aria-disabled` y texto Próximamente. Alto `100dvh` con fallback `100vh`; logo y tarjeta de cuenta no se comprimen. Solo la navegación tiene scroll; cuenta y logout permanecen visibles abajo.
11. **Topbar:** identidad corporativa, Panel Comercial, avatar, nombre, rol y botón móvil. Nombre y rol se reciben exclusivamente de Express y se insertan con `textContent`.
12. **Responsive:** Sidebar fija desde 1024 px; drawer en tamaños inferiores, overlay, bloqueo del fondo mediante `inert`, bloqueo de scroll, cierre por Escape/overlay/botón/navegación y retorno del foco. Revisión final con mocks a 390×844, 768×1024 y 1440×900, además de 1440×700 para comprobar scroll independiente; cuenta visible y sin desbordamiento horizontal.
13. **Accesibilidad:** navegación y contenido semánticos, enlace para saltar al contenido, `aria-current`, `aria-controls`, `aria-expanded`, diálogo modal del drawer, recorrido circular de foco, `focus-visible`, estado de acceso anunciado con `aria-live` y controles reales de botón. El título conserva el foco programático; solo `.crm-title[tabindex="-1"]:focus` elimina el outline. Botones y enlaces conservan foco visible por teclado.
14. **Diferencias conscientes:** CSS modular en lugar de Tailwind, includes en lugar de React/Next, un rol real recibido de Express, menú futuro deshabilitado y drawer con foco y fondo bloqueado. Paleta propia del CRM para conservar la referencia empresarial sin importar los estilos públicos.
15. **Excluido:** datos demo, métricas, gráficos, consultas comerciales, matriz compleja de permisos, buscador, notificaciones y todos los módulos operativos. No se copian SSR, Server Actions ni acceso comercial directo a Supabase.
16. **Bootstrap:** `main.js` primero detecta login, después CRM; cada caso inicializa su módulo y retorna antes de los inicializadores públicos.
17. **Vite:** única entrada añadida: `crm` → `pages/crm/index.html`, dentro de `build.rolldownOptions.input`; se mantienen las anteriores.
18. **Pruebas:** 31/31 correctas; detalle abajo. Se ejecutan módulos originales con SDK simulado y real, transporte controlado y DOM simulado. Inspección adicional en navegador integrado para diseño, drawer, Escape, foco circular y navegación.
19. **Sintaxis:** `node --check` correcto en `crm.js`, `login.js`, `main.js`, `vite.config.js` y los dos archivos de pruebas/vista local.
20. **Build:** `npm run build` correcto; existen `dist/pages/login/index.html` y `dist/pages/crm/index.html` y no quedan includes sin resolver.
21. **Diff:** `git diff --check` sin errores. Git advierte sobre normalización LF/CRLF en algunos archivos; no son errores de whitespace.
22. **Estado final:** ocho archivos existentes modificados y nueve nuevos, todos dentro de `frontend/`. Ningún cambio agregado al índice. El estado y el diff íntegro se entregan junto con este informe.
23. **Diff completo:** el patch entregado originalmente corresponde a la primera implementación. Para esta corrección revisar el diff actual de Git y los archivos nuevos sin staging.
24. **Límites respetados:** no se modificaron backend, Supabase remoto, `.gitignore` ni el prototipo de Downloads. No hubo `git add`, commit ni push.

## Casos de prueba

| # | Caso | Resultado |
|---|---|---|
| 1 | Sin sesión → login | OK |
| 2 | Sesión + 200 → shell visible | OK |
| 3 | fullName/role de Express; texto sin inyección HTML | OK |
| 4 | 401 → un refresh y un segundo GET | OK |
| 5 | Segundo 401 → limpieza local → login | OK |
| 6 | 403 → CRM nunca visible; cierre fallido permanece bloqueado | OK |
| 7 | 500 → bloqueo, sesión conservada y reintento | OK |
| 8 | Red → bloqueo sin logout | OK |
| 9 | Logout correcto → login | OK |
| 10 | A → B elimina inmediatamente A y valida B | OK |
| 11 | Respuesta antigua A no modifica B | OK |
| 12 | SIGNED_OUT → ocultar y volver al login | OK |
| 13 | Shell hidden/inert hasta 200 | OK |
| 14 | Drawer, overlay, foco y bloqueo del fondo | OK |
| 15 | Escape y retorno del foco | OK |
| 16 | Módulos futuros sin navegación ni foco | OK |
| 17 | Dashboard único enlace y aria-current | OK |
| 18 | Login autorizado → CRM | OK |
| 19 | Login restaurado valida antes de redirigir | OK |
| 20 | Denegación A no cierra B detectado antes del evento Auth | OK |
| 21 | 401 tardío de A no refresca ni cierra B | OK |
| 22 | Error de logout permite recuperar el cierre | OK |
| 23 | bfcache requiere validar de nuevo | OK |
| 24 | Dos clientes SDK: logout A pendiente y login B dejan B activa | OK |
| 25 | CRM con SDK real: B espera y su UI no recibe un logout tardío de A | OK |
| 26 | Login B primero, cierre legítimo posterior: sin sesión | OK |
| 27 | Refresh interno y logout serializados | OK |
| 28 | Eventos síncronos y restores en cola sin deadlock | OK |
| 29 | Sin Web Locks: bloqueo seguro sin crear cliente | OK |
| 30 | Limpieza obsoleta de A en cola no cierra B | OK |
| 31 | Refresh interno y signIn serializados | OK |

## Reproducción

Desde `frontend/`, con Node 24 y dependencias instaladas:

```powershell
npm run test:crm
npm run build
```

El runner usa la API experimental de módulos VM de Node y emite su advertencia estándar. jsdom verifica lógica y DOM, no geometría visual.

Para inspeccionar visualmente con una identidad ficticia y sin Supabase:

```powershell
node tests/preview-crm.mjs
```

Abrir `http://127.0.0.1:4178/pages/crm/`. Este servidor de pruebas se limita a localhost y no debe desplegarse. Su identidad simulada solo pertenece al fixture de pruebas; la aplicación de producción usa la autorización real de Express.

La suite automatizada usa jsdom y la revisión visual se completó en el navegador integrado. El usuario confirmó manualmente login → CRM, F5 en CRM, drawer, Escape, logout → login y F5 después del logout contra los servicios reales.

## Corrección de concurrencia Auth

La reproducción previa con el SDK instalado y transporte simulado confirmó que `signOut(A)` pendiente podía eliminar B. El SDK 2.117.2 espera `/logout` incluso con `scope: local` y elimina después el almacenamiento compartido. `signInWithPassword` escribe sesión y emite SIGNED_IN sin adquirir el lock configurable. `getSession`, refresh, setSession, recuperación e inicialización sí usan ese lock cuando se configura; el cliente no usa Web Locks por defecto.

Dos Web Locks exclusivos del mismo origen coordinan las mutaciones entre pestañas: `globalexchange.com.ec:crm:auth-mutations` ordena `signIn`, `signOut`, refresh explícito y `getSession` de la aplicación, que puede refrescar; `globalexchange.com.ec:crm:auth-storage` coordina el SDK, incluido su refresh interno, y rodea también signIn. El orden es aplicación → almacenamiento; el SDK interno solo toma almacenamiento. La inicialización se espera antes de tomar manualmente ese lock. Express y los flujos de UI quedan fuera; los callbacks Auth programan trabajo posterior sin esperarlo.

Logout revalida cuenta/token después de adquirir su turno. La limpieza automática de 401/403 conserva la misma operación condicional: si su sesión cambió, se descarta como obsoleta. No se restaura B escribiendo tokens. Si logout A empieza primero, login B espera hasta su finalización: la regresión posterior conserva B. En sentido inverso, un logout legítimo vinculado a B termina sin sesión; una limpieza todavía vinculada a A se rechaza. Las pruebas usan dos clientes reales, almacenamiento compartido, entrega simulada de eventos entre pestañas y transporte controlado, sin Supabase remoto.

Regresiones cubiertas: logout A pendiente + login B → B permanece activa; login B primero + logout posterior → sin sesión; refresh interno y logout serializados; refresh pendiente y signIn serializados; sin Web Locks → falla cerrado, sin crear cliente ni ejecutar mutaciones.

Supabase JS 2.117.2 muestra una advertencia de deprecación para la opción `lock`. Antes de migrar a Supabase JS v3 se deberá revisar esta coordinación y ejecutar las regresiones. Todas las pestañas deben cargar esta versión; pestañas antiguas o consumidores que escriban fuera de la abstracción no respetan el protocolo.

Esta corrección no cambia login.js ni crm.js. El preview solo incorpora los dos exports de coordinación exigidos por el import de auth.js. No se añadieron dependencias.
