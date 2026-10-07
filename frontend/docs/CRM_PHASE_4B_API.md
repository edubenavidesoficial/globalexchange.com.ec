# Fase 4B: infraestructura API frontend de reuniones

Solo infraestructura; no integra pantallas ni inicia peticiones al importar los
módulos. Backend, Auth, configuración Supabase, locks y UI permanecen intactos.

## GET internos

`getInternal(path, access, signal, query?)` conserva sus tres argumentos previos.
El path sigue siendo relativo bajo `/api/`, sin query manual, fragmento, protocolo
ni host. El cuarto argumento es un mapa de strings; se codifica con
URLSearchParams, sin concatenar valores. Se admite undefined (sin query), un
objeto con Object.prototype del mismo contexto JavaScript o un objeto con
prototipo null. Solo se utilizan propiedades propias enumerables con valores
string; {} es válido. Date, arrays, primitivos y prototipos personalizados se
rechazan como configuration antes de consultar sesión o ejecutar fetch.
No colocar datos sensibles en query.

`getAvailableSalespeople(access, signal)` en `src/js/api/meetings.js` fija
`/api/admin/internal-users?role=vendedora&active=true`, sin recibir filtros de UI.
Devuelve el array (incluido vacío) con únicamente id, fullName y role. Valida UUID,
nombre no vacío y rol vendedora. Contratos inválidos generan `invalid_response`.

## POST e idempotencia

`createConsultationMeeting({ consultationId, idempotencyKey, payload, access,
signal })` devuelve el objeto `{ consultation, meeting }` de un 201 válido.
Comprueba UUIDs, estructura, campos requeridos y tipos básicos; rechaza campos
extra. Solo serializa date, time, timeZone, durationMinutes, mode, assignedTo y
notes opcional. No añade actor, hash ni datos de auditoría. Calendario real,
zona IANA, futuro y elegibilidad siguen siendo autoridad del backend/RPC.

El consumidor debe llamar `createMeetingIdempotencyKey()` (crypto.randomUUID)
una sola vez al iniciar un intento lógico y conservar en memoria esa clave y
una copia del payload. Cada retry del mismo intento debe usar ambos sin cambios.
Un intento nuevo puede crear otra UUID. El helper nunca genera una clave durante
el POST ni hace retry automático. No distingue creación de replay: ambos son 201.

Tras timeout, red o cancelación, el servidor podría haber confirmado la reunión.
Eso no demuestra rollback: un reintento del mismo intento mantiene clave y datos.
No conservar ni reutilizar el intento de A en la sesión de B.

`postInternal` comparte el transporte de GET y añade POST, JSON e Idempotency-Key.
Ambos usan Bearer, cache no-store, credentials omit y redirect error. No se leen
mensajes/códigos arbitrarios de respuestas de error ni se registran datos.

## Errores y coordinación

| Caso | Clasificación | Responsabilidad del consumidor futuro |
|---|---|---|
| 401 | AuthError expired | Revalidar/bloquear mediante el guard existente |
| GET 403 | AuthError denied, como antes | Mantener política previa del CRM |
| POST 403 | InternalMutationError forbidden + status 403 | Mostrar rechazo y solicitar revalidación de permisos; no cerrar sesión automáticamente |
| POST 400/404/409/422 | InternalMutationError operation + status | Error de operación, conservar sesión |
| POST 5xx | InternalMutationError server + status | Error del servidor, conservar sesión |
| POST éxito distinto de 201, JSON ilegible/vacío en 201 o contrato inválido | invalid_response | No presentar confirmación |
| Entrada local inválida | invalid_input | Corregir antes de enviar |
| Fallo de fetch (o JSON ilegible en GET, contrato previo) | AuthError network | Resultado no confirmado; retry explícito |
| Plazo agotado | AuthError timeout | Resultado no confirmado |
| Cancelación o acceso/cuenta/token cambiado | AuthError stale | Descartar resultado; no afectar otra sesión |

Un 403 de POST puede venir de authenticate/authorize sin código o de la RPC como
ACTOR_NOT_ALLOWED. No demuestra por sí solo que la sesión deba cerrarse. Esta
infraestructura no ejecuta logout, blockAccess, refresh ni revalidate; devuelve
errores controlados al consumidor. Los errores de operación se distinguen por
status HTTP, sin exponer texto o detalles del proveedor. En POST solo se intenta
leer JSON para 201; cualquier otro 2xx se rechaza sin leer el cuerpo. La
clasificación se entrega después de confirmar la sesión, conservando prioridad
de stale y cancelación/timeout durante las esperas.

El timeout total sigue siendo 15 segundos. La espera cancelable abarca getSession
inicial/final, fetch y lectura JSON, incluso si una promesa ignora AbortSignal.
Cancelar la espera no cancela Auth ni libera sus Web Locks. Se conserva el orden
de coordinación original. Cuenta, token, access.isCurrent y señales se comprueban
antes y después del transporte; un 401 tardío de A también se descarta como stale.
La futura UI debe además comprobar su generación/acceso al aplicar el resultado,
como hace la bandeja actual, y abortar su señal al navegar o invalidarse.

Tokens, claves, notas y payloads no se guardan por estos helpers en storage,
datasets ni URLs. Se mantienen únicamente durante la operación en memoria;
la persistencia Auth preexistente del SDK no cambia.

## Validación

`npm run test:crm` ejecuta la suite anterior y `crm-meetings-api.test.mjs`.
150 pruebas: las 130 anteriores (actualizando JSON inválido 201 al contrato
invalid_response solicitado) y 20 regresiones para forma de query y respuestas.
Los módulos Auth/API reales se prueban
con SDK/fetch simulados, sin cargar .env ni contactar Supabase. Cubren query,
contratos, minimización, POST exacto, retry/replay, errores, cancelación, timeout
en todas las esperas, cuenta/token cambiado, respuestas tardías y conservación
del turno Auth. No se ejecuta preview ni build que cargue configuración local.
