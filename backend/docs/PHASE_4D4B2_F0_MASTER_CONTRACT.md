# Contrato maestro F0 / 4D.4B.2A

Fecha de formalización: 2026-11-10 (America/Guayaquil).

**Dictamen contractual: APTO CON OBSERVACIONES NO BLOQUEANTES.**
**4D.4B.2B: PROPUESTO — NO AUTORIZADO.**

Este contrato conserva el alcance empresarial de web y CRM y formaliza decisiones humanas aprobadas. No describe una implementación terminada ni autoriza código, SQL, despliegue o activación. La autorización de esta formalización comprende exclusivamente documentación local sin staging.

## Autoridad, fuentes y organización

- Proyecto real: `C:\Proyectos\globalexchange.com.ec`, rama `migracion-vite`; base auditada y comprobada al formalizar: `df2e2703e2052c3deffab6ed266fff2279b7c7b8`.
- Prototipo: `C:\Users\LuisFernandoIlbayHer\Downloads\globalexchange\global-exchange-crm-web`; referencia funcional/visual de 23 páginas, no autoridad de seguridad, arquitectura o persistencia.
- Documento empresarial: `C:\Users\LuisFernandoIlbayHer\Downloads\proyecto crm + pagina.docx`.
- Fuente de aprobación: instrucciones humanas de esta conversación, adjunto de cierre `C:\Users\LuisFernandoIlbayHer\.codex\attachments\223b993c-a8cf-4efe-bbe3-0b41c7a60c51\Texto pegado.txt` y autorización documental `C:\Users\LuisFernandoIlbayHer\.codex\attachments\89a19165-c6ee-4b17-9da3-47a2b0602f06\Texto pegado.txt`.
- Evidencia previa: chats «Analizar arquitectura del CRM» (`01a0fe62-6721-7d52-ae12-0cc257c49b8b`), «Auditar disponibilidad de Agenda» (`01a1bd57-5c36-7fa2-915a-47a852350f14`) y consolidaciones de esta conversación (`01a1c5f7-0f8e-7ab1-9214-d1b1d0428c35`).
- Contratos publicados y evidencia histórica: [PHASE_4D_API.md](PHASE_4D_API.md), [API frontend](../../frontend/docs/CRM_PHASE_4D_API.md).

Este archivo es la fuente normativa de B/C/A2A. [Trazabilidad](PHASE_4D4B2_F0_TRACEABILITY.md) conserva P/D y sus opciones. [Decisiones y validación](PHASE_4D4B2_F0_DECISIONS_AND_VALIDATION.md) conserva H/O/OBC/V, roadmap y puertas. Los tres forman un único paquete; los resúmenes no sustituyen las cláusulas.

Se reutilizó la auditoría existente; no se repitió exhaustivamente ni se ejecutó una nueva validación remota. El DOCX se revisó mediante extracción de texto hasta el párrafo XML 1164; la imagen WMF incrustada no fue verificada visualmente. No hay certificación de paridad visual renderizada ni de funcionamiento externo actual.

## Reglas aprobadas y precedencia

1. No eliminar capacidades por ser demo, simuladas o defectuosas. Implementarlas con persistencia, validación, autorización, auditoría y pruebas cuando corresponda.
2. Sala compartida: recurso reutilizable de **capacidad temporal uno**; no implica simultaneidad, reunión grupal ni enlace compartido entre clientes.
3. Zoom obligatorio para el primer cierre funcional de Agenda. Google Meet es capacidad futura explícita, no requisito activo.
4. Confirmación interna de asistencia por personal autorizado. Reserva, respuesta posterior del cliente y confirmación interna son hechos distintos. Esta regla no acredita por sí misma un endpoint ya implementado.
5. COMPLETE anticipado no libera ocupación original; NO_SHOW también conserva hasta fin efectivo con buffer posterior.
6. Política operativa inicial común; valores concretos pendientes. El modelo admite calendarios por sujeto y buffers con procedencia; no se inventan excepciones particulares ni valores.
7. **WhatsApp: recordatorios obligatorios a 24 horas y 2 horas antes de la reunión para el primer cierre.** Al crear o reprogramar, los vencimientos ya pasados se omiten; no hay ráfagas retroactivas.
8. El documento histórico D-10 menciona 24 h, 1 h y 10 min. Se conserva como fuente original; la decisión humana posterior de esta formalización establece 24 h y 2 h para el primer cierre. No se trasladan automáticamente esos horarios a email ni se eliminan las demás comunicaciones documentales.
9. Una aprobación contractual no autoriza implementación, pruebas mutantes ni despliegue. Las puertas del documento de validación son obligatorias.

## Registro de decisiones estructurales

### B-01 — Identidad de persona

**Estado: APROBADA — Opción A.**
- Regla: identidad estable y única de cliente/persona con múltiples solicitudes, reuniones, programas, oportunidades y ventas.
- Invariantes: nueva interacción no duplica necesariamente persona; personas distintas no se fusionan por coincidencias débiles; no concentrar todos los procesos en una fila mutable.
- Compatibilidad: preservar IDs y relaciones históricas; vincular la nueva identidad sin sustituir `consultation_request_id` publicado.
- Dependencias: modelo de identidad, relaciones y autorización de expedientes.
- Aceptación: V-01/V-02; varios procesos conservan identidad y aislamiento entre personas.
- Diferidos: O-10 (deduplicación, fusión, representantes), O-20 (acceso externo).

### B-02 — Solicitud, reserva y confirmaciones

**Estado: APROBADA — Opción A.**
- Regla: mantener formulario actual de solicitud y añadir flujo separado de reserva pública confirmada; separar respuesta del cliente y confirmación interna de asistencia.
- Invariantes: preferencia no ocupa; reserva no acredita asistencia; respuesta del cliente no reemplaza actuación interna autorizada.
- Compatibilidad: preservar significado del POST actual y estados de reunión; nuevo contrato público explícito.
- Dependencias: identidad, disponibilidad, autorización de autoservicio y mensajes inequívocos.
- Aceptación: V-22/V-24; ningún UUID por sí solo autoriza acceso o cambio.
- Diferidos: O-07 y detalles de UX/respuesta posterior del cliente.

### B-03 — Actor, origen y responsables

**Estado: APROBADA — Opción A.**
- Regla: distinguir actor humano/técnico, origen, autor real, agendadora responsable y vendedora asignada.
- Invariantes: sin empleados ficticios ni atribución automática falsa; agendadora responsable no consume disponibilidad por defecto.
- Compatibilidad: conservar `booked_by`, atribución y contratos publicados; no reinterpretarlos como propietario comercial del lead.
- Dependencias: auditoría de automatización y relaciones de responsabilidad.
- Aceptación: actor/origen y responsables pueden diferir sin perder trazabilidad ni falsear autores.
- Diferidos: O-19 (representación técnica), O-06 (reparto), O-09 (alcances).

### B-04 — Selección elegible y segura

**Estado: APROBADA — Opción A.**
- Regla: selección automática determinista y transaccional de candidatas elegibles en web; manual autorizada en CRM. Elegibilidad por programa, modalidad, ubicación y disponibilidad.
- Invariantes: sin vendedora elegible/libre no se confirma reserva; una solicitud puede quedar sin agendadora; selección manual no elude restricciones.
- Compatibilidad: resolver adaptaciones legacy sin alterar hash ni añadir elecciones ocultas al payload histórico.
- Dependencias: elegibilidad, política de reparto y motor temporal común.
- Aceptación: V-07/V-09/V-14; dos canales no aceptan recursos incompatibles.
- Diferidos: O-05/O-06 (reglas y desempates), O-03 (límites comerciales).

### B-05 — Usuario único y multirrol

**Estado: APROBADA — Opción A.**
- Regla: identidad única de empleados, múltiples roles y permisos granulares con alcances; evolución compatible de `internal_users`.
- Invariantes: una persona multirrol no duplica calendario ni disponibilidad; rol no sustituye identidad.
- Compatibilidad: no ampliar silenciosamente autorizaciones/RPC legacy ni cambiar su rol efectivo al introducir otra representación.
- Dependencias: matriz de capacidades/alcances y transición de autorización.
- Aceptación: V-03/V-11; misma identidad temporal y denegaciones correctas.
- Diferidos: O-09; permisos detallados de Contabilidad y Operaciones.

### B-06 — Calendarios y buffers

**Estado: APROBADA — Opción A.**
- Regla: calendario por sujeto, zonas IANA, intervalos semiabiertos, buffers efectivos/procedencia persistidos; cierres prevalecen y toda ocupación cabe en ventanas autorizadas.
- Invariantes: sin horario/apertura no se ofrece disponibilidad; revalidar dentro de la escritura; no inventar buffers históricos ni recalcular silenciosamente reservas aceptadas.
- Compatibilidad: preservar validación temporal y snapshots legacy; no sustituir zonas por offsets fijos.
- Dependencias: reglas de calendario y política operativa inicial común.
- Aceptación: V-04/V-05/V-06/V-09.
- Diferidos: O-01/O-02/O-03/O-17; sin valores implícitos.

### B-07 — Recursos reales

**Estado: APROBADA — Opción A.**
- Regla: recursos por modalidad/ubicación; vendedora y sala física capacidad uno cuando aplique; online exige unidad Zoom real con capacidad comprobada; reserva atómica de todos los sujetos.
- Invariantes: sala reutilizable no implica grupo; cuenta Zoom no demuestra concurrencia; reserva local distinta de enlace provisionado.
- Compatibilidad: reutilizar usuarios/reuniones y no copiar `meeting_rooms` como agenda paralela.
- Dependencias: inventario real, reglas de modalidad y provisión recuperable.
- Aceptación: V-07/V-14/V-20/V-21; sin asignaciones ficticias ni parcialidad.
- Diferidos: O-04/O-05 y representación de capacidad Zoom comprobada.

### B-08 — Ocupación y resultados

**Estado: APROBADA — Opción A.**
- Regla: ocupación independiente de lifecycle. COMPLETE anticipado y NO_SHOW conservan franja original hasta fin efectivo, incluido buffer posterior. Cancelar libera únicamente futuro permitido.
- Invariantes: preservar transcurrido e historial; expiración temporal no requiere liberar mediante cambio de estado; replay no agrega efectos.
- Compatibilidad: no cambiar umbrales ni lifecycle legacy; no usar solo `status = scheduled` para detectar ocupación.
- Dependencias: reservas y todos los workflows coordinados.
- Aceptación: V-17/V-18; otra reserva dentro de franja retenida se rechaza.
- Diferidos: O-08; no suponer buffer residual cero.

### B-09 — Actividad y reasignación

**Estado: APROBADA — Opción A.**
- Regla: nuevos comandos exigen vendedora activa/elegible; no confirmar nueva reprogramación que conserve asignada inactiva. Permitir reasignación explícita, autorizada y auditable.
- Invariantes: desactivar no borra ni libera reservas; rechazo conserva estado anterior; nunca reasignación silenciosa.
- Compatibilidad: históricos/replays intactos; la nueva condición de elegibilidad es evolución deliberada, no conducta ya existente.
- Dependencias: estabilizar elegibilidad frente a concurrencia y definir comando de reasignación.
- Aceptación: V-15/V-16/V-19.
- Diferidos: O-18/O-09.

### B-10 — Adaptación legacy

**Estado: APROBADA — Opción A.**
- Regla: adaptar nuevos intentos legacy solo cuando todos los recursos requeridos se resuelvan inequívocamente; rechazar controladamente lo no adaptable; todos los escritores pasan por garantías comunes.
- Invariantes: ningún bypass, tampoco RPC directa; no retirar comandos por defecto; no alterar un intento incierto para cambiar de contrato.
- Compatibilidad: preservar firmas, bodies, hashes, ámbitos, DTO, autorización, precedencia de replay, idempotencia, `version` y `schedule_revision`. Retirada requiere aprobación independiente.
- Dependencias: inventario de escritores, adaptadores y tratamiento frontend de errores.
- Aceptación: V-12/V-13; replay no revalida disponibilidad mutable fuera de su contrato.
- Diferidos: O-18 y plan de corte; no inventar códigos públicos aquí.

### B-11 — Históricos y activación

**Estado: APROBADA — Opción A.**
- Regla: preflight READ-ONLY, conflictos/datos incompletos, manifiesto verificable y resolución autorizada antes de activar.
- Invariantes: no inventar salas, Zoom, buffers o atribuciones; no activar con conflictos relevantes sin resolver; manifiesto obsoleto no autoriza cambios.
- Compatibilidad: preservar IDs, versiones, auditoría, snapshots y replays; correcciones reales requieren operación autorizada aparte.
- Dependencias: entorno identificado, todos los escritores y reconciliación revisable.
- Aceptación: V-23; ninguna ocupación relevante omitida ni evento ficticio `meeting_created`.
- Diferidos: O-15 y autorizaciones particulares de corrección/despliegue.

## Cláusulas normativas

### C-01 — Identidades y responsables

Reutilizar usuarios y catálogo existentes. Relacionar persona con solicitudes/procesos sin sustituir IDs históricos. Distinguir actor, origen, autor, agendadora, vendedora y representantes. Un sujeto humano único por empleado; un rol adicional no crea capacidad adicional. Clientes, oportunidades, ventas, cobros y documentos son responsabilidades separadas aunque se presenten en una ficha común.

### C-02 — Solicitudes, reservas y confirmación

El formulario actual guarda preferencias, no reservas. El flujo nuevo consulta alternativas, recibe elección, resuelve identidad/responsables, revalida y confirma solo tras éxito transaccional. Reserva, respuesta posterior del cliente, confirmación interna de asistencia y resultado de reunión son distintos. Autoservicio tendrá autorización propia; no simular un admin/agendadora para ejecutarlo.

### C-03 — Recursos y sujetos reservables

Identidad estable y relación verificable con usuario/recurso, actividad y calendario. Sala física compartida capacidad uno, reutilizable sucesivamente, sin reuniones grupales por defecto. Vendedora consume su disponibilidad; agendadora no por defecto. Online requiere Zoom real verificado. No inferir capacidad de una cuenta ni usar referencias polimórficas sin integridad. La necesidad de sala depende de O-05.

### C-04 — Calendarios y excepciones

`ventanas autorizadas = (horario habitual ∪ aperturas explícitas) − cierres`.

Cierres prevalecen; vigencia y zona IANA explícitas. Sin configuración no ofrecer disponibilidad. Toda ocupación, buffers incluidos, debe caber en ventanas. Cambios administrativos deben coordinarse con reservas y no invalidarlas silenciosamente. La política concreta frente a conflictos debe explicitarse antes de habilitar administración; no se autoriza reprogramación automática. DST de límites de calendario queda en O-17, sin normalización implícita.

### C-05 — Buffers y ocupación

Por sujeto, intervalo semiabierto `[inicio − buffer previo, inicio + duración + buffer posterior)`. Persistir valores efectivos y procedencia; distinguir original, efectivo, sustitución y liberación. Instantes absolutos con zona conservada para reglas/presentación. Política operativa inicial común con valores pendientes; no inferir buffers históricos. Cupos/matrículas/promociones y reservas financieras no pertenecen a esta ocupación.

### C-06 — Elegibilidad y selección

Revalidar actividad y elegibilidad por programa/modalidad/ubicación además de capacidad temporal. Política automática determinista pendiente de detalles; manual autorizada sometida a mismas garantías. Conjunto de candidatos y elección deben coordinarse para no seleccionar fuera del protocolo de locks. No confirmar sin vendedora elegible/libre; conservar solicitud pendiente cuando corresponda al flujo.

### C-07 — Concurrencia e integridad

Proteger elegibilidad, calendario, capacidad, reunión/asignaciones/reservas, auditoría, idempotencia y trabajos durables asociados dentro del límite transaccional pertinente. Mantener compatibilidad con READ COMMITTED requerido por RPC actuales. Especificar orden total de locks compatible con usuarios y padre→reunión; coordinar sujetos incluso sin reservas previas, releer después de esperas y evitar inversión de orden en administración de calendario. No convertir un GET previo en autorización de INSERT. Capacidad uno exige defensa de integridad además de validación funcional. El mecanismo físico y protocolo exactos son trabajo técnico posterior, no implementación aprobada.

### C-08 — Operaciones y ocupación

| Operación | Efecto requerido |
| --- | --- |
| CREATE gestionado | Todas las reservas requeridas o ninguna |
| RESCHEDULE | Sustitución atómica; rechazo conserva reunión/reservas previas |
| RESCHEDULE idéntico | Semántica publicada de version/audit; sin reasignaciones ficticias |
| Reasignación | Explícita, autorizada, auditable; comando nuevo por definir |
| CANCEL | Liberar solo futuro permitido; conservar transcurrido/historial; O-08 bloquea política residual |
| COMPLETE anticipado / NO_SHOW | Retener intervalo original hasta fin efectivo con buffer posterior |
| Desactivar | No borrar/liberar reservas automáticamente |
| Notes/attribution | Sin modificación de ocupación |
| Replay | Sin nuevas reservas, liberaciones, reparaciones o provisiones |
| Fallo | Rollback completo del límite transaccional |

No cambiar umbrales de COMPLETE/NO_SHOW ni el lifecycle publicado. La expiración natural se deduce del intervalo; no depende de un cron para garantizar exclusividad.

### C-09 — Zoom y comunicaciones recuperables

Zoom obligatorio en cierre funcional de Agenda, no dentro de 2B. Persistir trabajo durable asociado al éxito local y ejecutarlo fuera de locks/transacción de reserva. Distinguir pendiente/listo/fallido/resultado incierto según contrato futuro. Timeout no prueba ausencia de efecto externo ni autoriza creación indiscriminada; deduplicar y reconciliar. Respuestas de revisión/asignación obsoleta no sobrescriben la vigente. Fallo externo no libera silenciosamente horario.

WhatsApp: confirmar/seguir según requisitos, con recordatorios iniciales obligatorios **24 h y 2 h**. Al crear/reprogramar, omitir vencimientos pasados sin ráfagas retroactivas. Revalidar vigencia/estado/revisión/asignación al ejecutar trabajos; cancelación también invalida aunque `schedule_revision` no cambie. No declarar mensaje enviado solo por crear un trabajo. El contrato de email y grupos familiares permanece separado en O-14. Meet queda futuro explícito.

### C-10 — Permisos y privacidad

Preservar autorización legacy; transición multirrol explícita. Nuevos contratos tendrán capacidades/alcances aprobados. Autoservicio no recibe permisos internos y UUID no basta para autorización. Disponibilidad pública no expone clientes, notas, ocupantes, ausencias, credenciales ni enlaces ajenos. Conflictos con errores controlados; privilegios/RLS explícitos. Ocultar botón es UX, no autorización.

### C-11 — Idempotencia, auditoría y versiones

Preservar firmas, cuerpos de entrada y contratos funcionales publicados, normalización, hashes, ámbitos, DTO, snapshots y precedencias particulares. Los cuerpos de implementación SQL históricos no se editan en sus migraciones; una futura evolución forward-only requiere autorización y pruebas, no queda autorizada por este texto. Preservar incrementos/límites de `version`, incluida reprogramación idéntica, y definición de `schedule_revision` por instante/zona textual/duración/modalidad. Asignaciones de recursos necesitan generación independiente; representación pendiente. Nuevos ámbitos idempotentes no deduplican automáticamente entre contratos. Intento incierto conserva clave/payload/contrato. Audit estructurada y correlacionada, sin credenciales ni reuniones ficticias. No inventar solicitud para reutilizar idempotencia administrativa ligada hoy a consultation.

### C-12 — Compatibilidad legacy

B-09/B-10 autorizan nuevas condiciones de aceptación de intentos nuevos, no modificación de replays. Resolver replay según su precedencia antes de comprobaciones mutables que no correspondan. Resolver recursos inequívocamente o rechazar controladamente; nunca completar recursos después dejando ventana desprotegida. No reasignar silenciosamente ni retirar comandos sin aprobación independiente. Especificar errores/recuperación en O-18. Todo escritor, incluida RPC directa, debe quedar protegido antes de activar. No prometer idéntica aceptación de entradas antiguas cuando las decisiones aprobadas agregan elegibilidad y disponibilidad.

### C-13 — Reconciliación y activación

Preflight READ-ONLY de entorno/migraciones/RPC/grants/RLS/extensiones/escritores/datos/solapamientos. Manifiesto por reunión: IDs/relaciones, versión/revisión, intervalos, sujetos conocidos/desconocidos, evidencia, conflictos y resolución autorizada. Invalida si cambian datos relevantes. No inventar recursos/buffers/atribución ni alterar replays. Reconciliación no genera eventos ficticios de creación. Corte coordinado y verificación antes de reabrir; no coexistencia operativa de escritores protegidos y bypass. Recuperación no puede volver al escritor desprotegido. Implementación, reconciliación y despliegue requieren autorizaciones distintas.

## Incorporación explícita de ajustes

| ID | Obligación incorporada | Cláusulas y aceptación |
| --- | --- | --- |
| A2A-01 | Solicitud y reserva pública separadas | C-02; preferencia no ocupa ni promete confirmación |
| A2A-02 | Disponibilidad pública mínima | C-02/C-10; sin PII ni reserva implícita |
| A2A-03 | Autoservicio con autorización propia | C-02/C-10; conocer ID no autoriza |
| A2A-04 | Actor, autor y responsables separados | C-01/C-11; automatización sin empleados ficticios |
| A2A-05 | Selección automática/manual controlada | C-06/C-07; sin doble asignación concurrente |
| A2A-06 | Elegibilidad programa/modalidad/ubicación | C-06; libre no equivale a elegible |
| A2A-07 | Identidad estable de cliente | C-01; múltiples procesos sin duplicación automática |
| A2A-08 | Zoom obligatorio y recuperable | C-09; reserva aceptada distinta de enlace listo |
| A2A-09 | Confirmaciones/comunicaciones independientes | C-02/C-09; reservar/enviar mensaje no marca asistencia; WhatsApp 24 h/2 h vigente |
| A2A-10 | Permisos ampliables y multirrol | C-01/C-10; una persona no duplica ocupación |
| A2A-11 | Lecturas Agenda/ficha evolucionadas | C-01/C-10/C-11; contexto completo sin alterar snapshots legacy |
| A2A-12 | Cupos comerciales separados | C-05; pago/matrícula no consume/libera sala implícitamente |
| A2A-13 | Seguimiento/ventas/cobros independientes | C-01/C-08; completar no crea venta ni cobro |
| A2A-14 | Validación técnica y empresarial | V-01…V-26 en documento vinculado; evidencia real por capacidad |

## Evidencia y límites del cierre

Referencias técnicas: [solicitudes](../supabase/migrations/20260923005317_create_consultation_requests.sql), [contexto](../supabase/migrations/20261022010000_meeting_context_schema.sql), [workflows vigentes](../supabase/migrations/20261022030000_meeting_context_schedule_workflows.sql), [rutas](../src/modules/meetings/meetings.admin.routes.js), [proyección Agenda](../src/modules/meetings/meetings.repository.js).

Las pruebas históricas de PHASE_4D_API no son una ejecución nueva. OBC-01…OBC-06 y O-01…O-20 permanecen visibles en el documento de validación. Las restricciones de este encargo prohíben modificar código, datos, SQL, dependencias, proveedores y Git index/historia. El siguiente trabajo permitido tras formalizar es revisión humana o una auditoría READ-ONLY expresamente solicitada. **No iniciar 2B.**
