# Fase 4C.2: API frontend de Agenda

`getAgendaMeetings({ from, to, access, signal })`, exportada por
`src/js/api/meetings.js`, devuelve un array de reuniones. Importar el módulo
no inicia peticiones. Esta fase no incluye UI, calendario ni acciones sobre reuniones.

## Consulta y autorización

Usa `getInternal('/api/admin/meetings', access, signal, { from, to })`.
El helper compartido construye la query con URLSearchParams: exactamente `from`
y `to`, sin concatenación manual, overrides de URL ni parámetros adicionales.

El caller entrega strings RFC3339 con zona explícita, por ejemplo
`2026-10-01T00:00:00-05:00` y `2026-10-02T00:00:00-05:00`. No se aceptan Date
ni se convierten zonas. Localmente se comprueban strings no vacías, opciones,
el access del guard (session, user.id, access_token, isCurrent y AbortSignal)
y la señal opcional. Si se omite signal, se crea una señal local para el helper.
El backend valida RFC3339 completo, calendario, zona, from < to y máximo 45 días.

Se rechazan opciones adicionales, incluidas role, userId, viewerId, sellerId
y assignedTo. El frontend no decide scope. El backend autoriza admin/agendadora
para todas las reuniones del rango y vendedora exclusivamente para
`assigned_to = req.user.id`. El perfil de access no se serializa como filtro.

## Contrato público y privacidad

La respuesta debe ser un objeto con `data` array. Cada fila requiere:

| Campos | Validación |
|---|---|
| id, consultationRequestId | UUID |
| scheduledAt | Timestamp con estructura de fecha/hora, segundos y zona explícita; fracción opcional |
| timeZone | String no vacía |
| durationMinutes, version | Enteros positivos |
| mode | online, phone, office |
| status | scheduled, completed, cancelled, no_show |
| consultation | Objeto con id UUID, fullName no vacío, phone string, email string o null |
| consultation.program | Objeto con id UUID, code y name no vacíos |
| assignedTo | Objeto con id UUID y fullName no vacío |

Una fila inválida rechaza toda la respuesta; no se entregan resultados parciales.
`{ "data": [] }` devuelve `[]`. Se conserva el orden recibido, cuyo contrato
backend es scheduledAt ASC, id ASC; no se ordena ni filtra en frontend.

Se crean objetos nuevos en cada nivel usando únicamente estos campos.
No se propagan notes, message, city, createdBy, updatedBy, createdAt, updatedAt,
active, internalEmail, privateSentinel ni otros extras. No se añade freeze,
storage, logging de datos ni persistencia de respuestas.

## Transporte y errores

Se conserva internal.js sin cambios: Bearer de la sesión confirmada,
cache no-store, credentials omit, redirect error y timeout total de 15 segundos.
La señal externa se combina con la del guard y el timeout. Las esperas Auth,
fetch y JSON son cancelables; internal.js retira sus listeners al completarlas.
Cancelar la espera no cancela Auth ni libera sus locks subyacentes.
Cuenta, token y vigencia se comprueban antes y después del transporte.
No se añade refresh, logout, reintento automático ni otro sistema de autenticación.

| Caso | code |
|---|---|
| Entrada local incorrecta | invalid_input |
| HTTP 400 (rango/query inválido) | unavailable, contrato GET existente |
| HTTP 401 | expired |
| HTTP 403 | denied |
| HTTP 5xx | server |
| Fallo de red o JSON ilegible, incluido 204 sin cuerpo | network |
| Plazo agotado | timeout |
| Cancelación o acceso/cuenta/token invalidado | stale |
| JSON 2xx con contrato inválido | invalid_response |

GET acepta cualquier 2xx con JSON y contrato válidos; no se impone el requisito
201 del POST. Los errores no exponen mensajes internos del backend/provider.
Los helpers existentes de listado de vendedoras, clave idempotente y creación
de reuniones mantienen su comportamiento.

## Validación

La integración real del backend con Supabase ya fue validada en Fase 4C.1,
según el contexto confirmado del proyecto. Esta fase no contacta Supabase.
Los tests usan Auth/API reales con SDK y fetch simulados y datos sintéticos.
Cubren consulta, encoding, scope, contrato, copias/minimización, orden, estados,
modalidades, errores, cancelación en cada espera y cambios de sesión.

Ejecutar `npm run test:crm` desde frontend. `npm test` no está definido en el
package.json actual; no se modifica la configuración para añadirlo.
Resultado de esta fase: 276 pruebas aprobadas, 0 fallos (89 pruebas nuevas).
`node --check` pasó para meetings.js y crm-meetings-api.test.mjs;
`git diff --check` pasó sin errores.

## 4C.3: UI de Agenda diaria

Ruta: `/pages/crm/agenda/`, con entrada HTML propia registrada en Vite, includes
del sidebar/topbar compartidos y bootstrap en main.js. Agenda es un enlace real
para admin, agendadora y vendedora. Dashboard y Solicitudes mantienen su ruta;
los ocho módulos futuros continúan deshabilitados. crm.js sigue resolviendo
aria-current y autorización sin modificaciones.

El módulo crm-agenda.js entrega onAuthorized/onInvalidate al shell, igual que
Solicitudes. Solo consulta tras autorización de `/api/auth/me`, usando
getAgendaMeetings. No lee metadata/storage ni envía filtros de identidad.
El backend conserva toda la autoridad de scope.

### Día operativo y navegación

Hoy se obtiene con Intl.DateTimeFormat en America/Guayaquil. El selector maneja
fechas calendario, nunca Date implícitos en zona local. Los helpers de
crm-agenda-date.js calculan anterior/siguiente con aritmética UTC de calendario
y forman strings con el offset operativo actual de Ecuador continental:
`YYYY-MM-DDT00:00:00-05:00` hasta la medianoche del día siguiente, intervalo
`[from, to)`. No se convierte el día seleccionado a UTC para enviarlo.
El máximo representable del selector es 9999-12-30 para poder expresar el fin.
No se pretende reconstruir offsets históricos de Ecuador.

Anterior, Hoy, Siguiente y el input date consultan sin recargar la página.
Seleccionar de nuevo el mismo día no duplica consultas. Cambiar de día aborta
la petición anterior, incrementa una generación y limpia inmediatamente los
datos. Una respuesta o error tardíos no pueden actualizar el día nuevo.

La hora visible interpreta scheduledAt como instante mediante Intl en
America/Guayaquil; no corta el timestamp. La fecha se muestra en español.
Se mantiene exactamente el orden recibido y solo se resume el número de reuniones.

### Información, estados y accesibilidad

Cada reunión muestra hora, duración, solicitante, nombre del programa,
modalidad, vendedora, estado, teléfono y email cuando no es null. Las modalidades
conservan el vocabulario existente: En línea, Teléfono y Oficina. Los estados
son Programada, Completada, Cancelada y No asistió, siempre con texto visible.
No se muestran UUID, version, program.code, notas ni auditoría.

Todo contenido remoto se inserta con createElement/textContent. Contactos son
texto, sin acciones tel/mailto. No se usa innerHTML ni se construyen URLs con
datos del backend. Se reutilizan colores, tipografía, botones y foco del CRM.
Una sola lista semántica usa filas amplias en desktop y tarjetas en móvil;
el contacto largo puede partir líneas sin generar scroll horizontal.

Carga: mensaje y aria-busy, resultados anteriores borrados. Vacío: cero reuniones
y mensaje explícito, conservando navegación. Error: mensaje genérico y Reintentar
para la fecha vigente; el foco pasa al encabezado del día para no perderse al
ocultar ese botón. 400/unavailable, 500, network, timeout e invalid_response
permiten retry sin logout. 401/403 delegan a blockAccess del guard existente.
Stale de la consulta vigente solicita revalidación silenciosa; operaciones ya
sustituidas se descartan sin alterar la cuenta actual.

Logout, cambio de cuenta y pagehide abortan y borran la Agenda por onInvalidate.
Al regresar de bfcache el shell exige nueva autorización antes de cargar datos.
Los controles nativos tienen nombres y labels; los mensajes usan role=status
y aria-live. No se habilitan acciones para modificar reuniones.

### Preview y pruebas

Desde frontend: `node tests/preview-crm.mjs`, luego abrir
`http://127.0.0.1:4178/pages/crm/agenda/`. Este servidor solo utiliza fixtures
sintéticos; no carga Vite, archivos .env ni conexiones Supabase. Opciones de la
URL de preview: `?scenario=one`, `?scenario=empty`, `?scenario=error` y
`?scenario=loading` (demora de 10 segundos). Sin parámetro muestra cuatro reuniones.
Los parámetros de preview no forman parte de la API de producción.

Los tests de fechas cubren el cambio de día en Ecuador, mes/año, bisiestos,
rango exacto y formato de hora con offset +00:00. Las pruebas del shell ejecutan
Agenda, meetings, internal, auth y guard reales con SDK/fetch simulados:
autorización, roles, navegación, datos, XSS, orden, errores/retry, carreras entre
días y cuentas, logout, pagehide y bfcache. Se conserva la suite previa.

Validación 4C.3: `npm run test:crm` dio 321 pruebas aprobadas, 0 fallos
(45 nuevas sobre las 276 previas). node --check pasó en los ocho JS/MJS
nuevos/modificados y git diff --check no reportó errores. Preview local
inspeccionado en 1440×900 y 390×640: reuniones, vacío, error y carga legibles,
sin overflow horizontal; navegación móvil comprobada. Sin E2E remoto.

### Límites de esta fase

Vista exclusivamente diaria: sin semana/mes, búsqueda, paginación ni filtro
por vendedora. No crea, reprograma, cancela ni cambia estado de reuniones.
La validación remota previa corresponde al backend de 4C.1; esta UI se valida
localmente con mocks, sin reuniones reales ni cambios de base de datos.
