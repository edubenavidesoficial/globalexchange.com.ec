# Fase 4D: reprogramación de reuniones

Migración `20261013211621_reschedule_meeting_workflow.sql` aplicada correctamente
a Supabase remoto; historial local/remoto alineado en 4D.1A. El endpoint Express
`PATCH /api/admin/meetings/:id/schedule` está implementado localmente en 4D.1B.
No hay cambios frontend ni en la RPC histórica de creación.

## Contrato RPC

```text
public.reschedule_consultation_meeting(
  p_actor_id uuid, p_meeting_id uuid, p_idempotency_key uuid,
  p_request_hash text, p_expected_version integer,
  p_scheduled_date date, p_scheduled_time time without time zone,
  p_time_zone text, p_duration_minutes integer, p_mode text
) returns jsonb
```

El endpoint HTTP admite admin/agendadora y rechaza vendedora antes de RPC.
El actor deriva del perfil interno autenticado; la DB vuelve a exigir
actor activo admin/agendadora bajo FOR SHARE, incluso para replay. El backend
con service_role es la frontera de confianza: no aceptar actor ni hash del cliente.

Reprogramar actualiza la MISMA meeting, exclusivamente scheduled. No resucita
completed/cancelled/no_show. Cambian scheduled_at, time_zone, duration_minutes,
mode, updated_by, updated_at y version. Permanecen id, consultation_request_id,
assigned_to, created_by, created_at, status y notes. Mode sí puede cambiar.
No se revalida elegibilidad de la asignada histórica porque no hay reasignación.
La solicitud debe estar converted y no se modifica, tampoco su updated_at.

expectedVersion debe ser entero positivo y coincidir bajo lock con version.
Cada comando nuevo exitoso incrementa exactamente N → N+1, aun si los valores
operativos son iguales. updated_by es el actor y updated_at usa clock_timestamp().
Version 2147483647 falla con INTERNAL_ERROR sin envolver ni reiniciar el contador.

## Orden, concurrencia e idempotencia

1. Exigir READ COMMITTED y validar identificadores/hash no nulos/no vacío.
2. Advisory transaction lock por operation/actor/key, sin advisory por meeting.
3. Actor FOR SHARE; validar active/role antes de recuperar cualquier resultado.
4. Buscar (actor_id, operation, idempotency_key). Hash diferente: conflicto.
   Validar fotografía persistida: ocho campos, tipos, UUID, timestamp finito,
   enteros positivos, versión >=2, estado/modalidad y relación con el registro.
   Otro meeting ID: conflicto. Fotografía malformada: INTERNAL_ERROR.
   Retornar el resultado original sin consultar el estado actual de la meeting.
5. Sin replay, validar versión/duración positivas, fecha finita, hora <24:00,
   modalidad; los tipos PostgreSQL también validan entradas antes de la función.
6. Leer el ID del padre; bloquear padre FOR UPDATE, después meeting FOR UPDATE.
   Revalidar existencia y relación. No confiar en la primera lectura para escribir.
7. Validar scheduled, expectedVersion, padre converted y capacidad de incrementar.
8. Validar zona, convertir fecha/hora, comprobar round-trip y futuro tras locks.
9. UPDATE con RETURNING, un audit, un registro idempotente y retornar la fotografía.

Operation nueva: `reschedule_consultation_meeting`. La clave UUID es obligatoria;
no se genera en DB. La RPC compara/persiste exactamente el hash recibido, sin
recalcularlo. Sigue el requisito actual de hash no vacío. En 4D.1B se calcula SHA-256
UTF-8 de JSON.stringify de un objeto normalizado con orden fijo:
meetingId, expectedVersion, date, time, timeZone, durationMinutes, mode.
UUID lowercase; actor y clave fuera del hash. No cambiar ese contrato después
de persistir claves sin contemplar los replays históricos.

Dos llamadas con misma clave/hash se serializan incluso sin registro previo:
una actualiza 1→2, la otra recupera versión 2 sin nuevo audit ni incremento.
Otra clave con expectedVersion=1 espera el lock y encuentra versión 2: conflicto.
Misma clave con otro hash: IDEMPOTENCY_KEY_REUSED sin efectos adicionales.
El replay precede estado/versión/fecha/padre mutables: puede recuperar una
fotografía antigua aunque ahora la fecha sea pasada o la reunión esté terminada.
Actor revocado no puede recuperarla. No se persisten errores ni reservas pendientes.

Una llamada es una transacción; un fallo de auditoría o idempotencia revierte el
UPDATE y todos sus efectos. Locks hasta commit/rollback. Usar una operación por
transacción. Futuras mutaciones de lifecycle deben seguir padre → meeting y
comparar/incrementar versión. No hay locking JavaScript ni retry automático.

## Tiempo e integridad

Zona exacta de pg_catalog.pg_timezone_names; fecha + hora AT TIME ZONE.
Round-trip rechaza horas inexistentes; horas ambiguas conservan la decisión de
PostgreSQL usada en creación. Se exige futuro respecto a now() y clock_timestamp()
después de esperar los locks. No se añaden reglas comerciales ni máximo de duración
distinto del integer positivo existente. No se validan fechas antes del replay.

Se conserva meetings_one_scheduled_per_consultation_idx. Solo una unique_violation
identificada por ese nombre se traduce a CONSULTATION_ALREADY_SCHEDULED.
Otros errores de integridad se propagan y se sanitizan en el adaptador HTTP.

## Auditoría y respuesta

Un evento meeting/meeting_rescheduled con actor interno, entity_id de la meeting
y operation_id UUID nuevo, independiente de la clave. Metadata camelCase exacta:
oldScheduledAt/newScheduledAt, oldTimeZone/newTimeZone,
oldDurationMinutes/newDurationMinutes, oldMode/newMode, previousVersion/newVersion.
Sin contactos, notas, tokens, clave ni hash. No se emite consultation_converted.

Respuesta y response_payload son el mismo JSONB:

```text
{ id, consultationRequestId, scheduledAt, timeZone,
  durationMinutes, mode, status: "scheduled", version }
```

No contiene assignedTo, notas, actores, auditoría ni idempotencia. El registro
guarda actor, operation, clave, hash, ID del padre y esa fotografía original.
El endpoint HTTP responde 200 con {data: resultado} tanto en éxito como en replay.
La futura UI debe volver a consultar Agenda, sin incrementar versión localmente.

## Errores y seguridad

Contrato existente: SQLSTATE P0001 y message igual al código estable, sin PII:

- ACTOR_NOT_ALLOWED
- MEETING_NOT_FOUND
- MEETING_NOT_SCHEDULED
- MEETING_VERSION_CONFLICT
- IDEMPOTENCY_KEY_REUSED
- CONSULTATION_STATE_INCONSISTENT
- CONSULTATION_ALREADY_SCHEDULED
- INVALID_TIME_ZONE
- INVALID_LOCAL_TIME
- MEETING_NOT_IN_FUTURE
- INVALID_MEETING_INPUT
- INVALID_REQUEST
- WORKFLOW_ISOLATION_NOT_SUPPORTED
- INTERNAL_ERROR (fotografía corrupta o versión agotada)

El adaptador HTTP reconoce códigos por lista cerrada, con SQLSTATE P0001;
jamás interpreta texto libre ni reenvía detalles SQL.
Errores de casteo previos a la función e integridad desconocida también requieren
sanitización. No se incluyen payloads o valores sensibles en mensajes de la RPC.

SECURITY INVOKER, VOLATILE, search_path=pg_catalog,pg_temp y timezone=UTC.
REVOKE ALL sobre la firma exacta a PUBLIC/anon/authenticated/service_role;
GRANT EXECUTE solo a service_role. Las tablas permanecen bajo RLS sin políticas
nuevas. Los grants existentes ya permiten SELECT/locks de actor y padre,
SELECT/UPDATE meetings, INSERT audit_events y SELECT/INSERT idempotency_records.
No se amplían permisos de tablas ni se conceden mutaciones al navegador.

Los checks audit_events_entity_action_valid e idempotency_records_operation_valid
se amplían mediante DROP/ADD conservando todas las combinaciones anteriores.
Aplicar la migración completa mediante runner transaccional, no por fragmentos.
Service_role sigue siendo privilegiado y puede eludir el workflow mediante
escrituras directas; ninguna garantía de auditoría cubre ese uso indebido.

## Validación local inicial

Revisión completa de SQL, firma/grants, nombres contra migraciones históricas,
orden de locks/replay, campos del UPDATE y ausencia de mutaciones fuera de RPC.
No existe una suite SQL estática persistida en el proyecto. Se comprueban también
invariantes estáticos locales y se ejecuta npm test backend sin cambios HTTP.

Resultado: 12 comprobaciones estáticas en memoria aprobadas y 265 tests backend
aprobados, 0 fallos. El primer intento HTTP fue bloqueado por el sandbox (EACCES
en loopback); la repetición autorizada fuera de esa restricción pasó completa.
No se añadieron tests HTTP ni dependencias. git diff --check y la comprobación
equivalente de los dos archivos nuevos no encontraron errores de whitespace.

La revisión inicial fue estática, sin ejecutar PostgreSQL. Posteriormente se
encontró psql 18.6 ya instalado fuera de PATH; no se instalaron herramientas.

## Aplicación remota y smoke tests

Supabase CLI 2.120.0 confirmó historial sin divergencias y dry-run con únicamente
esta migración. db push linked con skip-vault la aplicó correctamente, sin seeds
ni roles adicionales. El historial posterior confirmó la versión en local/remoto.
La RPC quedó compilada e invocable desde el cliente backend con service_role.

Smoke admin con target aleatorio comprobado inexistente: MEETING_NOT_FOUND.
Smoke vendedora activa con otro target inexistente: ACTOR_NOT_ALLOWED.
Ambos dejaron cero eventos de auditoría y registros de idempotencia para sus
identificadores. No se reprogramó ninguna reunión existente.

## 4D.1A.2: camino exitoso remoto con rollback

Prueba ejecutada por el usuario desde psql 18.6, conectado por SSL a PostgreSQL
17.6, mediante un script temporal sin credenciales fuera del repositorio.
La salida completa de la terminal confirmó VALIDATION_4D_1A_2_PASS.

El precheck read-only confirmó admin y vendedora activos y un programa activo.
Dentro de una única sesión/transacción BEGIN READ COMMITTED, con SET LOCAL ROLE
service_role, se insertaron una solicitud converted y una meeting scheduled
completamente sintéticas. Usuarios y programa existentes solo se referenciaron
como FK, sin modificarlos. Los hashes SHA-256 lowercase se calcularon en Node
sobre JSON.stringify con el orden canónico documentado, sin actor ni clave.

Verificaciones aprobadas:

- RPC exitosa: misma meeting, versión 1→2, nuevo instante, duración 45→60 y
  modalidad online→phone. time_zone, updated_by y updated_at correctos.
- Respuesta JSONB exacta de ocho campos, sin campos adicionales.
- Todos los campos fuera de la whitelist del UPDATE permanecieron idénticos;
  la fila completa de consultation_requests permaneció idéntica y converted.
- Exactamente un meeting_rescheduled: actor, operation_id UUID y metadata
  old/new exactos; sin PII, notas, clave ni hash.
- Exactamente un registro idempotente K1 con hash, solicitud y response_payload
  iguales al resultado original.
- Replay con expectedVersion=1 devolvió exactamente la respuesta original:
  versión siguió 2, audit=1 e idempotencia=1, sin cambios en la fila.
- Misma K1 con duración 75 y hash distinto: IDEMPOTENCY_KEY_REUSED.
- K2 nueva con expectedVersion=1: MEETING_VERSION_CONFLICT, sin registro K2.
- Ambos errores se capturaron en subbloques verificando P0001 y código exacto;
  después se comprobaron filas y conteos sin cambios adicionales.

Se ejecutó ROLLBACK, nunca COMMIT. SELECT posteriores fuera de la transacción
confirmaron cero solicitudes, reuniones, eventos y registros idempotentes para
los identificadores del fixture. No quedó ningún fixture sintético persistido
ni se modificó ninguna reunión real. El caso opcional de estado terminal se omitió.

## 4D.1B Endpoint Express

Implementado localmente: `PATCH /api/admin/meetings/:id/schedule` dentro del router
meetings ya montado. Cadena: authenticate → authorize('admin', 'agendadora') →
controller → service → repository → una RPC `reschedule_consultation_meeting`.
Vendedora recibe 403 antes del controller; sin token/token inválido recibe 401,
y sin perfil/perfil inactivo recibe 403. Actor exclusivamente desde `req.user.id`.

Se exige `Content-Type: application/json`, también con `charset=utf-8`.
`:id` y la única cabecera `Idempotency-Key` deben ser UUID completos, normalizados
a lowercase sin trim. Los duplicados se detectan en rawHeaders sin distinguir
mayúsculas. Ausencias, valores inválidos y duplicados no llegan a RPC.

Objeto JSON plano obligatorio, con exactamente estos seis campos:

```json
{
  "date": "2027-01-20",
  "time": "10:30",
  "timeZone": "America/Guayaquil",
  "durationMinutes": 45,
  "mode": "online",
  "expectedVersion": 1
}
```

Fecha gregoriana real YYYY-MM-DD, años 0001–9999; hora HH:mm entre 00:00 y 23:59.
Zona estructural: trim, 1–100 caracteres, sin controles; modalidad con trim:
online/phone/office. Duración y expectedVersion son enteros 1–2147483647 sin
coerción. Campos adicionales, heredados o accesores se rechazan. No se aceptan
actor, notas, asignación, estado, hash ni clave dentro del body.

El service normaliza, calcula SHA-256 hexadecimal lowercase sobre JSON.stringify
UTF-8 con orden fijo meetingId, expectedVersion, date, time, timeZone,
durationMinutes, mode; excluye actor y clave. Llama una vez al repository,
traduce errores, valida respuesta y reconstruye la whitelist de ocho campos.
El repository pasa exactamente los diez parámetros de la firma RPC documentada,
sin SELECT/UPDATE auxiliar ni reconstrucción desde tablas. La autenticación
conserva su consulta al perfil interno.

PostgreSQL sigue siendo autoridad de estado actual, versión, zona horaria,
hora local, futuro, atomicidad, auditoría e idempotencia. Express no consulta
la reunión ni compara su versión actual, no valida futuro ni reintenta la RPC.

Éxito y replay: HTTP 200 con `{ data: { id, consultationRequestId, scheduledAt,
timeZone, durationMinutes, mode, status, version } }`. UUID válidos, id de la
reunión solicitada, timestamp estructural compatible con PostgreSQL (incluidos
offset y microsegundos), zona no vacía, enteros positivos compatibles con integer,
modalidad válida y status scheduled son obligatorios. Estructura inválida:
500 sanitizado, nunca respuesta parcial. Extras del proveedor no se propagan.

| HTTP | Códigos públicos controlados |
| --- | --- |
| 400 | INVALID_REQUEST, INVALID_MEETING_INPUT, INVALID_MEETING_ID, INVALID_IDEMPOTENCY_KEY, INVALID_JSON |
| 403 | ACTOR_NOT_ALLOWED |
| 404 | MEETING_NOT_FOUND |
| 409 | MEETING_NOT_SCHEDULED, MEETING_VERSION_CONFLICT, IDEMPOTENCY_KEY_REUSED, CONSULTATION_STATE_INCONSISTENT, CONSULTATION_ALREADY_SCHEDULED |
| 422 | INVALID_TIME_ZONE, INVALID_LOCAL_TIME, MEETING_NOT_IN_FUTURE |
| 500 | WORKFLOW_ISOLATION_NOT_SUPPORTED, INTERNAL_ERROR |

ACTOR_NOT_ALLOWED desde RPC sigue siendo 403 si el perfil cambió después del
middleware. Errores desconocidos o rechazos de transporte son INTERNAL_ERROR;
message/details/hint/stack del proveedor no se exponen. JSON malformado conserva
el error global INVALID_JSON sin reflejar el body. Logs mantienen sanitización.

Validación local: 408 tests backend aprobados, 0 fallos (base 265; 143 nuevos).
Cubren autorización, cabeceras, body, hash canónico, argumentos y conteo de RPC,
replay simulado, cada mapping relevante, respuestas inválidas y minimización.
Pasan las regresiones de creación (201 y contrato/hash conservados) y Agenda
(admin/agendadora all scope, vendedora own scope). Supabase usa fakes existentes.
La implementación y auditoría locales no contactaron Supabase ni ejecutaron
SQL/RPC remota o crearon fixtures. Los resultados remotos de secciones anteriores
corresponden exclusivamente a 4D.1A. El E2E HTTP posterior se documenta a continuación.

## 4D.1B: E2E HTTP remoto validado

Ejecutado el 2026-10-14 mediante un ejecutor temporal fuera del repositorio.
Express real escuchó en 127.0.0.1:3000 con la configuración normal del backend.
Health y authenticate reales aprobados; sesión de admin activo obtenida mediante
entrada interactiva oculta, con token en memoria. Sin mocks ni bypass de middleware.
psql 18.6 usó la conexión al proyecto vinculado exigiendo TLS en el cliente.

Se creó una consultation converted y una meeting scheduled/version 1, ambas
sintéticas con la marca TEST 4D1B HTTP E2E, UUID nuevos y fechas relativas al reloj
de PostgreSQL, a 30/31 días. Admin, vendedora y programa existentes se usaron solo
como referencias FK. El fixture se verificó y confirmó temporalmente mediante
COMMIT para hacerlo visible a la conexión HTTP independiente.

Resultados confirmados por HTTP y consultas PostgreSQL acotadas al fixture:

- Primer PATCH: 200, exactamente ocho campos públicos, misma meeting y versión
  1→2; nuevo instante, duración 45→60 y modalidad online→phone.
- Campos fuera de la whitelist de actualización preservados, incluyendo asignada,
  creador, fecha de creación, notas y relación. La solicitud completa permaneció
  idéntica y converted.
- Exactamente un meeting_rescheduled, actor correcto y metadata old/new exacta,
  sin PII, clave ni hash; operation_id independiente de las claves.
- Exactamente un registro K1 con operación/actor correctos, hash canónico y
  response_payload idéntico a la respuesta pública.
- Replay con K1 y expectedVersion=1: 200 y body idéntico; meeting, solicitud,
  auditoría e idempotencia permanecieron idénticas.
- K1 con duración distinta: 409 IDEMPOTENCY_KEY_REUSED, sin mutación adicional.
- K2 con expectedVersion=1: 409 MEETING_VERSION_CONFLICT, sin registro K2 ni
  cambios adicionales en la base.
- Sin Authorization: 401 y estado del fixture sin cambios. No se ejecutó E2E
  HTTP de vendedora ni se solicitaron sus credenciales.

El finally ejecutó limpieza transaccional con revalidación de identidad sintética
y deletes exactos: idempotencia, auditoría, meeting y solicitud. Tras COMMIT,
consultas independientes confirmaron consultation=0, meeting=0, audit=0 e
idempotency=0. No quedaron fixtures persistidos. Ninguna reunión o solicitud real,
internal_user ni program fue modificado. No se registraron secretos, IDs reales
ni datos personales en esta documentación. El backend temporal se cerró.

El primer intento se detuvo antes de insertar por una comprobación que confundía
TLS del cliente al pooler con el salto pooler/PostgreSQL. Se corrigió únicamente
el ejecutor temporal: se mantuvo sslmode=require y se comprobaron por separado
permisos de inserción y limpieza. El segundo intento completó todo el E2E.

## Validaciones todavía pendientes de reprogramación (4D.1)

Estas pruebas secuenciales NO validan dos sesiones simultáneas: quedan pendientes
same-key concurrent real y different-key simultaneous version conflict real.
Tampoco acredita toda la matriz de revocación/permisos, replay vencido/tras cambio
de estado, fotografía corrupta, overflow, padre inconsistente, estados terminales,
DST, fecha vencida esperando locks ni fallos inducidos de audit/idempotencia.
El rollback de 4D.1A y el cleanup con COMMIT de 4D.1B quedaron comprobados.

## 4D.2B — Cancelación: PostgreSQL + RPC completada y validada

Estado: **4D.2B TÉCNICAMENTE COMPLETADA Y VALIDADA**. Migración forward-only
`20261015120000_cancel_meeting_workflow.sql` implementada y aplicada a Supabase
remoto, con historial local/remoto alineado según la evidencia manual aportada
por el usuario. Validación local mediante suite backend y auditoría estática;
validación PostgreSQL remota mediante fixtures sintéticos, atomicidad inducida
y concurrencia real en dos sesiones, con cleanup y cero residuos.
No se modifican las migraciones aplicadas de creación/reprogramación.
**4D.2 completa NO está terminada**: quedan las capas de cancelación Express,
frontend API/UI y E2E de la funcionalidad completa; este cierre es PostgreSQL + RPC.

### Contrato y permisos

```text
public.cancel_consultation_meeting(
  p_actor_id uuid, p_meeting_id uuid, p_idempotency_key uuid,
  p_request_hash text, p_expected_version integer, p_reason text
) returns jsonb
```

PL/pgSQL, VOLATILE, SECURITY INVOKER, search_path=pg_catalog,pg_temp y timezone=UTC.
Exige READ COMMITTED. REVOKE ALL sobre la firma exacta a PUBLIC, anon,
authenticated y service_role; GRANT EXECUTE solo a service_role. No amplía grants
de tablas ni altera RLS. Actor activo admin/agendadora bajo FOR SHARE; vendedora
no puede cancelar ni recuperar un replay. El backend futuro debe derivar el actor
de req.user.id y calcular el hash; la RPC confía en esa frontera service_role.

Se preservan consultation_request/consultation_converted y
meeting/meeting_created|meeting_rescheduled en audit_events_entity_action_valid,
añadiendo meeting/meeting_cancelled. idempotency_records_operation_valid conserva
create_consultation_meeting y reschedule_consultation_meeting y añade
cancel_consultation_meeting. La migración completa requiere runner transaccional,
nunca ejecución parcial; ya está aplicada remotamente. Esta fase no implementa
el endpoint Express ni frontend.

### Motivo, estado e invariantes

Reason es un código controlado obligatorio: client_request, staff_unavailable,
duplicate, administrative u other. No es texto libre. Se comparan valores exactos,
sin trim, traducción, case folding ni normalización. NULL y cualquier valor fuera
de la lista producen INVALID_MEETING_INPUT en un comando nuevo.

Solo scheduled → cancelled. expectedVersion es integer positivo y debe coincidir
con la versión bloqueada. El padre debe estar converted; no se modifica ninguna
de sus columnas, incluido updated_at. No se comprueba futuro ni elegibilidad de
la asignada histórica. Se preservan horario, zona, duración, modalidad, notas,
asignada, identidad, relación, creador y fecha de creación.

El único UPDATE cambia status='cancelled', updated_by=actor,
updated_at=clock_timestamp() y version=version+1. Versión 2147483647 produce
INTERNAL_ERROR antes de escribir. El índice parcial queda intacto: una cancelación
libera la exclusividad scheduled. No se crea otra meeting automáticamente; una
creación posterior sigue las reglas 4B (sin scheduled ni completed en el historial).
La UI actual de Solicitudes sigue limitada a pending; habilitar nuevos intentos
desde converted pertenece a otra fase.

### Orden, replay y precedencia

1. Exigir aislamiento y validar actor/IDs/clave/hash básicos.
2. Advisory lock transaccional por operation/actor/key, sin lock advisory de meeting.
3. Actor FOR SHARE y validación de existencia, active y role.
4. Buscar (actor_id, operation, idempotency_key). Hash distinto:
   IDEMPOTENCY_KEY_REUSED. Hash igual: validar y devolver fotografía persistida.
5. Sin replay: validar expectedVersion y reason, descubrir ID del padre sin lock.
6. Padre FOR UPDATE → meeting FOR UPDATE; revalidar existencia y relación.
7. Validar status scheduled → versión esperada → padre converted → overflow.
8. UPDATE, INSERT audit, construir respuesta, INSERT idempotency y retornar.

Precedencia intencional: si otra cancelación ganó con otra clave, el nuevo comando
recibe MEETING_NOT_SCHEDULED aunque su versión también sea antigua. Si ganó una
reprogramación y sigue scheduled, recibe MEETING_VERSION_CONFLICT. La misma clave
y hash exitosos recuperan el resultado original sin validar estado/versión/padre
actuales, sin nuevo audit ni incremento. Actor revocado no accede al replay.

La fotografía exige exactamente ocho campos públicos, objeto y tipos correctos,
estado cancelled, modalidad válida, zona no vacía, timestamp finito, duración
integer positiva y versión integer >=2. El ID del padre debe coincidir con el
registro idempotente. Un ID de meeting distinto del solicitado produce
IDEMPOTENCY_KEY_REUSED, como 4D.1; estructura/casts corruptos producen INTERNAL_ERROR.
La RPC compara/persiste el hash recibido y no lo recalcula. Contrato futuro del
backend: SHA-256 UTF-8 de JSON.stringify con orden meetingId (UUID lowercase),
expectedVersion, reason exacto; actor y clave fuera del hash.

Una operación por transacción. Fallos de audit/idempotencia deben revertir todo;
no se capturan para retornar éxito. Errores controlados usan P0001 y códigos fijos,
sin datos internos. Errores de integridad desconocidos se propagan para sanitización
en el adaptador futuro. No hay SQL dinámico ni efectos externos.

### Auditoría y respuesta

Exactamente un evento meeting/meeting_cancelled, entity_id de la meeting,
actor_id interno y operation_id generado independientemente de Idempotency-Key.
Metadata exacta: consultationRequestId, previousStatus, newStatus,
previousVersion, newVersion, reason. Sin PII, contactos, notes, key, hash ni actor
duplicado. Reason solo se persiste en esa metadata; no en response_payload.

```text
{ id, consultationRequestId, scheduledAt, timeZone,
  durationMinutes, mode, status: "cancelled", version }
```

La misma respuesta JSONB se retorna y persiste en idempotency_records junto con
actor, operation, key, hash y consultation_request_id. No se persisten errores.
El endpoint futuro PATCH /api/admin/meetings/:id/cancel usará 200 y {data: resultado}.

### Evidencia local inicial

Baseline manual informada por el usuario en PowerShell local: **408 tests,
408 pass, 0 fail**. El intento anterior de Codex falló por connect EACCES en
127.0.0.1; no se repitió la suite HTTP restringida ni se atribuye esa baseline
a una ejecución exitosa de Codex.

La implementación inicial añadió 16 tests estáticos en tests/cancel-meeting-migration.test.mjs, incluidos
automáticamente por el script npm test existente. Cubren constraints, firma,
permisos, aislamiento, orden actor/replay/locks, fotografía, reason exacto,
precedencia estado/versión, padre, overflow, whitelist, audit y respuesta.
Codex ejecutó `node --test tests/cancel-meeting-migration.test.mjs
tests/error-handler.test.mjs`: **26 tests, 26 pass, 0 fail** (16 nuevos + 10 existentes).
Son lecturas/aserciones locales sin DB, fixtures, sockets ni imports del proveedor.

Estos tests comprueban el contrato textual, no compilan ni ejecutan PL/pgSQL y no
demuestran rollback, concurrencia ni grants efectivos. Posteriormente el usuario
ejecutó manualmente la suite backend completa en PowerShell: **424 tests,
424 pass, 0 fail**, antes de la corrección de replay descrita abajo. Este resultado
no se atribuye a Codex ni equivale a validación PostgreSQL real.
Estas ejecuciones iniciales fueron exclusivamente locales. La batería PostgreSQL
real posterior se registra abajo; no se atribuye a los tests estáticos ni acredita
casos adicionales de revocación/permisos no reportados. El E2E de navegador
esperará las fases de endpoint/API/UI.

### Corrección local del replay — 2026-10-16

Antes de aplicar la nueva migración remotamente, se amplió exclusivamente
el handler del bloque de interpretación de la fotografía persistida para traducir
a P0001 / INTERNAL_ERROR estas condiciones PostgreSQL:

- 22P02 / invalid_text_representation (UUID/entero inválido).
- 22003 / numeric_value_out_of_range.
- 22007 / invalid_datetime_format.
- 22008 / datetime_field_overflow.
- 22009 / invalid_time_zone_displacement_value (offset fuera de rango).
- 22023 / invalid_parameter_value (por ejemplo, zona inexistente).
- F0000 / config_file_error (resolución de abreviaturas de zona configuradas).

No hay WHEN OTHERS ni captura de P0001/raise_exception. El handler está dentro
del replay y no cubre consultas, locks ni escrituras. El conflicto de hash sigue
fuera del bloque; el conflicto explícito de ID sigue propagando
IDEMPOTENCY_KEY_REUSED porque no pertenece a las condiciones capturadas.
No se absorben fallos de auditoría/idempotencia ni errores de otras operaciones.

Antes del cast, scheduledAt debe tener el prefijo ISO
`^[0-9]{4,}-[0-9]{2}-[0-9]{2}T`, compatible con la serialización JSONB del
timestamptz de la RPC, incluidos años de más de cuatro dígitos. Esto rechaza
now, today, tomorrow, yesterday, epoch, allballs e infinity/-infinity, sin
normalizar ni reinterpretar tokens especiales. No es un parser RFC3339 completo:
el cast PostgreSQL valida calendario/hora/zona y isfinite sigue exigiendo finitud.
La comprobación no recorta microsegundos ni exige un año limitado a cuatro dígitos.

Se conservan los 16 tests y se añaden tres: condiciones de error, alcance del
handler sin absorción de códigos de dominio y prefijo previo al cast con ejemplos
de tokens rechazados/salidas admitidas. Los ejemplos de regex se evalúan en JS;
no constituyen ejecución SQL. Codex ejecutó los **19 tests estáticos: 19 pass,
0 fail**, y node --check. Un primer intento detectó un espacio final en la
aserción del handler; se corrigió la aserción antes de la ejecución aprobada.
Estas comprobaciones estáticas no acreditan compilación PostgreSQL, rollback,
concurrencia ni E2E. La suite completa del cierre local y la evidencia PostgreSQL
real posterior se distinguen a continuación.

Deuda técnica separada: reschedule_consultation_meeting de 4D.1 conserva el
handler anterior y la validación temporal permisiva del replay. No se modificó
su migración ya aplicada; su corrección requiere una tarea y migración futura.

### Cierre local — 2026-10-16

Codex ejecutó la suite completa con `npm test`, definida en package.json como
`node --experimental-vm-modules --test tests/*.test.mjs`: **427 tests, 427 pass,
0 fail**, sin cancelados ni omitidos; duración reportada 703.7909 ms. El primer
intento en sandbox falló por connect EACCES en loopback; tras revisar el harness
sin modificarlo, la repetición autorizada fuera de esa restricción pasó completa.
Supabase permanece simulado y no se carga .env. Los 19 tests de la migración
actual siguen cubriendo el contrato textual; no sustituyen las pruebas remotas.
La revisión conserva SECURITY INVOKER, configuración segura, grants restringidos,
handler acotado al replay sin WHEN OTHERS, precedencia estado/versión, reason
exacto, respuesta de ocho campos y ausencia de UPDATE sobre consultation.

### Validación PostgreSQL remota completada

Evidencia de ejecución manual comunicada por el usuario para el cierre del
2026-10-16. Se usaron fixtures sintéticos controlados; usuarios internos y programa
existentes solo se referenciaron. El cierre documental no repite pruebas mutantes
remotas ni aplica migraciones. El catálogo remoto confirmó firma exacta, retorno
jsonb, VOLATILE, SECURITY INVOKER, search_path=pg_catalog,pg_temp, TimeZone=UTC,
EXECUTE para service_role y ausencia de EXECUTE para authenticated/anon.

Resultados confirmados:

- Éxito: scheduled/version 1 → cancelled/version 2. Se preservaron scheduled_at,
  time_zone, duration_minutes, mode, notes, assigned_to, created_by y created_at;
  updated_by quedó en el actor admin. Consultation siguió converted con updated_at
  intacto. Reason no se escribió en notes ni en la respuesta de ocho campos.
- Exactamente un meeting_cancelled con metadata exacta: consultationRequestId,
  previousStatus/newStatus, previousVersion/newVersion y reason; operation_id
  independiente de las Idempotency-Key. Exactamente un registro idempotente.
- Replay con mismo actor/operación/clave/hash devolvió la respuesta persistida
  exacta, sin incrementar versión ni duplicar audit/idempotencia. Misma clave
  con payload/hash distinto produjo IDEMPOTENCY_KEY_REUSED sin cambios adicionales.
- Negativos: ACTOR_NOT_ALLOWED, INVALID_MEETING_INPUT, MEETING_VERSION_CONFLICT,
  IDEMPOTENCY_KEY_REUSED y MEETING_NOT_SCHEDULED; fotografía con offset +25:00 y
  literal especial now produjo INTERNAL_ERROR. Antes de cancelar no hubo mutación
  ni inserts; después se preservaron cancelled/version 2, un audit y una idempotencia.
- Estados especiales: MEETING_NOT_FOUND, CONSULTATION_STATE_INCONSISTENT y
  overflow desde 2147483647 → INTERNAL_ERROR, sin mutaciones parciales.
- Los cinco reasons exactos produjeron scheduled → cancelled, versión 1→2 y
  metadata.reason correspondiente: client_request, staff_unavailable, duplicate,
  administrative y other.
- Nuevo intento: la cancelación liberó el índice único parcial de scheduled y se
  comprobó una nueva meeting scheduled para la misma consultation; no se crea
  automáticamente por la RPC de cancelación.
- Atomicidad inducida: un trigger temporal limitado al fixture provocó
  GE_4D_4B2B_INDUCED_IDEMPOTENCY_FAILURE al insertar idempotencia, después del
  UPDATE y del INSERT audit. PostgreSQL revirtió todo: meeting scheduled/version 1,
  updated_at/updated_by originales, audit=0, idempotencia=0 y consultation converted
  con updated_at intacto. El rollback final dejó cero residuos, incluido el trigger.

### Concurrencia real y cleanup

Misma clave/hash, dos sesiones PostgreSQL: A canceló y mantuvo abierta la
transacción; B esperó hasta COMMIT A y devolvió exactamente la misma respuesta
idempotente cancelled/version 2. Resultado: un meeting_cancelled, un registro
idempotente y una meeting cancelled/version 2. Cleanup explícito con cero residuos.

Claves diferentes, dos sesiones psql y harness temporal fuera del repositorio:
A canceló con clave A y reason client_request; B intentó cancelar la misma meeting
con clave/hash B diferentes, expectedVersion=1 y reason administrative. Antes del
COMMIT A se comprobó exactamente una B activa, wait_event_type=Lock y A entre
pg_blocking_pids(B), con la salida:

```text
PASS real blocking: one active B, wait_event_type Lock, A in blocking PIDs
PASS A COMMITTED - B SHOULD NOW UNBLOCK
PASS concurrent different key -> MEETING_NOT_SCHEDULED
PASS B COMMITTED
```

B obtuvo exactamente SQLSTATE P0001 / MEETING_NOT_SCHEDULED después del COMMIT A:
el estado cancelled precedió a la versión obsoleta. No hubo
MEETING_VERSION_CONFLICT ni segunda cancelación. Se verificaron meeting
cancelled/version 2, consultation converted con updated_at original, exactamente
un audit con versiones 1→2 y reason client_request, y exactamente una idempotencia
de clave A con hash correcto y respuesta coincidente; clave B ausente.

Tras revalidar identidad sintética, el cleanup transaccional eliminó únicamente
idempotencia, auditoría, meeting y consultation del fixture. Después de COMMIT:

```text
PASS consultation_residue = 0
PASS meeting_residue = 0
PASS idempotency_residue = 0
PASS audit_residue = 0
PASS VERIFIED AND CLEANED - ZERO RESIDUE
```

La batería real de concurrencia de cancelación 4D.2B está completada. El harness
temporal no forma parte del código de producción ni se incorpora al repositorio.
