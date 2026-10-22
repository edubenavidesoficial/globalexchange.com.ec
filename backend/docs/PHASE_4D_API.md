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
Este cierre histórico correspondió a PostgreSQL + RPC; en ese momento faltaban
Express, frontend API/UI y E2E. Estado actual: **4D.2B CERRADA Y PUBLICADA**,
commit `7811761`. El cierre integrado posterior se registra al final en 4D.2F.

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

## 4D.2C — Backend Express de cancelación — 2026-10-16

Estado actual: **4D.2C CERRADA Y PUBLICADA**, commit `42a7b39`,
con `PATCH /api/admin/meetings/:id/cancel`. El registro siguiente conserva la
implementación y validación anteriores a su publicación; entonces faltaban
frontend API/UI y E2E, cuyo cierre posterior se registra en 4D.2F.
Esta subfase no modificó PostgreSQL, migraciones, frontend ni middleware globales.

### Arquitectura y autorización

Router meetings ya montado → authenticate → authorize('admin', 'agendadora') →
patchMeetingCancel → cancelMeeting → cancelConsultationMeeting → una RPC
cancel_consultation_meeting. Vendedora recibe 403. Sin token/token inválido:
401; sin perfil interno/perfil inactivo: 403. Actor exclusivamente de req.user.id,
obtenido del perfil interno; nunca de body, headers arbitrarios o metadata cliente.
La RPC vuelve a validar al actor, incluso en replay.

El repository pasa exactamente p_actor_id, p_meeting_id, p_idempotency_key,
p_request_hash, p_expected_version y p_reason; devuelve data o lanza el mismo
error recibido, sin interpretarlo. No hay consultas comerciales adicionales,
escrituras directas, comparación de versión actual, locks, reintentos ni replay
local. La consulta de autenticación a internal_users permanece.

### Contrato HTTP y hash

Headers: Authorization: Bearer <token>, Content-Type: application/json
(también charset=utf-8), y exactamente una Idempotency-Key UUID.
Los duplicados se detectan en rawHeaders sin distinguir casing. Id y clave usan
el validador UUID existente: 36 caracteres, sin coerción ni trim, lowercase.
Node HTTP puede eliminar OWS periférico de headers y rechaza CR/LF antes del
service; los valores sin normalizar se prueban directamente en este último.

Body JSON plano con exactamente dos campos:

```json
{ "expectedVersion": 1, "reason": "client_request" }
```

expectedVersion: Number integer entre 1 y 2147483647, sin coerción.
reason: exactamente client_request, staff_unavailable, duplicate, administrative
u other; sin trim, lowercase ni alias. Estructura/campos extra: INVALID_REQUEST;
campos ausentes/valores inválidos: INVALID_MEETING_INPUT. Se rechazan arrays,
instancias, herencia personalizada, símbolos y accesores sin ejecutarlos.
Se reutiliza la validación estricta de reprogramación mediante un helper local;
el descriptor de constructor evita ejecutar un getter en el prototipo.

JSON malformado mantiene INVALID_JSON del error-handler. express.json() precede
a authenticate, por lo que ese 400 puede preceder a la comprobación del token.

normalizeCancellation construye en este orden exacto:

```js
{ meetingId: normalizedMeetingId, expectedVersion, reason }
```

Hash SHA-256 de JSON.stringify(payload), UTF-8, hexadecimal lowercase.
No incluye actor, clave ni operation. PostgreSQL separa operaciones mediante
(actor_id, operation, idempotency_key), con operation cancel_consultation_meeting.
No se modificaron expresiones de hash ni payloads históricos de creación o
reprogramación; sus pruebas de hash existentes siguen pasando.

### Respuesta y errores

Éxito y replay: HTTP 200 con {data: resultado}. El service valida y proyecta
explícitamente los ocho campos: id, consultationRequestId, scheduledAt, timeZone,
durationMinutes, mode, status y version. Exige el id solicitado, UUID válidos,
timestamp válido, zona no vacía, duración integer positiva hasta 2147483647,
modalidad online/phone/office, status cancelled y versión integer 2–2147483647.
Reason, notes, assignedTo, actores, audit, metadata y extras del proveedor no se
exponen. Reason se envía únicamente como argumento de RPC; su persistencia en
audit_events.metadata.reason sigue siendo responsabilidad de PostgreSQL.

Se reutiliza la proyección de reprogramación con estado esperado explícito,
preservando sus garantías de tipos. Timestamp válido se devuelve sin reformatear
y puede estar en el pasado. Tras la corrección P2 descrita abajo, las respuestas
de cancelación/reprogramación admiten años 0001–10000; los filtros de Agenda
conservan 0001–9999. No se amplía el contrato a todo el rango PostgreSQL.

| Código público | HTTP | Mensaje |
| --- | --- | --- |
| ACTOR_NOT_ALLOWED | 403 | No tienes permisos para cancelar reuniones. |
| MEETING_NOT_FOUND | 404 | La reunión no existe. |
| MEETING_NOT_SCHEDULED | 409 | Solo se puede cancelar una reunión programada. |
| MEETING_VERSION_CONFLICT | 409 | La reunión cambió. Vuelve a consultar sus datos. |
| IDEMPOTENCY_KEY_REUSED | 409 | La clave de idempotencia ya corresponde a otros datos. |
| CONSULTATION_STATE_INCONSISTENT | 409 | La solicitud requiere revisión antes de cancelar la reunión. |
| INVALID_MEETING_INPUT | 400 | Los datos de la reunión no son válidos. |
| INVALID_REQUEST | 400 | Los datos de la solicitud no son válidos. |
| WORKFLOW_ISOLATION_NOT_SUPPORTED | 500 | Ocurrió un error interno en el servidor. |
| INTERNAL_ERROR | 500 | Ocurrió un error interno en el servidor. |

Errores controlados mantienen {error: {code, message}}. UUID de reunión inválido:
INVALID_MEETING_ID; clave ausente/inválida/duplicada: INVALID_IDEMPOTENCY_KEY;
JSON malformado: INVALID_JSON, todos 400 con los mensajes existentes.
Los middleware de auth conservan sus respuestas sin code: 401 con
"Se requiere una autenticación válida."; 403 por rol con
"No tienes permisos para realizar esta acción." y por perfil con
"No tienes acceso al sistema interno.".

MeetingError/translateMeetingError aceptan un contexto opcional cancel que cambia
solo los tres mensajes específicos de la operación. El default preserva los
mensajes históricos. Se mantiene la allowlist existente: solo SQLSTATE P0001 y
message exacto permitido. Otros errores, rechazos de transporte o respuesta
inválida producen INTERNAL_ERROR. No se propagan details, hint, cause, stack ni
mensajes arbitrarios; los logs mantienen la sanitización global existente.

### Validación local Express

166 tests nuevos en tests/meetings.test.mjs sobre el harness HTTP/VM existente:
route/métodos, auth, cabeceras, JSON, UUID, body estricto, motivos, límites,
hash canónico, inputs inmutables, seis argumentos RPC, propagación del error en
repository, mensajes contextualizados y regresión de mensajes históricos,
allowlist, 50 respuestas inválidas, whitelist pública y replay HTTP simulado.

Comandos ejecutados desde backend:

```text
node --experimental-vm-modules --test --test-name-pattern=cancel tests/meetings.test.mjs
npm test
```

El primer intento focalizado en sandbox falló por connect EACCES en 127.0.0.1.
Se repitió el mismo comando con permisos para loopback, sin modificar los tests:
166 tests, 166 pass, 0 fail, duración 458.9277 ms.
Suite completa mediante el script real de package.json, con loopback habilitado:
593 tests, 593 pass, 0 fail, 0 cancelados/omitidos, duración 918.3023 ms.
Se conservan los 427 tests de baseline, incluidos creación, reprogramación,
Agenda, auth, error-handler y contrato estático de migración.

La ejecución emite avisos de VM Modules experimental y de Promise-like handlers
del harness VM. No hubo fallos funcionales en la ejecución con loopback habilitado.
Supabase se sustituye antes de evaluar config; no se carga .env, no se contacta
la DB ni se ejecuta SQL remoto. El replay simulado comprueba dos respuestas y
argumentos iguales, sin cambio local de versión/clave; no demuestra locking,
concurrencia ni atomicidad PostgreSQL. Esa evidencia pertenece a 4D.2B.
Después de la suite solo se añadió esta documentación; no se repite la suite
porque no cambia runtime ni tests. La revisión final incluye git diff --check
y revisión del alcance y del diff, sin staging, commit ni push.

### Corrección P2 de respuesta temporal — 2026-10-19

La revisión detectó un caso alcanzable mediante las APIs: 9999-12-31 23:30 en
America/Guayaquil corresponde a 10000-01-01 04:30 UTC. La fecha local pasaba
validación y PostgreSQL podía escribirla; el parser HTTP de cuatro dígitos
rechazaba la respuesta después del éxito de la RPC. Cancelación y replay
devolvían 500 persistentemente; reprogramación compartía el defecto.

Corrección limitada al parser usado por la proyección de respuestas: admite
cuatro dígitos (0001–9999) o el literal 10000 sin signo, como la representación
PostgreSQL simulada `10000-01-01T04:30:00+00:00`. El año escrito y el instante UTC
deben estar entre 1 y 10000. Es el menor límite superior por años que cubre el
cruce desde fechas locales de cuatro dígitos: un desfase horario puede cruzar
al año siguiente, no saltar hasta 10001. No se añade conversión IANA a producción.
Se admite el año 10000 completo como rango representacional, sin inferir qué
fechas concretas provienen de creación ni consultar la DB.

Se conserva calendario gregoriano (incluido 10000 bisiesto por divisibilidad
entre 400), hora 00–23, minutos/segundos 00–59, fracción opcional de 1–6 dígitos,
T/t y Z/z u offset ±HH:mm con HH≤23 y mm≤59; -00:00 sigue rechazado. Sin trim,
tokens especiales, Date.parse ni zona del host. Date se construye mediante
setUTCFullYear/setUTCHours dentro de un rango que soporta; la serialización
interna ya no recorta posiciones fijas que truncarían el año ampliado.
La proyección conserva el string original, sin convertirlo al formato +010000
de JavaScript. Agenda conserva sus límites; creación no se refactoriza.

38 tests añadidos: creación 201 y hash con fecha local límite; reprogramación
200 y argumentos exactos; cancelación/replay 200 con respuestas y argumentos
idénticos; bisiesto 10000, microsegundos, offsets, pasado y límites UTC;
fechas/horas/offsets imposibles, fracciones inválidas, tokens y formatos fuera
de contrato; filtros Agenda sin ampliación. El antiguo caso negativo del año
10000 se actualizó a 10001 conforme al nuevo límite; el año 10000 tiene ahora
cobertura positiva explícita. Se conservan las regresiones de hashes y errores.

Ejecuciones con loopback habilitado por el EACCES del sandbox ya constatado:
`node --experimental-vm-modules --test --test-name-pattern="timestamp response" tests/meetings.test.mjs`:
38 tests, 38 pass, 0 fail, 1046.6196 ms. Suite completa `npm test`:
631 tests, 631 pass, 0 fail, 0 cancelados/omitidos, 1859.5401 ms.
Supabase simulado; la conversión se comprueba localmente con Node/Intl y los
contratos SQL se inspeccionan, sin ejecución PostgreSQL ni validación remota nueva.
No cambiaron hashes, idempotencia, autorización, RPCs ni migraciones. En ese
momento el P2 quedó corregido localmente para reauditoría y faltaban frontend
API/UI y E2E. La publicación y el cierre posteriores se registran a continuación.
Después de aquella suite solo cambió documentación.

## 4D.2F — Cierre integrado de cancelación — 2026-10-20

Estado técnico: **4D.2F CERRADO**. La **FASE 4D.2 — CANCELACIÓN DE REUNIONES**
queda cerrada tras publicar esta documentación. Las capas previas están cerradas
y publicadas:

| Subfase | Commit | Entrega |
|---|---|---|
| 4D.2B | `7811761` | Flujo transaccional PostgreSQL/RPC |
| 4D.2C | `42a7b39` | Cancelación de reuniones en Express |
| 4D.2D | `6fa7fc1` | API frontend de cancelación |
| 4D.2E | `c89363d` | Cancelación desde Agenda |

La evidencia final fue ejecutada por **usuario + ChatGPT** y reportada para
este cierre; no se atribuye su ejecución a Codex. El commit base evaluado fue
`c89363d`. Codex solo actualiza estos documentos, sin repetir pruebas ni
operaciones remotas. El procedimiento y la evidencia UI se detallan en
[la sección 4D.2F frontend](../../frontend/docs/CRM_PHASE_4D_API.md).

### Validación final e integración real

Resultados finales reportados: backend `npm test`, **631 tests, 631 pass**;
frontend `npm run test:crm`, **784 tests, 784 pass**. Ambas suites terminaron
con **0 fail, 0 cancelled, 0 skipped y 0 todo**. `npm run build` frontend
terminó correctamente: **125 modules transformed, built in 1.55s**.
Después, git status --short no produjo salida y HEAD/origin/migracion-vite
estaban en `c89363d`. Estos resultados preceden a la edición documental.

El happy path real previo conectó navegador, API frontend, PATCH, Express,
repository, RPC y PostgreSQL: scheduled → cancelled, refetch y badge Cancelada.
Su cleanup dejó consultation/meeting/idempotency/audit en 0/0/0/0.

El E2E adicional utilizó el fixture `TEST_ONLY_4D2F_c1fa6c4c`,
consultation `49ec9e8d-5ffe-4ee3-b8bf-2564fe88f48a` y meeting
`61d75dc9-2868-43a2-92a3-7cd354b442e2`. Partió de converted/scheduled,
versión 1, 10:00 local, sin auditoría ni idempotencia. A mantuvo abierto
Cancelar con versión 1; B reprogramó mediante UI real a las 11:00 del mismo día.
DB confirmó scheduled/version 2, una auditoría y una idempotencia de
reprogramación, y cero registros de cancelación.

El intento posterior de A produjo **HTTP 409 / MEETING_VERSION_CONFLICT** real.
La UI cerró el diálogo, informó el conflicto y refrescó el snapshot a
Programada/11:00. Inmediatamente después, DB conservó consultation converted,
meeting scheduled/version 2, reschedule_audit_count=1,
reschedule_idempotency_count=1, cancel_audit_count=0 y
cancel_idempotency_count=0. No persistió una cancelación rechazada.
El checklist manual de diálogo, validación nativa, Escape, foco, reapertura,
fondo inert, exclusión de diálogos y uso móvil aproximado de 390 px fue aprobado.

### Estado posterior y cleanup verificado

Después de esa comprobación hubo una cancelación válida independiente con
reason=other: scheduled/version 2 → cancelled/version 3. El estado final tenía
una auditoría meeting_rescheduled y una meeting_cancelled, y una idempotencia
reschedule_consultation_meeting y una cancel_consultation_meeting.
No debe atribuirse esa escritura al intento stale previamente rechazado.

El primer cleanup se detuvo correctamente al encontrar cancelled/v3 cuando
esperaba scheduled/v2. Tras auditar el estado se corrigió el harness/manual
cleanup, incluida su suposición incorrecta sobre metadata:

- meeting_rescheduled contiene oldScheduledAt, newScheduledAt, oldTimeZone,
  newTimeZone, oldDurationMinutes, newDurationMinutes, oldMode, newMode,
  previousVersion y newVersion; **no contiene consultationRequestId**.
- meeting_cancelled contiene consultationRequestId, previousStatus, newStatus,
  previousVersion, newVersion y reason.

Fue una corrección del procedimiento manual, no del producto ni de sus contratos.
El cleanup final respetó idempotency_records → audit_events → meetings →
consultation_requests, sin CASCADE, y terminó con COMMIT. La lectura post-COMMIT
confirmó consultation_residue=0, meeting_residue=0, idempotency_residue=0 y
audit_residue=0: **CERO RESIDUOS REMOTOS**.

### Límites y cierre documental

Se conserva la evidencia real de replay, locks, atomicidad y concurrencia de
4D.2B, sin repetirla en 4D.2F. Año 10000 y fallos de red mantienen su cobertura
controlada en tests, sin afirmar nuevas pruebas remotas de esos casos. El 409
observado aquí fue MEETING_VERSION_CONFLICT; no se presenta como un nuevo E2E
de MEETING_NOT_SCHEDULED ni cambia la precedencia status-before-version.
No cambian endpoint, roles, reasons, hash, idempotencia, respuesta o errores.
Solo resta publicar este cierre documental para declarar cerrada toda 4D.2.

## 4D.3B — PostgreSQL / resultado de reuniones

**Implementación PostgreSQL terminada y validación remota principal terminada.**
La migración está aplicada remotamente. 4D.3B queda cerrada técnicamente con
las limitaciones de validación remota de Script 5 y actor inactivo aceptadas
explícitamente y documentadas al final de esta sección; no se declaran PASS.
Esto no cierra toda 4D.3: Express/backend HTTP, frontend API y UI de resultados
corresponden a fases posteriores. Migration forward-only:
`20261020120000_meeting_outcome_workflow.sql`, posterior a cancelación.
No modifica migrations históricas, datos existentes, tablas, columnas, RLS,
`meetings_status_valid` ni `meetings_one_scheduled_per_consultation_idx`.

### Contrato de negocio y RPC

Dos funciones independientes de `public`, ambas con esta firma:

```sql
complete_consultation_meeting(
  p_actor_id uuid, p_meeting_id uuid, p_idempotency_key uuid,
  p_request_hash text, p_expected_version integer
) returns jsonb

mark_consultation_meeting_no_show(
  p_actor_id uuid, p_meeting_id uuid, p_idempotency_key uuid,
  p_request_hash text, p_expected_version integer
) returns jsonb
```

`completed` significa que la reunión se realizó, sin cerrar la venta ni la
consultation. `no_show` significa ausencia del cliente. Son transiciones
irreversibles desde `scheduled` para esa meeting, con el mismo UUID.
Solo cambian `status`, `version + 1`, `updated_by` y
`updated_at = clock_timestamp()`. Permanecen intactos horario, zona, duración,
modo, notas, asignación, creador y fecha de creación.
La consultation debe seguir `converted`: no se escribe ningún campo suyo,
incluido `updated_at`. No hay reason, notas adicionales ni siguiente intento
automático.

Admin activo puede operar sobre cualquier meeting elegible. Vendedora activa
solo sobre su meeting (`assigned_to = actor`), validado bajo lock. Agendadora,
actor inactivo, inexistente o nulo y vendedora ajena reciben
`ACTOR_NOT_ALLOWED`. No se confía en filtros UI ni metadata JWT.

Complete permite `clock_timestamp() >= scheduled_at`. No-show permite
`clock_timestamp() >= scheduled_at + duration_minutes` minutos. No hay margen
adicional. El tiempo se comprueba después de los locks, inmediatamente antes
de escribir. No-show captura exclusivamente overflow de fecha, intervalo y
número en su bloque aritmético y rechaza un resultado no finito.

### Locks, replay y atomicidad

Se exige READ COMMITTED. Orden: advisory transaccional por operation/actor/key,
actor `FOR SHARE`, descubrimiento del padre, consultation `FOR UPDATE`,
meeting `FOR UPDATE`, propiedad, validaciones y efectos. No hay advisory
adicional por meeting. El orden padre → meeting es compatible con los
workflows existentes; el bloqueo del actor impide cambios concurrentes de
rol/active hasta terminar la transacción.

Cada operación usa su propio nombre RPC en `idempotency_records`; se conserva
la unicidad `(actor_id, operation, idempotency_key)`. Hash diferente o UUID de
meeting diferente con la misma key produce `IDEMPOTENCY_KEY_REUSED`.
La fotografía persistida debe contener exactamente los ocho campos de respuesta:

```text
id, consultationRequestId, scheduledAt, timeZone,
durationMinutes, mode, status, version
```

Se verifican UUID, relación con el record y padre actual, timestamp finito
(incluidos años de más de cuatro dígitos), zona string no vacía según el
contrato persistido, duración integer positiva, modo permitido, versión
integer >= 2 y status correspondiente a la operación. Un `id` malformado
produce `INTERNAL_ERROR`; un `id` con otro UUID válido produce
`IDEMPOTENCY_KEY_REUSED`: conflicto semántico de reutilización de la misma
actor/operation/key para otra meeting. Un `consultationRequestId` inconsistente
o corrupto produce `INTERNAL_ERROR`, como las demás fotografías inválidas que
no representan ese conflicto válido entre meetings. Los casts se protegen con
excepciones concretas. Esta distinción fue validada sin cambiar producción.

Antes de devolver cualquier replay se revalidan actor y propiedad actual bajo
lock. Un replay autorizado devuelve exactamente la fotografía original sin
revalidar status/version/tiempo ni estado mutable de consultation; no vuelve
a escribir ni auditar. El comando nuevo valida status antes de comparar
versión, exige padre converted y protege el máximo integer.

Efectos: UPDATE meeting → INSERT audit → INSERT idempotency → RETURN.
Cualquier error revierte todos los efectos de la llamada; no se captura
ampliamente `WHEN OTHERS`. Los fallos de escritura no se convierten en éxito.
Los errores nativos inesperados de escritura requieren sanitización en la
capa HTTP de 4D.3C.

### Auditoría, seguridad y creación posterior

Se conservan consultation_request/consultation_converted y
meeting/meeting_created, meeting_rescheduled, meeting_cancelled. Se añaden
meeting/meeting_completed y meeting/meeting_no_show; no meeting_reassigned.
Cada éxito crea exactamente un evento con actor y UUID `operation_id`
generado por DB independientemente de la key. Metadata exacta:
`consultationRequestId`, `previousStatus`, `newStatus`, `previousVersion`,
`newVersion`; sin PII, notas, keys ni hashes.

Se conservan las operations create_consultation_meeting,
reschedule_consultation_meeting y cancel_consultation_meeting; se añaden
complete_consultation_meeting y mark_consultation_meeting_no_show.

Funciones VOLATILE, SECURITY INVOKER, search_path pg_catalog, pg_temp y UTC.
Tablas calificadas con public; sin SQL dinámico. REVOKE de PUBLIC, anon,
authenticated y service_role, seguido de GRANT EXECUTE solo a service_role
con firma exacta. Los permisos efectivos de las dos RPC de resultado se
comprobaron en PostgreSQL remoto; véase la evidencia estructural más abajo.

CREATE OR REPLACE de create_consultation_meeting elimina únicamente la
detección y rechazo por historial completed. Tras completed, cancelled o
no_show se permite otro intento si consultation sigue converted y no existe
scheduled. La nueva fila tiene otro UUID y versión 1; no se reabre ni modifica
historial. Pending sin historial, validación de assignee, fechas, locks,
idempotencia histórica, auditoría, respuesta y grants se conservan.
El índice parcial sigue garantizando una sola scheduled. El error
CONSULTATION_COMPLETED deja de emitirse por esta definición de creación;
su mapping Express histórico se conserva para revisión en 4D.3C.

### Errores y contrato futuro de Express

Errores de dominio P0001: ACTOR_NOT_ALLOWED, INVALID_REQUEST,
INVALID_MEETING_INPUT, WORKFLOW_ISOLATION_NOT_SUPPORTED, MEETING_NOT_FOUND,
MEETING_NOT_SCHEDULED, MEETING_VERSION_CONFLICT,
CONSULTATION_STATE_INCONSISTENT, IDEMPOTENCY_KEY_REUSED,
MEETING_TOO_EARLY e INTERNAL_ERROR.
Meeting/key nulos o hash nulo/vacío se rechazan como INVALID_REQUEST.
En comandos nuevos, expectedVersion nulo o < 1 es INVALID_MEETING_INPUT.
Un argumento > 2147483647 no puede entrar en la firma integer: PostgreSQL lo
rechaza en el cast anterior al cuerpo; no puede transformarse allí en P0001.
4D.3C deberá validar el rango antes de RPC. Una meeting con versión máxima
produce INTERNAL_ERROR, sin intentar el incremento.

Hash futuro, calculado por Express, con orden exacto:
`{ meetingId: normalizedMeetingId, expectedVersion: expectedVersion }`.
No incluir actor, operation, key ni status. El mapping HTTP de errores nuevos
se implementará en 4D.3C; esta fase no crea endpoints.

### Evidencia local y límites históricos

Baseline manual del usuario en PowerShell: 631 tests, 631 pass, 0 fail,
0 cancelled, 0 skipped, 0 todo; HEAD f662b16, rama migracion-vite limpia.
Se acepta como evidencia: EACCES loopback de Codex es limitación del entorno.

Validación inicial de `tests/meeting-outcome-migration.test.mjs`: 33 tests estáticos,
con extracción acotada de funciones, orden de operaciones, firmas, grants,
metadata y respuesta exactas, hashes históricos normalizados y equivalencia
de creación salvo eliminación del bloqueo completed. Junto con
cancel-meeting-migration.test.mjs y error-handler.test.mjs: 62/62 pass.

`npm test` y runner equivalente con reporter TAP: 664 tests, 76 pass,
588 fail, 0 cancelled/skipped/todo. Los 588 bloques fallidos contienen
connect EACCES 127.0.0.1:<puerto>; cinco son assertions que esperaban HTTP 404
y recibieron ese mismo EACCES. No se detectaron causas distintas de loopback.
No se modificó harness, red ni mocks.
Posteriormente, **usuario + ChatGPT** ejecutaron la suite completa en PowerShell
local tras la implementación: **664 tests, 664 pass, 0 fail, 0 cancelled,
0 skipped, 0 todo**. Esta evidencia manual es válida; el EACCES anterior fue
una limitación del sandbox de Codex, no un fallo funcional del proyecto.

La corrección final pre-preflight refuerza la comparación completa de ambos
CHECK y añade dos tests de regresión, para un total de 35 tests de migration.
Después de esta corrección, el usuario informó la suite manual final:
**666 tests, 666 pass, 0 fail, 0 cancelled, 0 skipped y 0 todo**.
La evidencia 664/664 corresponde al estado anterior y queda sustituida como
validación final por 666/666. La aplicación remota y la validación principal
también se completaron, según la evidencia registrada a continuación.

Los tests estáticos no ejecutan PL/pgSQL ni prueban compilación, grants
efectivos, rollback o concurrencia real. La evidencia PostgreSQL real se
registra a continuación con su limitación de autorización.
La nueva definición de creación debe auditarse en futuras
migrations para evitar divergencia con esta copia forward-only.

### Evidencia final y procedencia — 2026-10-20

Los resultados de ejecución siguientes provienen de la evidencia manual
aportada por el usuario para este cierre documental. No representan una nueva
ejecución de tests, SQL, HTTP o migraciones remotas por Codex en esta revisión.
Se distinguen de las verificaciones locales de archivos y Git.

### Migración y validación estructural remota realizadas

La migración `20261020120000_meeting_outcome_workflow.sql` fue aplicada
correctamente. La ejecución manual de `migration list --linked` confirmó
alineación local/remoto. No queda pendiente volver a aplicar esta migración.

SHA-256 validado previamente y confirmado mediante lectura local en esta revisión:

```text
C3CE6E84EE0D8A0E27464DF306E38863968AB95E655BC393C717988221527BE1
```

La validación remota READ-ONLY confirmó para ambas RPC de resultado:

| Propiedad | Resultado |
| --- | --- |
| Retorno | jsonb |
| Volatilidad | VOLATILE |
| Seguridad | SECURITY INVOKER |
| search_path | pg_catalog, pg_temp |
| TimeZone | UTC |
| service_role_execute | true |
| authenticated_execute | false |
| anon_execute | false |

Constraints verificados: `audit_constraint_ok=true`,
`idempotency_constraint_ok=true`, `meetings_status_constraint_ok=true`
y `exactly_three_constraints=true`.
El índice `meetings_one_scheduled_per_consultation_idx` fue confirmado
UNIQUE, con predicado `status = 'scheduled'`.

### Validaciones PostgreSQL mutantes realizadas

| Script | Alcance | Resultado informado |
| --- | --- | --- |
| 1 | scheduled → completed y replay | PASS |
| 2 | scheduled → no_show y replay | PASS |
| 3 | Crear nueva meeting después de completed | PASS |
| 4 | Crear nueva meeting después de no_show | PASS |
| 5, batería A–D | Autorización por rol y asignación | PRECONDICIÓN NO DISPONIBLE |
| 5, actor inactivo | Rechazo de actor inactivo | NO EJECUTADO — LIMITACIÓN ACEPTADA DE VALIDACIÓN REMOTA |
| 6 | Temporalidad | PASS |
| 7 | Errores y precedencia | PASS |
| 8 | Replay corrupto | PASS |
| 9 | Atomicidad inducida | PASS |

Script 6 demostró que COMPLETE puede ejecutarse después de la hora de inicio
aunque la meeting todavía se encuentre dentro de su duración.

Script 8 validó la distinción contractual: `id` malformado →
`INTERNAL_ERROR`; otro UUID válido en `id` → `IDEMPOTENCY_KEY_REUSED`;
`consultationRequestId` inconsistente/corrupto → `INTERNAL_ERROR`.
Durante la preparación se corrigió un defecto de CASE/sintaxis exclusivamente
en el harness, usando `expected_status`. No hubo cambio de producción.

Script 9 validó la atomicidad mediante fallo inducido. Su cleanup informó
`consultation=0`, `meeting=0`, `idempotency=0`, `audit=0` y `trigger=0`.

### Concurrencia real C10–C13

En los cuatro casos, B quedó realmente bloqueada por A y el observador
confirmó el bloqueo. Después del COMMIT de A, B terminó e hizo COMMIT.
La verificación final comparó las filas completas de A con su snapshot,
confirmó que seguían intactas tras el COMMIT de B y eliminó el snapshot.

| Caso | Ganador A | Evidencia del observador | Resultado de B y verificación final |
| --- | --- | --- | --- |
| C10: misma Idempotency-Key | complete_consultation_meeting | PASS C10 bloqueo real B por A | PASS C10 B: replay exacto contra registro persistido; PASS C10 final: filas completas de A intactas tras COMMIT B |
| C11: keys distintas, complete vs no_show | completed/v2 | PASS C11 bloqueo real B por A | PASS C11 B: MEETING_NOT_SCHEDULED, sin registros B; PASS C11 final: filas completas de A intactas tras COMMIT B |
| C12: reprogramación vs resultado | scheduled/v2 reprogramada | PASS C12 bloqueo real B por A | PASS C12 B: MEETING_VERSION_CONFLICT, solo reprogramacion; PASS C12 final: filas completas de A intactas tras COMMIT B |
| C13: cancelación vs resultado | cancelled/v2 | PASS C13 bloqueo real B por A | PASS C13 B: MEETING_NOT_SCHEDULED, solo cancelacion; PASS C13 final: filas completas de A intactas tras COMMIT B |

**C10, C11, C12 y C13: PASS completo.** En C12 y C13, B intentó COMPLETE
con otra key y versión anterior.

El primer intento de C10 se interrumpió porque B tenía
`statement_timeout=5min` y el tiempo manual entre ventanas superó ese límite.
Se limpió el fixture de forma controlada y se repitió con un timeout mayor.
La repetición definitiva pasó completamente. El primer timeout fue una
incidencia de ejecución manual, no un fallo de producción.

### Cleanup final de concurrencia

**PASS**, con estos conteos post-COMMIT:

| Entidad | Residuos |
| --- | --- |
| consultation_residue | 0 |
| meeting_residue | 0 |
| idempotency_residue | 0 |
| audit_residue | 0 |

Después se ejecutó `DROP TABLE pg_temp.cleanup_4d3b_manifest;`, con resultado
`DROP TABLE`. La sesión terminó en `postgres=>`.
La evidencia final informa que no quedaron residuos sintéticos.
No se deja cleanup de C10–C13 como tarea pendiente.

### Estado de cierre y limitaciones aceptadas

- **Implementación PostgreSQL: terminada.**
- **Validación remota principal: terminada**, incluyendo estructura,
  scripts 1–4 y 6–9, concurrencia C10–C13 y cleanup final 0/0/0/0.
- **Concurrencia C10–C13: PASS. Atomicidad: PASS. Cleanup final: 0/0/0/0.**
- **Script 5, batería A–D: PRECONDICIÓN NO DISPONIBLE.** No existían
  simultáneamente admin activo, dos vendedoras activas, agendadora activa y
  programa activo sin modificar usuarios reales. La batería no pudo ejecutarse
  y no se declara PASS, ni se infiere su resultado de los demás scripts.
- **Actor inactivo: NO EJECUTADO — LIMITACIÓN ACEPTADA DE VALIDACIÓN REMOTA.**
  No se modificaron usuarios reales para fabricar el caso. El contrato está
  cubierto por implementación/tests estáticos, pero no por ejecución PostgreSQL
  remota específica. No se declara PASS.
- **4D.3B cerrada técnicamente con estas limitaciones explícitas.** Se acepta
  no ejecutar la prueba remota de actor inactivo ni fabricar las precondiciones
  faltantes de Script 5 mediante creación, desactivación o modificación de
  usuarios reales. No se deben alterar identidades reales ni datos legítimos
  exclusivamente para satisfacer una prueba de validación. Ambas limitaciones
  quedan aceptadas y documentadas; su aceptación no equivale a PASS.

El contrato de autorización descrito arriba permanece como contrato de
implementación; no constituye evidencia de ejecución de la batería no ejecutada.
Esto no cierra toda 4D.3: Express/backend HTTP, frontend API y UI de resultados
corresponden a fases posteriores.

**Cierre técnico y documental de 4D.3B: APROBADO PARA STAGING**, con las
limitaciones de validación remota anteriores aceptadas explícitamente.

## 4D.3C — Backend Express de resultados — 2026-10-20

Implementación local lista para auditoría, sin staging, commit ni push.

### Contrato HTTP y arquitectura

| Endpoint | RPC | Status de respuesta |
| --- | --- | --- |
| PATCH /api/admin/meetings/:id/complete | complete_consultation_meeting | completed |
| PATCH /api/admin/meetings/:id/no-show | mark_consultation_meeting_no_show | no_show |

Pipeline: authenticate → authorize('admin', 'vendedora') → controller → service
→ repository → una RPC. Agendadora recibe 403 antes del controller. Actor
exclusivamente de req.user.id, resuelto por authenticate desde el perfil interno
activo; no se usan roles de metadata JWT, body, query o cabeceras auxiliares.
La RPC revalida actividad, rol y ownership actual bajo lock, también en replay.
Admin activo puede operar sobre cualquier meeting elegible; vendedora activa
solo sobre su meeting. Express no realiza SELECT previo de meeting ni escribe
directamente tablas; la consulta de autenticación a internal_users permanece.

Se exige autenticación Bearer válida, Content-Type application/json (también
charset=utf-8) y exactamente una Idempotency-Key UUID. Se detectan duplicados
en rawHeaders sin distinguir casing. Meeting ID y key: formato canónico de
36 caracteres, sin coerción ni trim, normalizados lowercase tras validación.
Node puede eliminar espacios HTTP periféricos de headers antes del service.

Body exacto para ambos comandos:

```json
{ "expectedVersion": 1 }
```

Objeto JSON plano con una única propiedad propia. Extras, símbolos, accesores
o herencia personalizada: INVALID_REQUEST. Campo ausente o valor inválido:
INVALID_MEETING_INPUT. expectedVersion debe satisfacer Number.isInteger y estar
entre 1 y 2147483647 inclusive, sin coerción. Se rechazan strings, booleanos,
null, fracciones, NaN, infinitos y BigInt. No se aceptan status, reason, notes,
role, assigned_to, assignedTo, actor, hash ni key en el body.
express.json() sigue antes de authenticate: JSON malformado o primitivas
rechazadas por el parser pueden producir INVALID_JSON antes de autenticar.

normalizeOutcome construye exactamente, en este orden:

```js
{ meetingId: normalizedMeetingId, expectedVersion: expectedVersion }
```

Hash SHA-256 de JSON.stringify(payload), UTF-8, hexadecimal lowercase. No incluye
actor, operation, key ni status. Cada repository pasa exactamente p_actor_id,
p_meeting_id, p_idempotency_key, p_request_hash y p_expected_version a su RPC.
No hay retries automáticos, locks JavaScript, replay local ni consultas
comerciales auxiliares. Los mensajes históricos permanecen intactos.

### Idempotencia, versión y tiempo

El ámbito sigue siendo (actor_id, operation, idempotency_key). Misma operación,
actor, key y payload recupera la fotografía persistida; otro hash/meeting en
ese ámbito produce IDEMPOTENCY_KEY_REUSED. La misma key en la otra operación
no es replay: cada RPC tiene su ámbito. Si el primer comando ya terminó la
meeting, el segundo comando nuevo encuentra MEETING_NOT_SCHEDULED.
Los reintentos del cliente deben conservar ruta, key y payload originales.

Express valida estructura/rango incluso en replay, pero no compara versión
actual ni tiempo. PostgreSQL revalida autorización/ownership actuales; un
replay autorizado no revalida status, versión, tiempo ni estado mutable del
padre. Un comando nuevo valida status antes de comparar versión. El máximo
2147483647 es una entrada válida; si la versión actual no puede incrementarse,
la RPC produce INTERNAL_ERROR, sin reiniciar ni envolver el contador.

PostgreSQL decide complete desde clock_timestamp() >= scheduled_at y no-show
desde clock_timestamp() >= scheduled_at + duration_minutes minutos, después
de locks. Express no calcula elegibilidad temporal. MEETING_TOO_EARLY se
traduce a 422. Completed significa reunión realizada, no venta cerrada.
La consultation permanece converted sin modificar updated_at. Los estados
terminales no se reabren; puede crearse otra meeting posteriormente bajo el
contrato existente si no hay una scheduled. No se añade reason ni notes.

### Respuesta y errores

Éxito y replay: 200 con {data: resultado}. Se validan y proyectan únicamente
id, consultationRequestId, scheduledAt, timeZone, durationMinutes, mode,
status y version. UUID válidos, id igual al solicitado, timestamp válido y
finito, zona string no vacía, duración integer 1–2147483647, mode online/phone/
office, status exacto del comando y versión integer 2–2147483647. Los extras
se descartan. Una respuesta inválida produce 500 INTERNAL_ERROR.
Se conservan timestamp y microsegundos sin reformatear; se reutiliza el rango
HTTP 0001–10000, sin ampliar a todo PostgreSQL ni cambiar filtros de Agenda.
No se reconstruye la fotografía desde tablas ni se compara con estado actual.

| Código/condición | HTTP |
| --- | --- |
| INVALID_REQUEST, INVALID_MEETING_INPUT, INVALID_MEETING_ID, INVALID_IDEMPOTENCY_KEY, INVALID_JSON | 400 |
| Autenticación ausente/inválida | 401 |
| Perfil inexistente/inactivo o rol rechazado por middleware | 403 |
| ACTOR_NOT_ALLOWED | 403 |
| MEETING_NOT_FOUND | 404 |
| MEETING_NOT_SCHEDULED, MEETING_VERSION_CONFLICT, CONSULTATION_STATE_INCONSISTENT, IDEMPOTENCY_KEY_REUSED | 409 |
| MEETING_TOO_EARLY | 422 |
| WORKFLOW_ISOLATION_NOT_SUPPORTED, INTERNAL_ERROR | 500 |
| Error SQL desconocido, transporte o respuesta corrupta | 500 INTERNAL_ERROR |

Contexto outcome para mensajes específicos:

- ACTOR_NOT_ALLOWED: "No tienes permisos para registrar el resultado de esta reunión."
- MEETING_NOT_SCHEDULED: "Solo se puede registrar el resultado de una reunión programada."
- CONSULTATION_STATE_INCONSISTENT: "La solicitud requiere revisión antes de registrar el resultado de la reunión."
- MEETING_TOO_EARLY: "Aún no se puede registrar este resultado de la reunión."

Los demás mensajes conservan el contrato existente. Traducción cerrada por
SQLSTATE P0001 y mensaje exacto en allowlist. Errores de dominio mantienen
{error: {code, message}}; middleware conserva respuestas históricas sin code.
Details, hint, cause, stack y mensajes arbitrarios no se exponen. Los logs de
500 conservan exclusivamente evento, statusCode y código público controlado.

### Validación local y alcance

Se añaden 248 pruebas en meetings.test.mjs, parametrizadas para ambas rutas:
métodos, roles, actor interno, rechazo RPC de ownership, headers, UUID, body
estricto, límites, hash, cinco argumentos, llamada única, mappings, sanitización,
respuestas corruptas, minimización, microsegundos, año 10000 y replay simulado.
El fake sustituye Supabase antes de cargar configuración: no se lee .env ni
se contacta a servicios remotos. No se modificó el mecanismo de loopback.

El primer targeted en sandbox dio 248 tests: 7 pass y 241 fail por bloqueo
EACCES de loopback (incluidas assertions que esperaban 404 y recibieron EACCES).
La repetición con permiso para loopback del mismo targeted dio **248/248 pass**,
0 fail/cancelled/skipped/todo. Comando:

```text
node --experimental-vm-modules --test --test-reporter=tap --test-name-pattern=outcome backend/tests/meetings.test.mjs
```

Suite completa con loopback habilitado, desde backend mediante npm test:
**914 tests, 914 pass, 0 fail, 0 cancelled, 0 skipped, 0 todo**. Incluye las
regresiones de creación, listado, reprogramación, cancelación, mensajes
históricos, error-handler y contratos estáticos de migraciones.

Estos mocks HTTP no prueban locks PostgreSQL, concurrencia, atomicidad ni
temporalidad reales; esa evidencia y sus limitaciones siguen en 4D.3B.
No se ejecutó SQL/HTTP remoto ni se alteraron migrations, schema, RLS, grants,
índices, dependencias, frontend, app.js, middleware globales o usuarios reales.
El alcance local se limita a los cinco archivos del módulo meetings, su suite
y esta documentación. Sin staging, commit ni push.

## 4D.4B.1A — Meeting Context Schema

Checkpoint cerrado el 2026-10-22: schema compatible aplicado y validado en
Supabase remoto. Este cierre corresponde únicamente a **4D.4B.1A**, no a toda
4D.4B. La evidencia remota de esta sección fue proporcionada por el responsable
del proyecto; durante el cierre documental no se repitieron comandos remotos.

### Objetivo y migration

La migration `20261022010000_meeting_context_schema.sql` incorpora contexto de
atribución, una revisión de agenda y el límite DB de notas, sin modificar los
workflows existentes. Es transaccional (`BEGIN`/`COMMIT`), exige UTF8 antes de
instalar el helper y no oculta drift mediante `IF NOT EXISTS`.

| Columna de public.meetings | Definición | Semántica |
| --- | --- | --- |
| booked_by | uuid nullable, sin default | Autoría de la reserva; no equivale a created_by |
| role_at_booking | text nullable, sin default | Snapshot del rol: admin o agendadora |
| booking_attribution_source | text NOT NULL DEFAULT 'unknown' | unknown, explicit, verified_backfill o administrative_correction |
| schedule_revision | integer NOT NULL DEFAULT 1 | Contador positivo reservado para futuros workflows |

`unknown` exige `booked_by` y `role_at_booking` NULL. Los otros tres sources
exigen ambos campos no NULL. Los históricos quedan NULL/NULL/unknown: no hubo
backfill desde `created_by` ni desde el rol actual de `internal_users`.
La obligatoriedad de atribución explícita para nuevas reuniones aún NO está
activa; los INSERT legacy pueden seguir omitiendo estas columnas.

`schedule_revision` inicia en 1 y todavía **NO es una garantía logística**.
Reschedule legacy no la incrementa; cancel, complete y no-show también
preservan su valor. No hay trigger ni sincronización con `version`. No debe
usarse todavía para confirmation, resources o jobs.

### Notes, helper y seguridad

Notes admite NULL o un máximo de **2000 unidades UTF-16**. El helper
`public.utf16_length(text)` equivale a JavaScript `.length` para texto Unicode
válido: cada punto BMP aporta 1 y cada suplementario aporta 2. Vacío devuelve
0 y NULL devuelve NULL. No hubo canonicalización, normalización ni truncamiento
de notas históricas; el CHECK se añadió con validación normal, sin `NOT VALID`.

El helper retorna bigint y es LANGUAGE SQL, IMMUTABLE, STRICT, PARALLEL SAFE,
SECURITY INVOKER, con `search_path = pg_catalog, pg_temp`. El catálogo remoto
confirmó EXECUTE para postgres y service_role, sin acceso para anon ni
authenticated. La migration revoca explícitamente PUBLIC y los roles indicados
antes de conceder EXECUTE a service_role. RLS y permisos de tabla se preservan;
no se añaden policies ni grants de navegador.

### Evidencia remota de aplicación y catálogo

El preflight remoto READ-ONLY fue aprobado: PostgreSQL 17.6, UTF8, collation
determinista, sin drift y únicamente esta migration pendiente. Se reportaron
0 notes por encima de 2000 unidades UTF-16, 0 datos inválidos y 0 referencias
huérfanas; RLS activo, sin policies de navegador, grants esperados y RPC legacy
intactas. `db push --dry-run` mostró únicamente esta migration.

Posteriormente se aplicó correctamente mediante
`npx supabase@2.120.0 db push`. `migration list --linked` confirmó
`20261022010000` local = remote. La validación PostgreSQL real confirmó las
cuatro columnas y sus tipos, nullabilidad y defaults descritos arriba.

Las seis constraints siguientes quedaron con `convalidated = true`:

- `meetings_booked_by_fkey`: referencia a public.internal_users(id), ON DELETE RESTRICT y ON UPDATE NO ACTION.
- `meetings_role_at_booking_valid`: NULL, admin o agendadora.
- `meetings_booking_attribution_source_valid`: los cuatro sources documentados.
- `meetings_booking_attribution_consistent`: coherencia NULL-safe de atribución.
- `meetings_schedule_revision_positive`: schedule_revision > 0.
- `meetings_notes_utf16_length_valid`: notes IS NULL OR public.utf16_length(notes) <= 2000.

Se confirmó `meetings_booked_by_scheduled_at_idx`, índice B-tree no unique y
no parcial, con orden `(booked_by, scheduled_at)`.

### Validación Unicode real y compatibilidad

Estas pruebas se ejecutaron en PostgreSQL, además de los fixtures JavaScript:

| Entrada | Resultado utf16_length |
| --- | --- |
| NULL | NULL |
| Cadena vacía | 0 |
| abc | 3 |
| á | 1 |
| a + U+0301 | 2 |
| Símbolo BMP | 1 |
| Emoji suplementario | 2 |
| Secuencia con variation selector validada | 2 |
| Secuencia ZWJ 👩‍💻 | 5 |
| 1000 emojis suplementarios | 2000 |
| 1001 emojis suplementarios | 2002 |

No se modificaron create, reschedule, cancel, complete ni no-show. Las cinco
RPC legacy conservan SECURITY INVOKER, VOLATILE,
`search_path = pg_catalog, pg_temp` y `TimeZone = UTC`. Los INSERT usan listas
explícitas y las respuestas JSON proyectan campos explícitos; las columnas
nuevas no amplían DTO históricos. Hashes, replays, response payloads, audit
actions e idempotency operations permanecen intactos.

### Tests, límites y próximo checkpoint

Resultados locales registrados: **27/27 focalizados PASS** en
`meeting-context-schema-migration.test.mjs` y **941/941 backend PASS**.
La suite estática comprueba el contrato SQL y los fixtures JS; la evidencia
PostgreSQL real anterior es independiente. No se repitieron tests en este
cierre porque únicamente se modificó documentación.

Todavía no existen las RPC `update_meeting_notes` ni
`correct_meeting_booking_attribution`; tampoco create v2, incremento logístico
de schedule_revision, recursos, Zoom, confirmation ni reminders. Esta fase
no habilita consumidores logísticos ni atribución obligatoria en create legacy.

Próximo checkpoint: **4D.4B.1B — meeting context workflows**.

## 4D.4B.1B — Meeting context workflows: evidencia de validación

Cierre documental del checkpoint con evidencia proporcionada por el responsable
del proyecto. Las pruebas descritas se realizaron antes de esta actualización;
en esta tarea no se ejecutaron SQL, comandos remotos ni tests. Esta sección
actualiza el estado posterior a 4D.4B.1A sin reescribir su registro histórico
ni declarar cerrada toda 4D.4B.

### Aplicación y objetos instalados

La migration `20261022020000_meeting_context_workflows.sql` fue aplicada
correctamente a Supabase remoto. El preflight había confirmado que era la
única pendiente; la lista de migrations local/remota quedó alineada.

Objetos instalados y verificados:

- `public.canonicalize_meeting_notes(text)`.
- `public.update_meeting_notes(uuid,uuid,integer,text,text)`.
- `public.correct_meeting_booking_attribution(uuid,uuid,uuid,text,integer,uuid,text,text)`.

Los tres son SECURITY INVOKER con `search_path = pg_catalog, pg_temp`.
El canonicalizer es IMMUTABLE, STRICT y PARALLEL SAFE. Las RPC mutantes son
VOLATILE y PARALLEL UNSAFE, con TimeZone=UTC. EXECUTE efectivo confirmado
solo para postgres y service_role, sin anon/authenticated.

Las constraints cerradas de audit/idempotency se ampliaron y quedaron
validadas, conservando los valores históricos: audit añade únicamente
`meeting_notes_updated` y `meeting_booking_attribution_corrected`;
idempotency añade únicamente `correct_meeting_booking_attribution`.
Notes no utiliza Idempotency-Key.

### Canonicalizer: PostgreSQL remoto real

Se probó el conjunto completo de whitespace ECMAScript:
U+0009–U+000D, U+0020, U+00A0, U+1680, U+2000–U+200A,
U+2028, U+2029, U+202F, U+205F, U+3000 y U+FEFF.

Resultados registrados:

- `edge_trim_failures=0`.
- `internal_preservation_failures=0`.
- `whitespace_to_null_failures=0`.
- NULL y cadena vacía devuelven NULL.
- U+0085 y U+200B se preservan, al igual que los espacios internos.
- El contenido no se normaliza Unicode.

En Windows se construyó Unicode mediante `chr()` por limitaciones de codepage
del cliente psql. Fue una limitación del cliente, no un defecto de PostgreSQL
ni de las RPC.

### update_meeting_notes: PostgreSQL remoto real

| Caso probado | Resultado observado |
| --- | --- |
| Happy path scheduled | Canonicalización correcta, changed=true, version 1→2 y schedule_revision preservado. Una auditoría meeting_notes_updated sin contenido de notes en metadata. ROLLBACK final sin residuos. |
| No-op | changed=false; version, schedule_revision, updated_by y updated_at intactos; sin audit. |
| CAS incorrecto | MEETING_VERSION_CONFLICT y cero mutaciones. |
| 1000 emojis suplementarios | 2000 unidades UTF-16, aceptados. |
| 1001 emojis suplementarios | 2002 unidades UTF-16, INVALID_MEETING_NOTES. |
| Actor vendedora | ACTOR_NOT_ALLOWED. |
| Reason en scheduled | INVALID_CORRECTION_REASON. |
| Terminal sin reason | INVALID_CORRECTION_REASON. |
| Terminal con admin y clerical_error | Éxito. |

La rama de agendadora no se forzó porque no había una agendadora activa
disponible. No se modificaron usuarios reales para crear esa precondición;
esa rama no queda acreditada por ejecución remota en esta evidencia.

### correct_meeting_booking_attribution: PostgreSQL remoto real

| Caso probado | Resultado observado |
| --- | --- |
| Happy path | De unknown a UUID de usuario admin / rol admin / administrative_correction; changed=true, version 1→2, schedule_revision preservado, una auditoría y un idempotency record. |
| Replay misma key/hash | Snapshot exacto, sin nuevas escrituras. |
| Target vendedora, rol solicitado admin estructuralmente válido | BOOKING_ATTRIBUTION_TARGET_NOT_ELIGIBLE. |
| Target admin, rol solicitado agendadora | BOOKING_ATTRIBUTION_ROLE_MISMATCH. |
| Key reutilizada con hash distinto después de corrección válida | IDEMPOTENCY_KEY_REUSED; estado ganador intacto, exactamente 1 audit y 1 idempotency record. |
| Actor vendedora | ACTOR_NOT_ALLOWED; sin mutación, audit ni idempotency. |
| Reason libre | INVALID_CORRECTION_REASON; sin mutación, audit ni idempotency. |
| expectedVersion stale | MEETING_VERSION_CONFLICT; sin mutación, audit ni idempotency. |
| Cambio real con version=2147483647 | INTERNAL_ERROR; meeting intacta, 0 audit y 0 idempotency. |

El no-op idempotente se probó con atribución ya igual a usuario admin / rol
admin / administrative_correction, version=5 y schedule_revision=9.
Devolvió changed=false, conservó updated_by y updated_at (sin UPDATE real),
produjo 0 audit y exactamente 1 idempotency record. El replay fue exacto y
mantuvo los conteos en 0 audit / 1 idempotency.

Para replay corrupto se insertó manualmente, como fixture, un response_payload
estructuralmente inválido. Misma key/hash produjo INTERNAL_ERROR; meeting
intacta, 0 audit y ningún idempotency record nuevo. El único registro era el
fixture corrupto original. ROLLBACK dejó cero residuos.

### Concurrencia PostgreSQL remota: dos sesiones reales

| Carrera probada | Bloqueo y resultado observado |
| --- | --- |
| Misma Idempotency-Key y mismo hash | A realizó el cambio y mantuvo la transacción abierta. B quedó bloqueada hasta COMMIT de A y devolvió replay exacto. Estado final version=2, schedule_revision preservado, exactamente 1 audit y 1 idempotency. Cleanup explícito: 0 residuos. |
| Keys distintas y mismo expectedVersion | Una sesión ganó; la segunda esperó resolución y terminó MEETING_VERSION_CONFLICT. Una sola mutación, una auditoría y un registro idempotente del ganador. Cleanup explícito: 0 residuos. |

Estos resultados acreditan esas dos carreras. No se presentan como ejecución
de toda la matriz de concurrencia diseñada en la auditoría, incluidas las
carreras con notes, cancel, reschedule o cambios de actividad/rol del target.

### Atomicidad inducida: PostgreSQL 18 local AISLADO

Estas pruebas NO se realizaron en Supabase remoto. Se creó la base temporal
`globalexchange_4d4b1b_atomicity_test`, con un schema auth.users mínimo
exclusivamente para la FK local y roles temporales anon, authenticated y
service_role. Se aplicaron correctamente las 12 migrations reales del
repositorio, en orden.

Los triggers de fallo fueron instrumentación temporal de este entorno
aislado; no se añadieron a las migrations del repositorio.

| Prueba | Fallo inducido y resultado observado |
| --- | --- |
| A. Notes: fallo audit | Un trigger temporal rechazó INSERT de meeting_notes_updated después del UPDATE. ROLLBACK TO SAVEPOINT restauró notes, version, schedule_revision, updated_by y updated_at; audit=0. |
| B. Attribution: fallo audit | Un trigger temporal rechazó meeting_booking_attribution_corrected. Se revirtió el UPDATE previo; atribución, versión, schedule_revision y timestamps originales; audit=0, idempotency=0. |
| C. Attribution: fallo idempotency | Falló INSERT idempotency_records después de UPDATE + audit. PostgreSQL revirtió ambos; estado inicial intacto, audit=0, idempotency=0. |
| D. Attribution no-op: fallo idempotency | El fixture ya tenía la atribución solicitada. Falló la persistencia idempotente; meeting idéntica, audit=0, idempotency=0. |

Cleanup local confirmado después del rollback:

- `auth_residue=0`.
- `internal_user_residue=0`.
- `consultation_residue=0`.
- `meeting_residue=0`.
- `audit_residue=0`.
- `idempotency_residue=0`.
- 0 triggers temporales.

Posteriormente se ejecutó
`DROP DATABASE globalexchange_4d4b1b_atomicity_test WITH (FORCE)` y se
eliminaron los roles temporales service_role, authenticated y anon.
La verificación final confirmó base y roles inexistentes.

La atomicidad inducida queda respaldada en PostgreSQL 18 local con esos
fixtures; no se extrapola como una prueba de fallos inducidos en Supabase
remoto ni como equivalencia completa de su entorno de autenticación.

### Tests registrados y límites del checkpoint

Se conserva la validación focalizada previamente registrada:
**52/52 targeted migration tests PASS**.

Después de actualizar esta documentación se volvió a ejecutar la suite backend
completa: **993/993 PASS**, con 0 fail, 0 cancelled, 0 skipped y 0 todo.

No se modificaron las RPC legacy. Create/reschedule todavía no escriben la
nueva atribución como garantía completa: corresponde al checkpoint posterior
**4D.4B.1C**. schedule_revision todavía no debe presentarse como garantía
logística integral hasta evolucionar los escritores correspondientes.

La evidencia anterior no acredita casos reales no reportados, como replay
tras desactivar al target, todas las combinaciones de roles/estados o toda
la matriz de concurrencia. No se implementan recursos, Zoom, availability,
confirmation ni reminders en este cierre. El estado documentado corresponde
únicamente a **4D.4B.1B**, no al cierre de toda 4D.4B.
