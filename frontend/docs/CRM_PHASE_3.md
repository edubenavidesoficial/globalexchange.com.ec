# Fase 3: bandeja de solicitudes

Implementación de solo lectura en `/pages/crm/solicitudes/`. Estado inicial verificado: rama `migracion-vite`, árbol limpio, commits `787544a` (shell CRM) y `3f0b33f` (login). Sin staging, commit ni push.

## Contrato confirmado

`GET /api/admin/consultations` usa `authenticate` y `authorize('admin', 'agendadora', 'vendedora')`. Express entrega `{ data: [...] }`, ordenado por creación descendente y luego id descendente, sin filtros ni paginación.

Cada elemento contiene `id`, `program: { id, code, name }`, `fullName`, `phone`, `email`, `city`, `mode`, `preferredDate`, `preferredTime`, `message`, `status`, `createdAt`. La interfaz muestra el nombre del programa, nunca UUIDs. `email` y `message` pueden ser null y se representan con «—».

Fuentes: `backend/src/modules/consultations/consultations.admin.routes.js`, controller, service, repository y `backend/supabase/migrations/005_create_consultation_requests.sql`. El service transforma snake_case a camelCase. Estados válidos: pending → Pendiente, converted → Convertida, cancelled → Cancelada. Modalidades: online → En línea, phone → Teléfono, office → Oficina. No se implementan mutaciones, agenda, reuniones ni clientes.

## Integración y seguridad

- `main.js` carga primero el módulo de página y pasa sus callbacks a `initCRM`. `crm.js` sigue siendo el único guard: solo invoca `onAuthorized` tras `/api/auth/me` autorizado y vigente; `block` llama a `onInvalidate` sincrónicamente.
- `getInternal` centraliza GET internos con `getSession` existente, Bearer, `cache: no-store`, sin cookies ni redirecciones y señal combinada con timeout de 15 segundos. Comprueba cuenta/token antes y después del transporte, sin almacenar tokens adicionales de forma permanente. No accede a tablas Supabase ni decide permisos a partir de roles locales.
- `auth.js`, configuración Supabase y sus Web Locks no cambian. El helper usa la infraestructura coordinada de Fase 2; no implementa otro refresh ni ejecuta el transporte HTTP bajo locks.
- Un 401/403 vigente limpia la bandeja y bloquea el shell. Reintentar es manual y pasa otra vez por el guard antes de cargar datos; no hay loop automático ni logout propio del módulo. El guard conserva su refresh limitado y su limpieza condicional si `/api/auth/me` rechaza el acceso.
- 5xx, red, timeout o cuerpo inválido limpian resultados y muestran «No fue posible cargar las solicitudes.» con Reintentar. Shell y sesión se conservan.
- A → B, logout y pagehide borran filas, resumen y referencias de acceso; abortan la petición e incrementan su generación. Respuestas obsoletas se descartan incluso si el transporte ignora abort. Si getSession descubre el cambio antes del evento Auth, se solicita revalidación al guard. bfcache exige autorización nueva antes de recargar.
- Todos los campos se insertan con `createElement`/`textContent`. No hay HTML interpolado, enlaces de contacto automáticos ni datos de ejemplo en producción.

## Interfaz

Tabla en escritorio y tarjetas mediante CSS por debajo de 1200 px; mensaje en `details` nativo. Se conserva la paleta, radios y espaciado del shell. Loading explícito, vacío «No hay solicitudes registradas todavía.» y resumen Total/Pendientes/Convertidas/Canceladas calculado solo del array recibido (cero para array vacío). Actualizar evita peticiones simultáneas y expone disabled/aria-busy. Durante una recarga se eliminan resultados anteriores.

Sidebar compartida con Dashboard y Solicitudes funcionales; ruta normalizada (barra final e index.html) para `aria-current`. Nueve módulos permanecen deshabilitados. Dashboard deja de anunciar Solicitudes como futura.

`preferredDate` se formatea por componentes como DD/MM/AAAA, sin Date ni conversión UTC. `preferredTime` conserva HH:mm. `createdAt` se presenta con Intl en `es-EC`, zona `America/Guayaquil`, año completo y hora de 24 horas. Las preferencias no se presentan como citas confirmadas.

Referencia visual: inspección de estilos de tabla/badges en el prototipo de Downloads, solo lectura. Se mantienen Vite, ES Modules y CSS modular; no se copian React, Next, Tailwind ni datos del prototipo. Sin filtros ni paginación simulada: cuando crezca el volumen deberán implementarse en backend. El endpoint actual entrega el conjunto completo autorizado para estos roles.

## Archivos

Rutas relativas a `frontend/`.

Nuevos:
- `pages/crm/solicitudes/index.html`
- `src/components/pages/crm/CRM_Consultations.html`
- `src/css/pages/crm-consultations.css`
- `src/js/api/internal.js`
- `src/js/modules/crm-consultations.js`
- `tests/fixtures/consultations.mjs`
- `docs/CRM_PHASE_3.md`

Modificados:
- `src/components/crm/CRM_Sidebar.html`
- `src/components/pages/crm/CRM_Home.html`
- `src/js/main.js`
- `src/js/modules/crm.js`
- `vite.config.js`
- `tests/crm-shell.test.mjs`
- `tests/preview-crm.mjs`

## Validación

- `node --check`: ocho JS/MJS nuevos o modificados correctos.
- `npm run test:crm`: 55/55. Se mantienen los 31 casos previos; únicamente se actualizan las expectativas de navegación de los casos 16/17 (dos rutas funcionales, nueve futuras) y la URL del fixture del caso 25.
- Casos 32–49: espera de autorización, datos/resumen, vacío, null, estados, modalidades, 500, red, retry, doble actualización, respuesta antigua A, limpieza A → B, rutas activas, módulos futuros, XSS, fechas y bfcache.
- Casos adicionales: 401 y 403 bloquean sin loops y revalidan con reintento manual; rechazo viejo A sin evento; logout con respuesta pendiente; cuerpo inválido; timeout recuperable.
- `npm run build`: correcto; genera `dist/pages/crm/index.html`, `dist/pages/crm/solicitudes/index.html` y `dist/pages/login/index.html`.
- Navegador integrado con fixtures: 1440×900, 768×1024 y 390×844 sin scroll horizontal; actualización, mensaje expandible, navegación Dashboard/Solicitudes, drawer y Escape correctos. Sin errores de consola observados. No se verificó esta nueva bandeja contra el servicio remoto.
- `git diff --check`: sin errores. No se añadieron dependencias.

Backend, Supabase remoto, configuración local de entorno y prototipo no fueron modificados. El preview sirve fixtures únicamente en localhost y no forma parte de las entradas de producción. Las capturas y el diff completo se entregan en `dist/` como artefactos locales ignorados por Git; un nuevo build puede reemplazarlos.
