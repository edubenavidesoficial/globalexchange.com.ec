# Fase 4B: confirmación de reuniones, selector de vendedoras y cierre E2E

Endpoint implementado: `POST /api/admin/consultations/:id/meeting`.
Complementa `PHASE_4B_DATABASE.md`; no modifica migraciones ni la RPC desplegada.

## Cierre de Fase 4B

La prueba E2E real fue completada exitosamente, según la validación confirmada
por el responsable del proyecto. Este cierre registra esa evidencia; no implica
una nueva ejecución E2E, consultas remotas ni creación de registros durante la
edición documental.

| Subfase | Alcance | Estado final |
|---|---|---|
| 4B.1 | DB + RPC transaccional | COMPLETADA |
| 4B.2 | POST backend confirmar reunión | COMPLETADA |
| 4B.3 | Prueba E2E real | COMPLETADA |
| 4B.4A | GET vendedoras disponibles | COMPLETADA |
| 4B.4B | API frontend reuniones | COMPLETADA |
| 4B.4C | UI Agendar reunión | COMPLETADA |

### Evidencia E2E real

La validación confirmó un administrador autenticado, una vendedora activa
disponible y una solicitud real pending. Se abrió el modal Agendar reunión,
se seleccionó la vendedora y una fecha/hora futura, y se realizó el POST
autenticado con respuesta exitosa.

Se comprobó la creación de una meeting scheduled, el cambio de
consultation_request de pending a converted y la persistencia de auditoría e
idempotencia. El frontend volvió a consultar la bandeja y mostró Convertida.

Se excluyen deliberadamente UUID reales, correos del administrador y de la
vendedora, tokens, Idempotency-Key real, request_hash real, datos personales del
solicitante, notas reales y credenciales. Los ejemplos de contrato existentes
siguen siendo sintéticos.

### Decisiones de negocio y seguridad

- Una solicitud puede tener varias reuniones/intentos durante su ciclo de vida,
  pero solo una meeting scheduled simultánea.
- Reprogramar será una actualización de la misma meeting. cancelled/no_show
  podrá permitir otro intento posterior; completed bloquea nuevas reuniones
  en esta fase.
- converted significa que existe al menos una reunión confirmada; no significa
  venta ni cliente.
- La UI actual Agendar reunión se limita a solicitudes pending. Los workflows
  posteriores se implementarán desde Agenda.
- El rol se resuelve en backend mediante internal_users. El frontend usa el
  perfil autorizado por Express, no metadata ni el rol del JWT como autorización.
- La Idempotency-Key del intento se mantiene en memoria en el frontend. Un retry
  de resultado incierto conserva la misma key y el mismo payload; el registro de
  idempotencia se persiste en backend/DB.
- Los secretos Supabase permanecen en backend. El frontend solo utiliza
  credenciales públicas autorizadas; no se documentan valores reales.

### Siguiente fase: Agenda de reuniones

Consultar reuniones persistidas desde meetings y construir la vista operativa
del CRM. Quedan pendientes las decisiones de acceso de la vendedora sobre la
Agenda. Este cierre no define endpoints definitivos ni permisos nuevos.

## Arquitectura y autorización

La ruta administrativa existente compone authenticate -> authorize('admin',
'agendadora') -> meetings.controller -> meetings.service -> meetings.repository
-> supabase.rpc('create_consultation_meeting'). El actor procede exclusivamente de
req.user.id. No se confía en metadata JWT, body, query ni cabeceras de identidad.
Vendedora recibe 403 antes del controller. Authenticate conserva sus reglas de
401 para identidad inválida y 403 para falta de perfil interno activo.

No hay consultas comerciales previas, comprobación JS de active/role de la
asignada, inserts directos, transacciones JS ni escrituras auxiliares. La consulta
de internal_users propia de authenticate se mantiene. DB verifica nuevamente
actor y asignada, estado, historial, zona/futuro, concurrencia e idempotencia y
persiste reunión, conversión y auditoría atómicamente.

## Contrato HTTP

Cabeceras:

- Authorization: Bearer con sesión interna válida.
- Content-Type: application/json (también con charset=utf-8). Ausente,
  text/plain o application/x-www-form-urlencoded: 400 sin RPC.
- Idempotency-Key: exactamente una cabecera con un UUID canónico 8-4-4-4-12.
  El nombre es case-insensitive. Se rechazan duplicados, listas, valores vacíos
  y claves ausentes. El backend no genera claves.

Body ilustrativo (UUID ficticio):

```json
{
  "date": "2028-02-29",
  "time": "10:30",
  "timeZone": "America/Guayaquil",
  "durationMinutes": 45,
  "mode": "online",
  "assignedTo": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "notes": null
}
```

Los 45 minutos son ejemplo; no existe duración predeterminada.
Se rechazan todos los campos desconocidos, incluidos actorId, status, createdBy,
updatedBy, version, converted, createdAt, updatedAt y requestHash.

| Campo | Validación y normalización |
|---|---|
| :id / assignedTo | UUID canónico exacto, sin trim/coerción; hexadecimal a minúsculas |
| Idempotency-Key | UUID exacto; minúsculas antes de RPC |
| date | YYYY-MM-DD exacto, año 0001–9999 y calendario gregoriano real; sin Date |
| time | HH:mm exacto, 00:00–23:59; sin segundos ni trim |
| timeZone | String con trim, 1–100 caracteres, sin controles; DB valida catálogo |
| durationMinutes | Número entero explícito, 1–2147483647, rango de PostgreSQL integer |
| mode | String con trim; online, phone u office |
| notes | Omitido/null/string; trim y vacío a null; máximo 2000 caracteres; sin NUL |

El límite de notas sigue el límite ya existente para message en el service de
solicitudes. El rango de duración es representacional, no una regla comercial.
La zona usa un límite técnico de 100 caracteres; no se mantiene una lista IANA JS.
La fecha futura se verifica exclusivamente en la RPC: validar el pasado en JS
impediría recuperar un resultado idempotente antiguo.

## Hash y parámetros RPC

Se construye manualmente este objeto, en este orden fijo:

```text
consultationRequestId, date, time, timeZone,
durationMinutes, mode, assignedTo, notes
```

SHA-256 mediante node:crypto sobre JSON.stringify del objeto normalizado, UTF-8,
hexadecimal de 64 caracteres en minúsculas. No se usa el orden del body recibido.
Actor y clave quedan fuera del hash porque ya delimitan la identidad en DB.
notes omitido, vacío, espacios y null producen el mismo hash. UUID con diferente
casing también. Cualquier cambio de un campo canónico modifica el hash.
No cambiar esta normalización u orden sin considerar claves históricas persistidas.

Una única llamada RPC recibe p_actor_id, p_consultation_request_id,
p_idempotency_key, p_request_hash, p_scheduled_date, p_scheduled_time, p_time_zone,
p_duration_minutes, p_mode, p_assigned_to y p_notes. No hay retry automático.

## Respuesta e idempotencia

201 Created con `{ "data": <resultado RPC> }`, donde el resultado contiene
consultation y meeting. Se conserva el resultado estructurado sin reconstruirlo.
Una respuesta RPC nula o sin esos objetos se trata como error interno.

La RPC devuelve el mismo payload para creación y replay y no indica cuál ocurrió.
Ambos responden 201; no se intenta detectarlos ni consultar idempotency_records.
Después de timeout el cliente debe conservar la clave y reenviar el mismo payload
normalizado. Si cambia los datos, debe utilizar otra clave para un nuevo intento
lógico. El replay es una fotografía original; no garantiza estado actual.

## Errores y logs

Se mantiene error.message; los errores controlados de reuniones añaden error.code.
Solo SQLSTATE P0001 con message exactamente perteneciente a la lista cerrada se
traduce como dominio. No se confía en statusCode ni mensajes enviados por DB.

| HTTP | Códigos |
|---|---|
| 400 | INVALID_REQUEST, INVALID_MEETING_INPUT, INVALID_CONSULTATION_ID, INVALID_IDEMPOTENCY_KEY, INVALID_JSON |
| 401 | Autenticación existente: error.message |
| 403 | ACTOR_NOT_ALLOWED; errores existentes de authenticate/authorize mantienen error.message |
| 404 | CONSULTATION_NOT_FOUND |
| 409 | CONSULTATION_CANCELLED, CONSULTATION_ALREADY_SCHEDULED, CONSULTATION_COMPLETED, CONSULTATION_STATE_INCONSISTENT, IDEMPOTENCY_KEY_REUSED |
| 422 | ASSIGNEE_NOT_ELIGIBLE, INVALID_TIME_ZONE, INVALID_LOCAL_TIME, MEETING_NOT_IN_FUTURE |
| 500 | WORKFLOW_ISOLATION_NOT_SUPPORTED, INTERNAL_ERROR |

La validación HTTP local devuelve 400; INVALID_TIME_ZONE desde DB devuelve 422.
Errores RPC desconocidos, transporte rechazado y respuesta inválida devuelven 500
genérico. No se reenvían details, hint, SQL, stack ni causas del proveedor.

El error-handler compartido registra únicamente event=request_failed, statusCode
y un código técnico seguro para 5xx. No registra error.message/stack/cause,
cabeceras, claves idempotentes, notas, contacto ni payload. La sanitización también
evita filtrar el cuerpo en errores de parsing JSON. Este cambio reduce el detalle
diagnóstico global deliberadamente, manteniendo contratos de autenticación y GET.
Solo instancias de AppError identifican errores públicos controlados. Authenticate,
authorize y validaciones de consultations utilizan esta clase sin cambiar sus
mensajes ni reglas; MeetingError la extiende conservando su lista cerrada.
Un error desconocido, incluso con statusCode 400/404, code o expose=true, devuelve
500 genérico. El parsing JSON tiene una traducción fija a INVALID_JSON que nunca
refleja campos del error original. Los mensajes de cualquier 5xx son genéricos.

## Pruebas y límites

Ejecutar `npm test` desde backend, con Node 24 y dependencias existentes.
Se utiliza node:test y VM Modules, siguiendo el enfoque de la suite frontend.
App, Express, rutas, middlewares, controllers, services y repositories son reales;
solo se sustituye el cliente Supabase antes de cargar su configuración. No se
evalúa env.js ni dotenv. HTTP se prueba únicamente en loopback con puerto efímero.

Las 124 pruebas de Fase 4B.2 cubren roles, identidad, campos obligatorios, valores inválidos,
cabeceras duplicadas, normalización/hash, once argumentos, códigos RPC, logs,
respuesta/replay 201 y regresiones de GET solicitudes, auth/me, health y validación
pública. Incluyen cinco variantes de Content-Type y diez pruebas directas del
handler: errores controlados, estados externos 400/404/500 o ausentes, flags no
confiables, campos sensibles, parsing y logs sanitizados. La VM puede emitir la
advertencia experimental de Node y la advertencia
de Express sobre Promise de otro contexto; no ocurren por esta causa en producción.
No hay dependencias nuevas ni comando lint preexistente en backend.

Durante estas pruebas automatizadas no se ejecutó SQL ni se contactó Supabase.
La suite por sí sola no acredita el despliegue remoto ni vuelve a probar los
locks PostgreSQL. La E2E real posterior está completada y registrada en la sección
de cierre. Frontend se completó en 4B.4B/4B.4C; Agenda, reprogramación, cancelación
y asistencia siguen fuera del alcance implementado de Fase 4B.

## Fase 4B.4A: vendedoras activas para asignación

`GET /api/admin/internal-users?role=vendedora&active=true`

Cadena: authenticate -> authorize('admin', 'agendadora') -> controller -> service
-> repository existente de internal-users -> Supabase. La identidad y el rol
proceden del perfil interno, no de query, body ni metadata JWT.

El service exige exactamente los parámetros role=vendedora y active=true como
strings, sin trim, coerción ni conversión de mayúsculas. Rechaza parámetros
ausentes, desconocidos, valores distintos y nombres duplicados, incluso si los
valores duplicados coinciden. No es un listado genérico de personal.

El controller extrae la cadena posterior al primer `?` de `req.originalUrl`,
que conserva la URL original dentro del router montado. El service la procesa
con URLSearchParams de node:url, sin límite de pares ni dependencia de req.query.
Exige dos pares en total, una ocurrencia de cada nombre y los valores exactos.
Los nombres codificados se cuentan después de decodificarlos. Así se rechazan
también duplicados o extras tras 1000 separadores que el parser simple de Express
podría omitir. No se cambia el parser global ni se utiliza un host sintético.

El repository impone la consulta fija, independientemente de los valores HTTP:

```js
supabase.from('internal_users')
    .select('id, full_name, role')
    .eq('role', 'vendedora')
    .eq('active', true)
    .order('full_name', { ascending: true })
    .order('id', { ascending: true });
```

Se ejecuta una consulta de listado además de la consulta de perfil propia de
authenticate. No se consulta auth.users ni meetings y no se invoca ninguna RPC.
El service mapea explícitamente solo id, fullName y role; no devuelve active,
email, timestamps, metadata, tokens ni datos de Supabase Auth.

Antes de mapear, valida que el resultado sea un array y cada fila sea un objeto
no nulo, no array, con id UUID canónico 8-4-4-4-12 (la convención del proyecto),
full_name string no vacío tras trim y role exactamente vendedora. El esquema
también exige nombre no vacío. No se transforma ni repara ninguna fila: una
estructura inválida lanza un Error interno y devuelve 500 sanitizado para todo
el resultado, sin registrar filas ni datos personales. Los campos adicionales
en filas válidas se descartan mediante el mapping explícito de tres campos.

Respuesta 200 ilustrativa (datos sintéticos):

```json
{
  "data": [
    {
      "id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "fullName": "Persona de prueba",
      "role": "vendedora"
    }
  ]
}
```

Sin resultados devuelve 200 con `{"data":[]}`.

| HTTP | Situación |
|---|---|
| 400 | Filtros incorrectos; AppError con mensaje fijo, sin reflejar valores |
| 401 | Autenticación ausente o inválida |
| 403 | Vendedora, rol no permitido o perfil interno inexistente/inactivo |
| 500 | Fallo inesperado de Supabase/transporte; mensaje genérico sanitizado |

Se conserva el handler global y su logging limitado a evento, estado y código
seguro. No se registra query, nombres, cabeceras ni errores completos.

La suite suma 184 pruebas: las 124 anteriores, 32 iniciales para este endpoint
y 28 regresiones para query completa y estructura DB,
reutilizando el harness de meetings.test.mjs. Verifican roles, identidad, filtros
estrictos/duplicados, respuesta vacía, mapeo mínimo aun si el mock devuelve campos
extra, selección/filtros/órdenes exactos y fallos sanitizados. Las regresiones de
consultations, confirmación de reuniones, auth/me y health continúan pasando.
Durante la suite no se contactó Supabase remoto ni se crearon usuarios. La E2E
real posterior confirmó la disponibilidad y selección de una vendedora activa.
La RPC conserva la validación de elegibilidad al confirmar: el listado por sí
solo no garantiza que el perfil siga activo. Se conserva el último total
documentado de 184 pruebas backend; no se reejecutó la suite para este cierre
puramente documental.
