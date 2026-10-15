# Fase 4D.1C: API frontend de reprogramación

Los apartados iniciales describen el estado histórico de 4D.1C, anterior a
4D.1D: implementación local de la capa API, todavía sin botón, modal, formulario
ni cambios en Agenda. Esa validación de 4D.1C no acreditaba E2E frontend/browser
ni ejecutaba PATCH real, SQL o llamadas a Supabase. La UI y su validación real
posterior se documentan en los apartados de 4D.1D al final de este archivo.

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
Un 409 MEETING_VERSION_CONFLICT exige recargar Agenda en la UI prevista para
4D.1D (ya implementada, descrita más abajo); un
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

## 4D.1D — Reprogramación desde Agenda

Estado: **APROBADO PARA COMMIT 4D.1D**. E2E real y regresión final completados.
Sin staging ni commit.
Estado inicial revalidado: rama `migracion-vite`, HEAD `448ad8c`, working tree
limpio. Baseline ejecutada antes de editar: **527/527**, cero fallos.

La acción `Reprogramar` se renderiza solo para admin/agendadora autorizados por
Express a través del shell y reuniones `scheduled`. Vendedora y los estados
completed/cancelled/no_show no tienen acción. El handler vuelve a comprobar
la capacidad, autorización y generación de la vista; el diálogo también comprueba
rol/estado. Esto es UX: la autorización real sigue siendo responsabilidad del backend.

El componente nativo `dialog` usa showModal (top layer/fondo inerte del navegador),
título asociado, labels, primer foco en fecha, mensajes aria-live, estados busy y
botones nativos. Cancelar/Escape cierran y devuelven foco al botón de origen cuando
es seguro; durante envío o resultado incierto están bloqueados. Tras refresh el
foco se lleva al encabezado estable del día. CSS limita ancho/alto y permite scroll
y acciones en varias líneas. Contexto de cliente, programa, vendedora, estado y
horario se inserta mediante textContent. No se muestran UUID, versión o clave.

La Agenda conserva su agrupación/horarios de Ecuador. El formulario preserva
`meeting.timeZone`, que se informa al usuario sin selector editable. El prefill
usa Intl.DateTimeFormat con esa zona explícita, calendario gregoriano y dígitos
latinos, sin derivar fecha local de toISOString ni de la zona del equipo. Envía
date YYYY-MM-DD y time HH:mm. Si el navegador no puede representar la zona, bloquea
el envío sin inventar una conversión; PostgreSQL sigue siendo autoridad temporal.

Se captura `meeting.version` al abrir. Solo el primer submit válido genera una
clave con createMeetingIdempotencyKey. El intento guarda meetingId, clave y
payload congelado en memoria; no usa storage. El payload contiene exactamente
date, time, timeZone, durationMinutes, mode y expectedVersion. La UI comprueba
estructura, requeridos, modalidad y duración entera positiva, sin máximo comercial
ni comprobación del futuro o de la versión remota. El flag de envío se fija antes
del await y evita dobles submits. No se modificó la API de 4D.1C.

| Resultado | Comportamiento |
|---|---|
| Éxito | Cierra, borra intento/contexto, consulta de nuevo el día actualmente seleccionado. Si la reunión pasó de A a B, permanece en A y la lista nueva decide si desaparece. |
| network/timeout/server/invalid_response u otro resultado desconocido | Conserva clave, payload y versión; bloquea campos, Cancelar y Escape. Reintentar envía exactamente el mismo intento. |
| Descartar incierto | Limpia y fuerza GET antes de otra apertura. No supone que el cambio anterior se haya revertido. |
| 400/422 corregible | Libera el intento y permite corregir; el siguiente submit crea una clave nueva. |
| MEETING_NOT_IN_FUTURE / INVALID_TIME_ZONE / INVALID_LOCAL_TIME | Mensajes locales útiles sin exponer códigos ni detalles del proveedor; permiten corrección con clave nueva. |
| 404/409, incluidos MEETING_VERSION_CONFLICT, IDEMPOTENCY_KEY_REUSED, MEETING_NOT_FOUND y MEETING_NOT_SCHEDULED | Cierra, borra intento y fuerza GET. Nunca cambia versión o reintenta mutación automáticamente. |
| Fallo del GET requerido | Mantiene bloqueo, lista vacía y Reintentar para el GET. Solo un GET exitoso permite otro intento. |
| 403 | Bloquea reprogramación para la autorización actual, incluso tras navegar/recargar el día. No ejecuta logout. Una nueva autorización del shell restablece la capacidad. |
| 401 / stale | Limpia y delega respectivamente en blockAccess/revalidate del shell. |

Agenda conserva generation/AbortController. Refresh invalida el GET anterior;
el handler de una tarjeta antigua no puede abrir tras otra generación. Cambiar
de día limpia/aborta el diálogo antes de cargar. Account switch, logout y pagehide
limpian formulario/contexto/intento; BFCache necesita autorización y carga nuevas.
Una respuesta tardía de A no puede cerrar el diálogo, anunciar resultados ni
recargar la Agenda de B. Abortar localmente no implica rollback remoto; el GET
y la comprobación de versión del backend siguen siendo necesarios.

### Validación automatizada de 4D.1D y límites

Resultado previo al reinicio de `npm run test:crm`: **566 pruebas, 566 aprobadas,
0 fallos**; se mantienen las
527 regresiones anteriores y se añaden 39. De ellas, 35 usan Agenda/diálogo reales
con API mock para roles/estados, prefill (UTC en otro día y zona distinta a Ecuador),
payload/acceso/signal exactos, versión capturada, keys, doble submit, éxito/cambio
de día, resultados inciertos, descarte, errores corregibles y conflictos con GET
fallido, 401/403/stale, respuestas tardías, XSS y accesibilidad DOM. Otras cuatro
ejecutan shell/Auth/API reales con SDK/fetch simulados para éxito, logout, cambio
de cuenta y pagehide/BFCache durante PATCH simulado.

`node --check` aprobado para crm-agenda.js, crm-reschedule-dialog.js,
crm-agenda-ui.test.mjs y crm-shell.test.mjs. `git diff --check` aprobado y diff
revisado. No se modificaron backend, SQL, migraciones, Supabase ni contratos API.
Durante esa validación automatizada no se contactaron servicios remotos ni se
crearon datos o ejecutó PATCH real. No se ejecutó git add, commit o push.

Esa validación es frontend con mocks/fakes y DOM simulado. No demuestra concurrencia
de PostgreSQL, idempotencia persistida, E2E HTTP remoto ni E2E browser. jsdom simula
showModal/close: top layer, foco atrapado, teclado real y apariencia responsive
requieren observación en navegador, documentada a continuación sin atribuir a
jsdom esas propiedades.

### E2E real y recuperación tras reinicio — cierre 2026-10-15

Se validó el success path con sesión admin en el navegador integrado real,
Vite y Express iniciados explícitamente desde las carpetas del proyecto. Se
utilizó exclusivamente el fixture `TEST 4D1D BROWSER DIAG E2E`, con programa,
admin y vendedora existentes solo como referencias de lectura. No se modificaron
reuniones ni solicitudes reales, internal_users o programs.

El único submit se realizó mediante el botón del diálogo. Cambió del día A,
2026-10-21 a las 10:30, 45 minutos y online, al día B, 2026-10-22 a las 15:30,
60 minutos y phone, en America/Guayaquil. Las fechas se calcularon como futuras
al preparar el fixture. El transporte observado en Vite y Express confirmó
PATCH HTTP 200, JSON válido y version numérica 2, en aproximadamente 2 segundos.
El instante recibido fue `2026-10-22T20:30:00+00:00`. No hubo retry ni replay.
El diálogo mostró busy y submit deshabilitado durante la petición; al terminar
se cerró, Agenda refrescó el día A y la reunión desapareció sin navegar a B.

Antes del reinicio se verificaron por SELECT version 2, audit 1, idempotency 1
y campos preservados. Tras el apagado se abrió una conexión PostgreSQL nueva,
se buscó por marker/email sintéticos y se recuperó exactamente una consultation
y su meeting. Se confirmó de nuevo version 2, duration_minutes 60, mode phone,
status scheduled, time_zone America/Guayaquil, instante B y consultation converted;
exactamente un evento meeting_rescheduled y un registro de
reschedule_consultation_meeting. Resultado:
`RECOVERED_FIXTURE_VALID_VERSION_2_AUDIT_1_IDEMPOTENCY_1`.

Agenda B se verificó nuevamente mediante el control real de fecha: una tarjeta
con 15:30, 60 minutos, Teléfono y Programada, sin UUID, versión, clave o hash
visibles. Escritorio 1440×900 y móvil 390×844 resultaron utilizables. En móvil,
el diálogo mostró el prefill actualizado y foco inicial en Fecha; su contenido
no excedió horizontalmente el ancho disponible. El desplazamiento permitió
alcanzar los botones; Tab llevó el foco a Cancelar y esa acción cerró el diálogo
y devolvió el foco a Reprogramar. No se envió el formulario durante la recuperación.
No se observó PATCH en Vite/Express y una nueva lectura mantuvo version 2,
audit 1 e idempotency 1. Las capturas redactadas se conservaron fuera del repositorio.

El cleanup revalidó marker e identidad de la relación, eliminó exclusivamente
idempotency, audit, meeting y consultation del fixture en una transacción y
comprobó tras COMMIT: **consultation=0, meeting=0, audit=0, idempotency=0**.
El worker terminó y retiró la contraseña de su entorno. No se guardaron secretos.

Límites: no se acredita browser E2E de agendadora/vendedora, conflicto remoto en
navegador, concurrencia simultánea ni replay idempotente real en esta ejecución.
El primer intento anterior quedó incierto y su causa no pudo reconstruirse;
el éxito del segundo no demuestra la causa del primero. La observación de
Tab/Shift+Tab y del diálogo nativo no se presenta como prueba de un focus trap
completo. Sigue pendiente el LOW de ampliar tests permanentes para conflicto
seguido de GET sin reunión o con estado terminal; no se añadieron pruebas ni
se modificó código de producción durante este diagnóstico y recuperación.

### Regresión final del cierre: 566/566

El 2026-10-15 se reprodujeron los dos fallos temporales de
`Agenda UI: día A tardío ... nunca sobrescribe B` en crm-shell.test.mjs.
La fecha fija de A coincidía con Hoy y la deduplicación correcta del mismo día
evitaba el GET que las pruebas esperaban.

Se estabilizaron ambas variantes derivando A y B del día inicial de Agenda
mediante el helper calendario existente shiftAgendaDay: +1 y +2 días.
No se suman intervalos de 24 horas ni se depende del timezone del computador.
Se conservan las esperas y assertions: petición pendiente de A, navegación a B,
abort de A y ausencia de sobrescritura/error tras su respuesta o fallo tardío.
No se cambió código de producción ni se repitió el E2E remoto.

Tests específicos: **2/2**, cero fallos. Suite completa: **566 tests, 566 pass,
0 fail**. Los cuatro node --check y git diff --check pasaron. Se mantiene la
evidencia E2E y cleanup en cero documentada arriba, con sus limitaciones reales.
Resultado: **APROBADO PARA COMMIT 4D.1D**, sin git add, commit ni push.
