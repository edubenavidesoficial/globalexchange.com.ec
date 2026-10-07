# Fase 4B.1: modelo PostgreSQL y confirmacion transaccional

La migracion `20261007040229_create_meetings_workflow.sql` prepara exclusivamente tablas,
indices, permisos y `public.create_consultation_meeting`. No modifica 001-006,
backend JS ni frontend. No incorpora endpoints, Agenda ni operaciones de cambio
de estado. El esquema remoto fue verificado manualmente por el usuario; no se
contacto Supabase durante esta implementacion.

## Decisiones aprobadas

- Una solicitud tiene muchas reuniones historicas (1:N), pero como maximo una
  `scheduled`. El indice UNIQUE es parcial; no hay UNIQUE permanente por solicitud.
- `converted` significa que la solicitud origino al menos una reunion confirmada
  y persistida. No significa cliente, oportunidad ni venta.
- La primera reunion convierte `pending` a `converted`; intentos posteriores no
  cambian ese estado ni `consultation_requests.updated_at`.
- Despues de `cancelled` o `no_show` puede crearse otro intento con una clave nueva.
  Cualquier `completed` impide nuevas reuniones de esa solicitud en esta fase.
- Una solicitud `cancelled` se cerro antes de convertirse y no admite reuniones.
- Solo admin/agendadora activos crean; solo una vendedora activa puede atender.
- Reprogramar mantendra el ID y generara historial en una futura operacion.

## Tablas e indices

`meetings`: UUID PK; FK obligatorias a solicitud, asignada, creador y ultimo actor,
todas ON DELETE RESTRICT. `scheduled_at` timestamptz finito, `time_zone` no vacio,
duracion y version enteras positivas. Modalidades online/phone/office. Estados
scheduled/completed/cancelled/no_show. Solo `notes` es nullable. Estado inicial
scheduled, version 1, ID generado y timestamps con now(). No hay trigger: las
futuras RPC actualizaran explicitamente version, updated_by y updated_at.

Indices de meetings:

- `meetings_one_scheduled_per_consultation_idx`: UNIQUE parcial por solicitud
  WHERE status='scheduled'; ultima defensa contra dos reuniones activas.
- `meetings_consultation_request_id_idx`: historial completo y comprobaciones de
  estados. No es redundante con el parcial, que excluye reuniones terminadas.
- `meetings_scheduled_at_idx`: agenda global por rango temporal.
- `meetings_assigned_to_scheduled_at_idx`: agenda de una vendedora por rango.
- No se agrega indice aislado de status: poca selectividad y sin consulta inicial
  que lo justifique. Tampoco se duplican los indices PK.

`audit_events`: UUID PK, actor FK RESTRICT, entity_type, entity_id, action,
metadata objeto JSONB (default {}), operation_id y created_at. Un CHECK vincula
exactamente consultation_request/consultation_converted y meeting/meeting_created.
Ampliar ese CHECK cuando existan nuevas operaciones. Indices por entidad/fecha
y operation_id. entity_id es polimorfico, sin FK; la RPC lo obtiene de filas reales.
No se copian contactos, notas, hashes, tokens ni cabeceras en metadata.

`idempotency_records`: UUID PK, actor FK RESTRICT, operation restringida a
create_consultation_meeting, idempotency_key UUID, request_hash no vacio, solicitud
FK RESTRICT, response_payload objeto JSONB obligatorio y created_at. UNIQUE sobre
(actor_id, operation, idempotency_key), sin indice duplicado. Solo se inserta el
resultado completo; no hay reservas pendientes ni necesidad de UPDATE/DELETE.
No se implementa purga ni expiracion en esta fase.

## Firma y contrato RPC

```text
public.create_consultation_meeting(
  p_actor_id uuid,
  p_consultation_request_id uuid,
  p_idempotency_key uuid,
  p_request_hash text,
  p_scheduled_date date,
  p_scheduled_time time without time zone,
  p_time_zone text,
  p_duration_minutes integer,
  p_mode text,
  p_assigned_to uuid,
  p_notes text
) returns jsonb
```

Todos los argumentos deben enviarse; notes admite null. UUID/date/time/integer
invalidos pueden fallar en el casteo PostgreSQL antes de entrar en la funcion.
Express debera validar tipos, derivar actor de la identidad autenticada y calcular
SHA-256 sobre TODOS los parametros de negocio normalizados, incluida la solicitud,
fecha, hora, zona, duracion, modalidad, asignada y notas. La DB no recalcula el hash
ni autentica al humano: confia en ese contrato del backend con service_role.
No aceptar hashes ni actor arbitrarios del navegador.

La respuesta es un objeto con consultation {id,status,updatedAt} y meeting
{id,consultationRequestId,scheduledAt,timeZone,durationMinutes,mode,status,
assignedTo,createdBy,updatedBy,version,createdAt,updatedAt}. No incluye notas ni
contactos. Se almacena y retorna el mismo JSONB. Express podra envolverlo en data.
El replay devuelve una fotografia del resultado original, no el estado actual;
el consumidor debe volver a consultar datos actuales cuando corresponda.

## Transaccion, locks e idempotencia

Una llamada RPC por POST ejecuta todos sus efectos en una transaccion. La funcion
es VOLATILE y exige READ COMMITTED: las sentencias posteriores a un lock necesitan
observar lo confirmado por quien lo tenia antes. Otros niveles fallan explicitamente.

Orden:

1. Validar aislamiento y argumentos identificadores/hash.
2. Advisory transaction lock de 64 bits sobre actor/operacion/clave.
3. Leer actor FOR SHARE y exigir activo con rol admin/agendadora, incluso en replay.
4. Consultar registro idempotente. Mismo hash y solicitud: retornar payload sin
   efectos. Diferencia: IDEMPOTENCY_KEY_REUSED. No validar fecha, asignada ni estado
   mutable antes de devolver un replay autorizado.
5. Leer asignada FOR SHARE y exigir vendedora activa.
6. Bloquear solicitud FOR UPDATE; leer su estado y luego el historial de meetings.
7. Validar coherencia, ausencia de scheduled/completed, campos, zona y futuro.
8. Insertar reunion scheduled/version 1 con actores derivados de parametros validados.
9. Si era pending, convertir, actualizar updated_at e insertar consultation_converted.
10. Insertar meeting_created con el mismo operation_id UUID.
11. Construir resultado, insertar idempotencia y retornarlo.

Todos los locks duran hasta commit/rollback. FOR SHARE bloquea actualizaciones de
active/role (FOR KEY SHARE no las impediria). Si una desactivacion gana primero,
la lectura ve el perfil actualizado y rechaza; si gana la RPC, la desactivacion
espera hasta terminar. No se exige que la asignada permanezca activa para siempre.

El advisory lock funciona aun cuando no existe registro de idempotencia. Una
colision de hash solo provoca espera adicional: la busqueda posterior siempre
compara la tupla completa. No se usa ese hash como request_hash ni como autorizacion.
Claves distintas para la misma solicitud se serializan mediante FOR UPDATE.
La UNIQUE parcial protege tambien inserts directos de dos scheduled.

Las futuras mutaciones deben respetar el protocolo de bloqueo de solicitud antes
de alterar reuniones; no mantener locks durante llamadas a proveedores externos.
Usar una operacion por transaccion. Los errores inesperados se propagan y revierten
todos los efectos; no se devuelve exito parcial ni se almacenan fallos idempotentes.

## Coherencia legacy

CONSULTATION_STATE_INCONSISTENT para pending con historial, cancelled con historial,
converted sin historial, estado de solicitud desconocido/null o estado de reunion
desconocido/null. No se inventa ni repara historial automaticamente.
Converted con scheduled devuelve CONSULTATION_ALREADY_SCHEDULED; con cualquier
completed devuelve CONSULTATION_COMPLETED (tiene prioridad si concurren ambos).
Converted con historial no vacio exclusivamente cancelled/no_show permite otro
intento. Un replay original puede devolverse aunque el estado actual haya cambiado.

## Tiempo

Las preferencias publicas no cambian. La RPC combina date + time y aplica AT TIME
ZONE con un nombre exacto de pg_timezone_names. No depende de la zona de sesion;
la funcion fija UTC para serializar timestamps uniformemente. Guarda el nombre
de zona separado del instante. America/Guayaquil es la zona inicial esperada.

Se rechazan null, fechas infinitas, hora 24:00 y desbordamientos de fecha, modalidad
invalida y duracion no positiva. Un round-trip rechaza horas inexistentes durante
saltos estacionales. Para horas ambiguas se conserva la resolucion de PostgreSQL;
una politica explicita de seleccion de offset queda pendiente antes de expansion
a esas zonas. No se implementan horarios laborales, anticipacion minima ni horizonte.
Se exige scheduled_at > now() y > clock_timestamp() despues de los locks, para no
aceptar una hora que paso durante la espera. No existe CHECK dependiente de now().

## Permisos y limite de confianza

RLS habilitado en las tres tablas, sin politicas para navegador. REVOKE ALL a
PUBLIC, anon, authenticated y service_role antes de los grants minimos, para
neutralizar default grants que pudieran existir. Service_role recibe:

| Objeto | Permisos |
|---|---|
| meetings | SELECT, INSERT, UPDATE |
| audit_events | SELECT, INSERT |
| idempotency_records | SELECT, INSERT |
| RPC (firma exacta) | EXECUTE |

No DELETE ni TRUNCATE operacional. Auditoria e idempotencia son append-only para
service_role, no para el propietario/superusuario. La funcion es SECURITY INVOKER,
search_path=pg_catalog,pg_temp, tablas calificadas public y sin SQL dinamico.
No usa auth.uid(). EXECUTE se revoca a PUBLIC/anon/authenticated/service_role y se
concede solo a service_role. Los permisos previos de internal_users y solicitudes
permiten los locks y la actualizacion necesarios, sin modificar sus grants.

Service_role omite RLS y conserva escritura directa segun los grants aprobados:
la RPC no puede impedir que codigo privilegiado la eluda. CHECK/FK/UNIQUE siguen
aplicando; reglas entre tablas, elegibilidad y auditoria requieren usar la RPC.
No hay garantia de que un insert directo produzca auditoria o respete completed.

## Errores para el futuro adaptador Express

Errores de dominio: SQLSTATE P0001 y message exactamente igual al codigo estable.
Express debera reconocer una lista cerrada de codigos, nunca reenviar mensajes,
detail, hint o context SQL desconocidos. HTTP es orientativo; no hay rutas nuevas.

| Codigo | HTTP sugerido |
|---|---|
| ACTOR_NOT_ALLOWED | 403 |
| ASSIGNEE_NOT_ELIGIBLE | 422 |
| CONSULTATION_NOT_FOUND | 404 |
| CONSULTATION_CANCELLED | 409 |
| CONSULTATION_ALREADY_SCHEDULED | 409 |
| CONSULTATION_COMPLETED | 409 |
| CONSULTATION_STATE_INCONSISTENT | 409; revision operativa |
| IDEMPOTENCY_KEY_REUSED | 409 |
| INVALID_TIME_ZONE | 422 |
| MEETING_NOT_IN_FUTURE | 422 |
| INVALID_LOCAL_TIME | 422 |
| INVALID_REQUEST | 400 |
| INVALID_MEETING_INPUT | 400/422 segun contrato HTTP futuro |
| WORKFLOW_ISOLATION_NOT_SUPPORTED | 500; configuracion incorrecta |

Solo unique_violation del indice meetings_one_scheduled_per_consultation_idx se
traduce a CONSULTATION_ALREADY_SCHEDULED; otras violaciones se propagan. Casts,
errores de infraestructura y constraints inesperados necesitan mapeo sanitizado
en Express. No devolver error.message SQL indiscriminadamente.

## Pendiente y fuera de alcance

Integracion Express y hash canonico; UI y Agenda; reprogramacion, cancelacion,
asistencia y reasignacion; retencion; limites de notas; capacidad/solapamientos
entre solicitudes distintas; duracion comercial; disponibilidad; integraciones
externas; politicas para horas ambiguas internacionales. No hay garantia contra
doble reserva de una vendedora entre solicitudes diferentes.

La migracion no usa IF NOT EXISTS para esconder objetos previos; una segunda
ejecucion debe fallar. No ejecutar 007 contra Supabase como parte de esta entrega.

## Validacion realizada

Se revisaron completas 001-006 y se aplicaron 001-007 en una instancia PostgreSQL
18.6 temporal, aislada en loopback, con roles Auth simulados y datos ficticios.
No se instalaron herramientas. No se uso ninguna base existente ni Supabase.
Se simularon default grants amplios antes de aplicar las migraciones para probar
que las revocaciones eliminan permisos sobrantes.

Pasaron 69 comprobaciones: creacion y conversion atomicas, roles y elegibilidad,
replay identico, hash/solicitud incompatibles, segundo y tercer intento tras
cancelled/no_show, bloqueo por completed, inconsistencias legacy, valores invalidos,
zona/UTC, salto estacional, replay con fecha vencida y asignada inactiva, actor
desautorizado, aislamiento incompatible, RLS y privilegios efectivos por rol.

Pruebas con sesiones simultaneas: misma clave (un resultado), distintas claves y
dos actores (una reunion y un conflicto), desactivacion de asignada antes del lock
(rechazo), desactivacion posterior (espera hasta commit), y fecha que vence mientras
se espera la solicitud (rechazo). El indice parcial rechazo un INSERT duplicado
directo; se verifico su traduccion especifica a error de dominio.

Fallos sinteticos al insertar auditoria y al insertar idempotencia revirtieron
reunion, conversion y eventos. Se comprobo ausencia de notas en auditoria/replay,
las siete FK RESTRICT y ausencia de EXECUTE heredado de PUBLIC. Reejecutar 007
fallo visiblemente por tabla existente. La instancia temporal se detuvo y elimino.

Estas pruebas validan PostgreSQL local, no el despliegue remoto ni el transporte
PostgREST/Express futuro. No se ejecutaron pruebas frontend ni build porque no
hubo cambios en esas capas.
