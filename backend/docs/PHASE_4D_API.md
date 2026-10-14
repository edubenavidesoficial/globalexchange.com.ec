# Fase 4D.1A: PostgreSQL para reprogramar reuniones

Migración `20261013211621_reschedule_meeting_workflow.sql` aplicada correctamente
a Supabase remoto; historial local/remoto alineado. Todavía NO existe el endpoint Express
`PATCH /api/admin/meetings/:id/schedule`; su implementación corresponde a 4D.1B.
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

El futuro HTTP admitirá admin/agendadora y rechazará vendedora antes de RPC.
El actor deberá derivarse del perfil interno autenticado; la DB vuelve a exigir
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
recalcularlo. Sigue el requisito actual de hash no vacío. En 4D.1B será SHA-256
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
Otros errores de integridad se propagan y requieren sanitización en el futuro HTTP.

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
El futuro HTTP responderá 200 con {data: resultado} tanto en éxito como en replay.
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

No hay mapping HTTP nuevo todavía. El adaptador futuro debe reconocer códigos
por lista cerrada; jamás interpretar texto libre ni reenviar detalles SQL.
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

## Validaciones todavía pendientes

Esta prueba secuencial NO valida dos sesiones simultáneas: quedan pendientes
same-key concurrent real y different-key simultaneous version conflict real.
Tampoco acredita toda la matriz de revocación/permisos, replay vencido/tras cambio
de estado, fotografía corrupta, overflow, padre inconsistente, estados terminales,
DST, fecha vencida esperando locks ni fallos inducidos de audit/idempotencia.
El rollback total del fixture sí quedó comprobado empíricamente.
