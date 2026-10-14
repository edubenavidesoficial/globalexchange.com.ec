# Fase 4D.1C: API frontend de reprogramación

Implementación local de la capa API. NO existe todavía UI de reprogramación:
sin botón, modal, formulario ni cambios en Agenda. Esta fase no acredita E2E
frontend/browser ni ejecuta PATCH real, SQL o llamadas a Supabase.

## Función pública

Exportada desde `src/js/api/meetings.js`:

```js
const meeting = await rescheduleMeeting({
    meetingId,
    idempotencyKey,
    payload: {
        date: '2028-02-29',
        time: '10:30',
        timeZone: 'America/Guayaquil',
        durationMinutes: 45,
        mode: 'online',
        expectedVersion: 2,
    },
    access,
    signal, // Opcional; access.signal sigue siendo obligatorio.
});
```

Solo admite meetingId, idempotencyKey, payload, access y signal. Se rechazan
propiedades propias adicionales, símbolos y accesores; los campos requeridos
deben ser propios. No acepta scope, identidad, rol, URL ni query del caller.
Payload tiene exactamente los seis campos del ejemplo, todos obligatorios.
Se construye una copia explícita antes de esperar Auth, sin mutar inputs/access.

Meeting ID y clave requieren UUID completo, sin trim ni controles, y se envían
en lowercase. Fecha YYYY-MM-DD y hora HH:mm se validan estructuralmente como en
creación; la hora admite 00:00–23:59. Zona es string no vacía, duración y versión
son enteros positivos sin coerción; mode es online, phone u office. No se añade
normalización de modalidad/zona distinta de la API de creación.

Calendario real, rango PostgreSQL integer, IANA, futuro, disponibilidad, estado
y versión actuales siguen siendo autoridad del backend/PostgreSQL. El frontend
no consulta la meeting ni incrementa expectedVersion. El caller proporciona la
versión obtenida de Agenda y decide cuándo recargarla.

## Transporte y sesión

Una llamada a `PATCH /api/admin/meetings/<meetingId>/schedule`, sin query,
con Authorization Bearer, Content-Type application/json e Idempotency-Key.
Solo se serializa el payload mínimo; nunca actor, rol, hash, notas o asignación.

`internal.js` incorpora patchInternal y comparte el constructor privado de
mutations con postInternal. POST conserva éxito exclusivo 201; PATCH exige 200.
GET mantiene su semántica anterior. No hay otro mount, autenticación paralela,
lectura manual de storage ni dependencia del rol en metadata.

Se conservan cache no-store, credentials omit, redirect error y timeout total
de 15 segundos. Señales del guard/caller/timeout se combinan. Auth inicial/final,
fetch y JSON tienen esperas cancelables, incluso si la promesa subyacente ignora
AbortSignal. Cancelar la espera no libera locks de Auth aún pendientes.
Cuenta, token y guard se comprueban antes/después del transporte; resultados de
A no se entregan a B, incluido un código de conflicto leído durante el cambio.
La API no hace logout, refresh explícito, navegación, blockAccess ni revalidate.

## Respuesta

Solo 200 con JSON válido y data objeto es éxito. 201/202/204/206 son
invalid_response sin intentar interpretar su body. El retorno es un objeto
nuevo, sin el envelope data, con exactamente:

```text
{ id, consultationRequestId, scheduledAt, timeZone,
  durationMinutes, mode, status, version }
```

UUID válidos, id correspondiente al solicitado, scheduledAt estructural con
segundos y zona explícita (fracción/offset admitidos, incluido PostgreSQL con
microsegundos), timeZone no vacía, duración/versión enteros positivos, modalidad
válida y status scheduled son obligatorios. Se reutiliza el validador de
timestamp de Agenda; no se vuelve a calcular el calendario o instante remoto.
Campos faltantes o tipos inválidos rechazan toda la respuesta. Extras del
backend, incluso objetos nested, se descartan; no se devuelve la referencia
bruta ni se guardan respuestas en storage.

## Errores y códigos de dominio

Se conserva `error.code` como clasificación existente y `error.message` genérico.
Los errores de mutation conservan status HTTP cuando procede. Solo PATCH añade
`error.domainCode` opcional, distinto de code para no romper consumidores:

| Caso | error.code |
|---|---|
| Entrada local inválida | invalid_input |
| HTTP 401 | expired |
| HTTP 403 | forbidden |
| HTTP 400/404/409/422 | operation |
| HTTP 5xx | server |
| Fallo fetch | network |
| Timeout | timeout |
| Abort o sesión/token/guard invalidado | stale |
| 200 ilegible/contrato inválido u otro 2xx | invalid_response |

Allowlist exacta, vinculada a HTTP:

| HTTP | error.domainCode permitido |
|---|---|
| 404 | MEETING_NOT_FOUND |
| 409 | MEETING_VERSION_CONFLICT, IDEMPOTENCY_KEY_REUSED, MEETING_NOT_SCHEDULED |
| 422 | MEETING_NOT_IN_FUTURE, INVALID_TIME_ZONE, INVALID_LOCAL_TIME |

Un código desconocido, mal tipado o incompatible con HTTP se omite. No se
propagan message/details/hint/stack/SQLSTATE ni respuesta bruta. JSON ilegible
en errores de operación conserva la clasificación por HTTP. Leer ese JSON
también respeta timeout/abort y la comprobación final de sesión. POST no añade
domainCode ni empieza a leer bodies de error; sus consumidores siguen iguales.

## Idempotencia y recuperación

La API nunca genera meetingId, clave ni versión. Se conserva
createMeetingIdempotencyKey() sin alias: su contrato ya es crypto.randomUUID().
El caller puede utilizarlo una vez por intento lógico y conservar clave/payload
en memoria. No hay retries automáticos. Dos llamadas explícitas con los mismos
valores envían el mismo comando, sin demostrar por ello idempotencia DB.

Network, timeout, server o invalid_response pueden ocurrir después de un commit
remoto. El retry explícito mantiene clave, payload y expectedVersion exactos.
Un 409 MEETING_VERSION_CONFLICT exige recargar Agenda en la UI futura; un
IDEMPOTENCY_KEY_REUSED no genera otra clave automáticamente. Una nueva clave
corresponde a un nuevo intento decidido por el caller. Cancelar no prueba rollback.
Los intentos de A nunca deben reutilizarse en B.

## Validación local

Baseline antes de cambios: 321 pruebas CRM aprobadas, 0 fallos. Se utiliza el
harness existente con Auth/API reales y SDK/fetch simulados, sin configuración
real ni servicios remotos. Las pruebas añadidas cubren request exacto, rechazo
local sin fetch, whitelist, status, códigos seguros, carreras durante Auth/fetch/
JSON, abort/timeout, conservación de locks y retry explícito sin mutación de inputs.
Se mantienen las regresiones de creación, generador de claves, listado de
vendedoras y Agenda. No se ejecuta preview/browser ni E2E frontend remoto.

Resultado final de `npm run test:crm`: 527 pruebas, 527 aprobadas, 0 fallos
(206 nuevas sobre la base de 321).
