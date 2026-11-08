# Harness PostgreSQL 4D.4B.1C — diseño, no ejecutado

Fecha de inspección: 2026-10-29 (America/Guayaquil).
Estado: scripts revisados estáticamente; ninguna ejecución mutante, fixture ni carrera realizada.
Las consultas realizadas para diseñarlo fueron exclusivamente SELECT de metadata y conteos.
Estos archivos NO son migrations y NO forman parte de npm test.

## Evidencia y dependencias reales

La inspección remota confirmó:
- 1 admin activo, 1 vendedora activa, 0 agendadoras activas, 10 programas activos.
- No triggers de usuario ni reglas en las cuatro tablas que se escribirán.
- Los usuarios se referencian al ejecutar el harness, sin copiar nombres ni datos personales.
- Se usa un programa activo existente exclusivamente como padre FK, sin modificarlo.
- No se crean internal_users ni auth.users; no se alteran roles.
- Los tres namespaces propuestos dieron 0 colisiones en consultas, meetings, audit e idempotency.
  No hay FKs entrantes adicionales que amplíen el cleanup. Los guards se repiten al ejecutar porque esta evidencia puede caducar.

| Tabla | Campos mínimos / comportamiento |
|---|---|
| consultation_requests | id UUID con default; program_id UUID NOT NULL FK programs(id) RESTRICT; full_name, phone, city, mode, preferred_date, preferred_time NOT NULL. email y message nullable. status default pending; created_at/updated_at default now(). |
| meetings | consultation_request_id FK, scheduled_at, time_zone, duration_minutes, mode, assigned_to/created_by/updated_by FKs a internal_users, todos NOT NULL. id default UUID; status default scheduled; version y schedule_revision integer NOT NULL default 1; timestamps default now(); notes nullable. booked_by UUID nullable FK; role_at_booking text nullable; source NOT NULL default unknown. |
| audit_events | actor_id FK, entity_type, entity_id, action, operation_id NOT NULL; id UUID y created_at con defaults; metadata JSONB objeto default {}. La RPC crea estas filas; no se insertan a mano. entity_id no tiene FK, por eso se captura el manifiesto antes de rollback/cleanup. |
| idempotency_records | actor_id FK, operation, idempotency_key, request_hash, consultation_request_id FK, response_payload JSONB objeto NOT NULL; id UUID y created_at con defaults; UNIQUE(actor_id, operation, idempotency_key). Las RPC crean estas filas. |
| internal_users | id FK auth.users(id), full_name y role NOT NULL; active default true; timestamps con defaults. Solo SELECT/referencias; ninguna escritura. |
| programs | id UUID; code/name/slug NOT NULL y defaults operativos de catálogo. No es necesario insertar ni modificar programas ni otros padres. |

consultation_requests NO tiene source/campaign, assigned_to ni created_by.
El fixture usa teléfono 0000000000, email @example.invalid, ciudad SYNTHETIC y nombre SYNTHETIC 4D.4B.1C.
Las fechas se calculan para UTC +30 días al ejecutar, nunca son fechas fijas susceptibles de caducar.
Las comprobaciones temporales siguen activas.

Constraints comprobadas en metadata y migrations:
- consultation mode online/phone/office; status pending/converted/cancelled.
- meetings status scheduled/completed/cancelled/no_show; modalidad válida; duración/version/revisión positivas;
  scheduled_at finito, zona no vacía, notas UTF-16 <=2000, unicidad de scheduled por consulta.
- attribution: unknown exige ambos campos NULL; explicit/verified_backfill/administrative_correction exige ambos no NULL;
  role_at_booking admin/agendadora; FK booked_by RESTRICT.
- audit e idempotency incluyen las acciones/operaciones 1B.
- programs/internal_users y sus padres se mantienen intactos.

## Archivos y matriz

| Caso | Archivo | Assertions |
|---|---|---|
| A | 01_create_A_E.sql | scheduled, contadores=1, atribución del actor, seller, created_by/updated_by, converted, JSON exacto, dos audits con metadata exacta y mismo operation_id, idempotency exacta |
| B | 01 | replay idéntico y snapshot íntegro de las cuatro tablas sin cambios; se repite después de completed |
| C | 01 | P0001 + IDEMPOTENCY_KEY_REUSED; cero efectos |
| D | 01 | marca únicamente la meeting sintética completed con fecha pasada; permite otra scheduled; conserva historial y no duplica conversion audit |
| E | 01 | P0001 + CONSULTATION_ALREADY_SCHEDULED; cero efectos |
| F | 02_reschedule_F_O.sql | cuatro subcasos: fecha, zona textual UTC→Etc/UTC, duración y modalidad; cada uno aumenta version/revisión, conserva atribución y tiene audit/idempotency exactos |
| G | 02 | logística idéntica: version+1, revisión igual, audit e idempotency presentes |
| H | 02 | replay exacto después de cambiar el fixture a cancelled y ambos contadores a INT_MAX; sin nuevas escrituras |
| I | 02 | misma key/hash distinto: P0001 IDEMPOTENCY_KEY_REUSED, cero efectos |
| J | 02 | expectedVersion obsoleto: P0001 MEETING_VERSION_CONFLICT, cero efectos |
| K | 02 | revisión INT_MAX y logística idéntica: éxito sin overflow de revisión |
| L | 02 | revisión INT_MAX y cambio real: P0001 INTERNAL_ERROR, cero efectos |
| M | 02 | version INT_MAX incluso con logística idéntica: P0001 INTERNAL_ERROR, cero efectos |
| N | 02 | fuente administrative_correction y atribución íntegra preservadas |
| O | 02 | unknown con booker/rol NULL preservados sin rellenar históricos |

F–O usan un fixture de meeting directo, consulta converted, version=7/revisión=3 antes de cada caso.
Así RESCHEDULE no depende de que CREATE haya pasado. Resets/overflow/status solo afectan ese UUID sintético.
N prepara el estado corregido directamente; C3_ATTRIBUTION prueba también la RPC real de corrección.

Los hashes son cadenas opacas no vacías: el harness SQL no pretende probar el hashing HTTP.
Las comparaciones JSONB son exactas por claves/tipos/valores; el orden textual de claves JSONB no importa.
Los snapshots de efectos incluyen timestamps, filas de auditoría e idempotencia, no solo contadores.
Los errores esperados se capturan en bloques BEGIN/EXCEPTION PL/pgSQL: solo SQLSTATE P0001 y SQLERRM exacto.
Una excepción diferente, ausencia de error, o error de assertion hace fallar el grupo.

## Ejecución manual futura — no realizada ni autorizada por la mera entrega

Requisitos: cliente psql 17+ disponible, servicio de conexión TLS configurado por el operador con credenciales
de PostgreSQL autorizadas para fixtures (por ejemplo postgres); contraseña en el mecanismo seguro del cliente.
No usar ni imprimir service_role keys. No poner passwords/tokens en comandos, archivos SQL o logs.
El servicio de ejemplo globalexchange_harness no se configura ni se crea en esta entrega.
Confirmar proyecto/host correcto fuera de logs públicos.

Usar un proceso psql nuevo por archivo, -X para ignorar psqlrc. No usar --single-transaction,
no ejecutar con \i dentro de una transacción ajena y no pegar fragmentos.
No ejecutar estos archivos con supabase db query: contienen metacomandos psql, capturas de estado
y, en A concurrente, una pausa interactiva. No usar un pooler en modo transaction para la coordinación.

Orden de ejecución futura desde la raíz del repo:
```text
psql -X -d "service=globalexchange_harness" -v RUN_4D4B1C=on -f backend/tests/manual/4d4b1c/01_create_A_E.sql
psql -X -d "service=globalexchange_harness" -v RUN_4D4B1C=on -f backend/tests/manual/4d4b1c/02_reschedule_F_O.sql
```

Exigir todos los PASS de casos y el PASS final residue=0. Ausencia de opt-in se rechaza sin escribir;
un exit code cero por sí solo NO prueba éxito (también puede indicar una negativa a ejecutar).
Las assertions fallidas producen error SQL. Tras rollback se vuelve a emitir FAIL con ON_ERROR_STOP on
para terminar el proceso psql de ejecución con error, sin depender de argumentos no soportados por \quit.

Ambos grupos A–O son autocontenidos: BEGIN READ COMMITTED, límites de espera, DO, manifiesto cliente,
ROLLBACK obligatorio y SELECT agregados de residuos. No contienen COMMIT ni DELETE.
Se usa ON_ERROR_ROLLBACK off. ON_ERROR_STOP se desactiva únicamente para alcanzar el rollback tras un error,
y se conserva :ERROR inmediatamente después del DO. No se convierte un FAIL en PASS.

Ante error/cancelación manual: ROLLBACK; en la sesión correspondiente, o cerrar ese proceso dedicado.
Un DO fallido revierte sus propias escrituras; una desconexión revierte la transacción abierta.
No reanudar a mitad de archivo. No reutilizar IDs encontrados previamente; el guard de colisión aborta.

## Identificación, colisiones y residuos

- 01: namespace 4d4b1c01; parent 4d4b1c01-0000-4000-8000-000000000100.
- 02: namespace 4d4b1c02; parent termina 100, meeting termina 200.
- Concurrencia: namespace 4d4b1c03; parent termina 100, meeting inicial termina 200.
- Keys reservadas por namespace y caso. Las meetings/audits creadas por RPC conservan sus UUID aleatorios.
- Antes de INSERT se rechaza cualquier ocupación del namespace; nunca ON CONFLICT, nunca overwrite ni auto-cleanup.
- Un advisory lock del harness evita dos setups del mismo namespace dentro de la misma ventana de creación.
- Antes del rollback se guardan en variables de cliente los UUID de meetings/audits/idempotency propias.
  Los SELECT posteriores verifican conteos=0 por parent y por esos UUID; no comparan totales globales sujetos a tráfico real.
- En caso de DO fallido, PostgreSQL ya ha revertido el bloque completo; el rollback exterior se ejecuta igualmente.
  La captura del manifiesto fallará en una transacción abortada y el script terminará FAIL, nunca afirmará validación completa.

Tablas escritas: exclusivamente consultation_requests, meetings, audit_events e idempotency_records.
Los dos últimos se escriben mediante RPC; DELETE solo existe en el cleanup de concurrencia.
programs/internal_users/auth.users no se escriben: no requieren cleanup.
No se crean funciones, triggers, tablas temporales ni otros objetos DDL.

## Concurrencia posterior: cinco ejecuciones independientes

Para cada SCENARIO, preparar fixture nuevo; después ejecutar A y B en terminales distintas,
observar bloqueo desde una tercera conexión y limpiar ANTES de pasar al siguiente escenario.

```text
psql -X -d "service=globalexchange_harness" -v RUN_4D4B1C=on -v SCENARIO=C1 -f backend/tests/manual/4d4b1c/03_concurrency_setup.sql
psql -X -d "service=globalexchange_harness" -v RUN_4D4B1C=on -f backend/tests/manual/4d4b1c/04_concurrency_A.sql
psql -X -d "service=globalexchange_harness" -v RUN_4D4B1C=on -f backend/tests/manual/4d4b1c/05_concurrency_B.sql
psql -X -d "service=globalexchange_harness" -v RUN_4D4B1C=on -f backend/tests/manual/4d4b1c/06_concurrency_cleanup.sql
```

No ejecutar esos cuatro comandos en serie en una sola terminal: A espera entrada; B necesita otra conexión.
A lee el escenario del marcador del fixture. Repetir con C2, C3_NOTES, C3_ATTRIBUTION y C4.
No ejecutar escenarios simultáneos porque comparten namespace deliberadamente protegido por el guard.

| Escenario | A mantiene transacción abierta | B | Resultado |
|---|---|---|---|
| C1 | RESCHEDULE key A/hash A, expectedVersion=1 | Misma key/hash | B bloquea; tras COMMIT A devuelve snapshot exacto; total un audit y un idempotency |
| C2 | RESCHEDULE key A, expectedVersion=1 | key B, expectedVersion=1 | Un ganador; B recibe MEETING_VERSION_CONFLICT; sin segunda escritura |
| C3_NOTES | update_meeting_notes cambia notas, versión 1→2, revisión=1 | RESCHEDULE expectedVersion=1 | Conflicto tras espera; retry con versión 2 produce versión3/revisión2 y conserva notas/atribución |
| C3_ATTRIBUTION | correct_meeting_booking_attribution convierte explicit→administrative_correction | RESCHEDULE expectedVersion=1 | Conflicto; retry con nueva versión conserva la corrección |
| C4 | CREATE key A en consulta pending | CREATE key B en misma consulta | B recibe CONSULTATION_ALREADY_SCHEDULED; una sola meeting scheduled, dos audits y un idempotency |

C3 cubre el orden contexto→reschedule. Invertir el ganador es una ampliación futura, no evidencia ya obtenida.
El admin disponible puede ser tanto actor como booker corregido: la diferencia de source fuerza una corrección real.

Observer READ-ONLY, sin texto de queries ni datos personales:
```sql
SELECT pid, application_name, state, wait_event_type, wait_event, pg_blocking_pids(pid) AS blockers
FROM pg_stat_activity
WHERE application_name IN ('HARNESS_4D4B1C_A','HARNESS_4D4B1C_B');
```

Esperar READY_A; iniciar B. Confirmar wait_event_type=Lock en B y que blockers incluye PID A;
solo entonces responder true al prompt de A para COMMIT. C1 espera el advisory lock de la RPC;
C2/C3/C4 esperan los locks del fixture compartido. Si no se observa bloqueo, el resultado no demuestra concurrencia:
limpiar y repetir de manera supervisada. No basta un PASS B de ejecución serial.
A tiene idle timeout de 180s; B espera locks hasta 120s y statement hasta 150s.
Si expira un timeout o A responde false: no marcar la carrera PASS; cerrar/rollback ambas sesiones y limpiar.

El setup y A/B exitosos hacen COMMIT deliberadamente, exclusivamente sobre fixtures.
El cleanup:
1. exige parent fijo más marcador/nombre/email/teléfono sintéticos exactos;
2. rechaza cambio de triggers/reglas/FKs entrantes que amplíe el scope;
3. bloquea parent antes de meetings, captura manifiesto;
4. elimina audits → idempotency → meetings → consultation en una transacción;
5. hace COMMIT y exige cuatro conteos residue=0.
No borra por prefijo sin comprobación de propiedad. Si faltan marcadores o hay colisión, aborta.
Ejecutarlo incluso tras una carrera fallida una vez terminadas A y B.
Si la conexión se pierde, no asumir si COMMIT ocurrió: inspeccionar el parent y el manifiesto antes de decidir.
No ejecutar otro setup hasta confirmar limpieza. No ampliar DELETE para “arreglar” residuos.

## Auditoría estática y riesgos

- CRITICAL/HIGH: ninguno identificado en el alcance diseñado.
- MEDIUM operacional: concurrencia necesita fixtures comprometidos temporalmente, visibles para lectores,
  suscripciones o integraciones externas. Cleanup no revierte notificaciones ya emitidas.
  Usar entorno/ventana controlada, dos sesiones supervisadas y cleanup inmediato. No se desactivan triggers,
  integraciones ni roles automáticamente. Si no puede garantizarse ese control, NO ejecutar C1–C4.
- LOW: pruebas de agendadora no disponibles (0 activas); se valida admin sin modificar usuarios.
- LOW: SHARE locks de usuarios/programa y locks de fixture pueden esperar o bloquear cambios administrativos
  durante la prueba; hay límites de tiempo y no se mantienen sesiones sin supervisión.
- Límite de evidencia: inspección lexical/estática solamente, sin compilar ni ejecutar SQL mutante.
  Un dry-run o una lectura de archivos no demuestra que las assertions pasan en PostgreSQL.
- Los seis scripts pasaron verificaciones estáticas de alcance, delimitadores de bloques, condicionales psql,
  ausencia de DDL/escrituras a padres reales y rollback sin COMMIT/DELETE en A–O. Esto no es un parser PostgreSQL.

Recomendación de diseño: APROBADO PARA EJECUCIÓN MANUAL de A–O con conexión dedicada.
Para concurrencia, la aprobación exige las precondiciones operativas descritas; si no están disponibles,
la recomendación de esa parte es NO EJECUTAR. Ningún resultado de ejecución está afirmado aquí.

Referencias de semántica del cliente: https://www.postgresql.org/docs/17/app-psql.html
(ON_ERROR_STOP, ON_ERROR_ROLLBACK, ERROR, gset, if, prompt, quit).
