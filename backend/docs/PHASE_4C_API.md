# Fase 4C.1: lectura administrativa de reuniones

Fuente de verdad: `meetings`. Endpoint `GET /api/admin/meetings`.
Se extiende el módulo meetings existente con router administrativo, controller,
service y repository; no hay frontend, página Agenda ni nuevas mutaciones.

## Autorización y privacidad

Cadena: authenticate → authorize('admin', 'agendadora', 'vendedora') → controller
→ service → repository. req.user procede del perfil internal_users resuelto por
authenticate. Admin/agendadora ven todas las reuniones del rango. Vendedora solo
ve las asignadas a su req.user.id: el repository añade `.eq('assigned_to', id)`
en DB. No descarga todas las reuniones para filtrarlas en JavaScript.

No se usa metadata JWT, body, query ni cabeceras personalizadas para ampliar el
scope. viewerId, userId, role, assignedTo y sellerId en query son desconocidos y
producen 400 antes del listado. El service también rechaza perfiles inesperados
y falla cerrado si una respuesta del proveedor contiene una asignada distinta
del scope autorizado. Los contactos de consultation solo aparecen en reuniones
visibles para el usuario.

## Query temporal

Exactamente una ocurrencia de from y una de to, obligatorias y no vacías. Se
procesa la query completa de req.originalUrl con URLSearchParams, conservando
duplicados incluso codificados y parámetros posteriores a muchos separadores.
No se confía en el truncamiento ni en la estructura de req.query.

Ejemplo: `?from=2026-10-01T00:00:00-05:00&to=2026-11-01T00:00:00-05:00`.
El signo positivo de un offset debe codificarse como `%2B` en URL.

Timestamps RFC3339 con zona explícita Z o ±HH:mm, segundos obligatorios y
fracción opcional de hasta seis dígitos (precisión PostgreSQL). Se aceptan t/z
minúsculas. Se valida calendario gregoriano real, años 0001–9999, horas 00–23,
minutos/segundos 00–59 y offset válido. Se rechazan segundos intercalares,
offset desconocido -00:00, espacios, ausencia de zona y precisión superior a
microsegundos. No se redondea ni se interpreta la zona local del servidor.

Se normaliza a UTC y se compara en microsegundos enteros. Intervalo `[from,to)`:
from inclusivo, to exclusivo, from < to y máximo técnico de 45 × 24 horas.
Exactamente 45 días es válido; un microsegundo adicional devuelve 400.

## Consulta y relaciones

Una sola consulta de listado, además de la consulta de perfil de authenticate:

```js
supabase.from('meetings').select(`
  id, consultation_request_id, scheduled_at, time_zone, duration_minutes,
  mode, status, version,
  consultation:consultation_requests!consultation_request_id (
    id, full_name, phone, email,
    program:programs!program_id (id, code, name)
  ),
  assigned_user:internal_users!assigned_to (id, full_name)
`, { count: 'exact' })
  .gte('scheduled_at', fromUTC)
  .lt('scheduled_at', toUTC)
// Solo para vendedora: .eq('assigned_to', req.user.id)
// Orden final: .order('scheduled_at', { ascending: true })
//              .order('id', { ascending: true })
```

FK comprobadas en las migraciones locales:

- `20261007040229_create_meetings_workflow.sql`:
  meetings.consultation_request_id → consultation_requests.id y
  meetings.assigned_to → internal_users.id.
- `20260923005317_create_consultation_requests.sql`:
  consultation_requests.program_id → programs.id.

Las declaraciones REFERENCES no asignan nombres explícitos de constraint.
Se usan hints por la columna FK declarada, sin inventar nombres del catálogo
remoto. `!assigned_to` evita ambigüedad con created_by y updated_by. No hay N+1,
RPC, filtro status, filtro active ni filtro de programa activo.

Se incluyen scheduled, completed, cancelled y no_show. Una asignada desactivada
posteriormente sigue visible en el historial; el nombre es el full_name actual
de internal_users, sin copiarlo en meetings. Esto no autoriza a iniciar sesión
a un perfil inactivo: authenticate mantiene esa restricción.

## Respuesta

200 con `{ data: [] }` si el rango está vacío, nunca 404. Cada elemento contiene:

```text
id, consultationRequestId, scheduledAt, timeZone, durationMinutes,
mode, status, version,
consultation: { id, fullName, phone, email, program: { id, code, name } },
assignedTo: { id, fullName }
```

email de consultation puede ser string o null. Se validan array, UUIDs,
timestamp, enteros positivos, modalidad/estado permitidos y relaciones como
objetos válidos. Se comprueba coherencia del ID de consultation y pertenencia
al rango/scope. Cualquier fila inesperada invalida toda la respuesta: no hay
respuesta parcial. Los campos extra se descartan mediante mapping explícito.

No se seleccionan ni devuelven notes, createdBy, updatedBy, createdAt, updatedAt,
message, city, email interno, datos Auth, tokens, auditoría ni idempotencia.

## Errores y limitaciones

- 400: query, timestamp o rango inválidos; mensaje fijo sin reflejar entrada.
- 401: authenticate, identidad ausente o inválida.
- 403: perfil interno inactivo/inexistente o rol no autorizado.
- 500: fallo de proveedor/transporte o respuesta inesperada/incompleta.

Se conserva AppError/error-handler. Los 500 son genéricos; logs solo contienen
evento, estado y código técnico seguro, sin message/details/hint/query/stack/cause
del proveedor ni contactos.

No se añade paginación ni truncamiento silencioso. Se pide count exact para
detectar si el límite de filas configurado en PostgREST recorta el resultado:
si count no coincide con data.length, se devuelve 500 sanitizado, no una Agenda
parcial. Un rango muy poblado requerirá una futura decisión de paginación.
El máximo de 45 días limita el intervalo, no garantiza un máximo de filas.

No se han probado las relaciones contra Supabase remoto en esta fase. No se
añaden endpoints de cancelación, reprogramación, completed/no_show ni UI.

## Validación local

La suite utiliza app/Express/middlewares/controller/service/repository reales
con el cliente Supabase sustituido antes de evaluar su configuración. Solo HTTP
loopback, sin cargar env.js/dotenv ni contactar servicios reales. Conserva las
184 pruebas previas y añade 81 regresiones de roles/scope, query completa,
calendario/offset/microsegundos/45 días, joins/orden, minimización, relaciones
inválidas, conteo incompleto y errores sanitizados.

Resultado de `npm test`: 265 tests, 265 pass, 0 fail. No acredita una ejecución
remota del endpoint; los joins y filtros se verifican contra el contrato de
consulta y las FK declaradas localmente.
