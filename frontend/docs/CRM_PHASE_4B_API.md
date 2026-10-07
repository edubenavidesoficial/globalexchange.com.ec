# Fase 4B: API frontend y UI de reuniones (4B.4C)

La infraestructura API se integra ahora con Solicitudes mediante el diálogo
Agendar reunión. Importar los módulos no inicia peticiones. Backend,
configuración Supabase y locks permanecen intactos; el guard expone también el
perfil validado por Express en el contexto autorizado.

## UI de Solicitudes · Fase 4B.4C

Agendar reunión aparece solo para admin/agendadora según `/api/auth/me` y filas
pending. No usa metadata, storage ni datasets como autoridad. Vendedora y filas
converted/cancelled no muestran acción. Esta restricción es UX de esta fase:
no define ni implementa el workflow de reuniones posteriores. El backend sigue
siendo autoridad de permisos, calendario y elegibilidad.

El dialog nativo tiene título, labels, mensajes live y aria-busy. Solo muestra
solicitante y programa como contexto. Prefill: fecha preferida válida, hora HH:mm
y modalidad válida. Envía date, time, timeZone, durationMinutes, mode, assignedTo
y notes. America/Guayaquil es fija; 45 minutos es un default UX editable que se
envía explícitamente. No serializa la solicitud completa ni añade auditoría.

Al abrir carga vendedoras activas con getAvailableSalespeople. Presenta UUID y
fullName, sin email ni fallback. Loading deshabilita selector/confirmación;
el vacío muestra «No hay vendedoras disponibles.» y no permite confirmar.
Los errores recuperables ofrecen reintento; los errores Auth delegan al guard.

Cada intento captura un payload congelado y una crypto.randomUUID. No admite
doble submit. Red, timeout, server e invalid_response son resultados inciertos:
retry conserva exactamente la misma key y el mismo payload sin releer inputs.
Se bloquean edición, Cancelar y Escape durante POST o incertidumbre. Descartar
advierte que no cancela una reunión persistida y exige recargar la bandeja.
400/422 permiten corregir con nueva clave; POST 403 conserva sesión y bloquea
las acciones para esa autorización. 401 utiliza el mecanismo CRM existente.

404/409 activan refreshRequired en memoria en crm-consultations.js, no solo en
el diálogo. Todas las acciones de agendamiento quedan bloqueadas incluso si se
cierra con Cancelar/Escape, se reabre o se altera disabled en el DOM. El diálogo
conserva su mensaje seguro y ofrece Actualizar bandeja. Descartar un intento
incierto reutiliza esta obligación de recarga; el retry incierto no la activa.
refreshRequired solo se limpia tras GET /api/admin/consultations exitoso, con
contrato válido y acceso/generación vigentes, antes de reconstruir las filas.
No se limpia al iniciar la carga ni ante error, timeout o resultado stale.
La invalidación elimina todo estado de la cuenta anterior, incluida esta bandera;
B obtiene su propia autorización y carga, sin heredar bloqueos de A.

Las recargas iniciadas desde el diálogo enfocan el heading estable Solicitudes
(tabindex=-1) durante la carga y después de éxito/error si el acceso sigue vigente.
Cancelar normal devuelve el foco al opener conectado y habilitado; cuando ya
no lo está se usa el heading. Un 201 limpia intento/formulario, anuncia éxito y
recarga por el flujo existente, sin asignar converted manualmente en producción.
El modal conserva scroll interno y el diseño adaptable existente.

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

| Caso | Clasificación | Responsabilidad del consumidor |
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
La UI comprueba su generación/acceso al aplicar el resultado y aborta su señal
al navegar o invalidarse.

Tokens, claves, notas y payloads no se guardan por estos helpers en storage,
datasets ni URLs. Se mantienen únicamente durante la operación en memoria;
la persistencia Auth preexistente del SDK no cambia.

## Validación

`npm run test:crm` ejecuta la suite anterior y `crm-meetings-api.test.mjs`.
Última ejecución: 187 pruebas, 187 pass, 0 fail. Incluye las 150 de infraestructura,
26 de UI y 11 regresiones de esta corrección: 404/409 con Cancelar/Escape,
bloqueo entre filas y ante cambios DOM, recarga fallida por red/server/timeout,
foco durante/después de recargar, aislamiento A → B y mock 201 por consultationId.
El mock actualiza solo la solicitud confirmada y conserva otra pending y una
cancelled. La mini auditoría de cierre/reapertura y recuperación se reproduce
en memoria mediante estos tests, sin reuniones reales.
Los módulos Auth/API reales se prueban
con SDK/fetch simulados, sin cargar .env ni contactar Supabase. Cubren query,
contratos, minimización, POST exacto, retry/replay, errores, cancelación, timeout
en todas las esperas, cuenta/token cambiado, respuestas tardías y conservación
del turno Auth. No se ejecuta preview ni build que cargue configuración local.
