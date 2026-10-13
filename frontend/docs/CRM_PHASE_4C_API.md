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
