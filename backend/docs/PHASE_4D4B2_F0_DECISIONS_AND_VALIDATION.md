# Decisiones, validación y puertas F0 / 4D.4B.2A

Fecha: 2026-11-10. [Contrato maestro](PHASE_4D4B2_F0_MASTER_CONTRACT.md) y [trazabilidad P/D](PHASE_4D4B2_F0_TRACEABILITY.md).

**Dictamen: APTO CON OBSERVACIONES NO BLOQUEANTES.** B-01…B-11 están APROBADAS, opción A. Este archivo no reabre esas decisiones: distingue detalles operativos pendientes, evidencia futura y autorizaciones separadas. **4D.4B.2B: PROPUESTO — NO AUTORIZADO.**

## Registro H original y resolución por dependencias

| ID | Decisión empresarial original | Resolución estructural / parte diferida |
| --- | --- | --- |
| H-01 | Persona/estudiante, deduplicación, representantes y pagadores | B-01 aprobada; O-10/O-20 antes de identidad/portal |
| H-02 | Varias oportunidades/programas/ventas por persona | B-01 aprobada; cardinalidad múltiple preservada; reglas comerciales O-11/O-13 |
| H-03 | Programas/canales con reserva inmediata o solicitud | B-02 aprobada; recorridos separados; configuración de oferta antes de F3-C |
| H-04 | Asignación automática y falta de candidatas | B-03/B-04 aprobadas; algoritmo O-06; sin vendedora elegible no reservar |
| H-05 | Multirrol, Contabilidad, Operaciones y alcances | B-05 aprobada; O-09 antes de evolución de permisos |
| H-06 | Horarios, excepciones, buffers, duración, horizonte y granularidad | B-06 aprobada; O-01/O-02/O-03/O-17 |
| H-07 | Salas/Zoom, capacidad y significado compartido | B-07 aprobada; sala compartida capacidad uno sin grupos; inventario O-04/O-05 |
| H-08 | Cancelación/buffer residual/no-show/inactividad | B-08/B-09 aprobadas; O-08/O-18 |
| H-09 | Confirmación y acceso al autoservicio | B-02 aprobada; confirmación interna preservada; O-07 |
| H-10 | Etapas, scoring, prioridades, rápidas y pérdidas | O-11; estados comerciales separados de reuniones |
| H-11 | Venta, conversión, ticket, facturación, cobro, asistencia y atribución | O-12; no copiar fórmulas inconsistentes |
| H-12 | Precios, monedas, promociones, cupos, pagos y devoluciones | O-13; no crear reglas financieras por inferencia |
| H-13 | WhatsApp/email/grupos y comunicación portal | O-14/O-20; WhatsApp 24 h/2 h y omitir vencidos ya aprobado |
| H-14 | Proveedor inicial y Google Meet | RESUELTA: Zoom obligatorio; Meet futuro explícito |
| H-15 | Históricos, buffers desconocidos, legacy y corte | B-10/B-11 aprobadas; O-15/O-18 y autorización de reconciliación |
| H-16 | Comisiones, Sheets y diagnóstico | O-12/O-16; vigencia y alcance concretos pendientes |

## Decisiones operativas diferidas

Estado de todas: **DIFERIDA — requiere aprobación antes de la puerta indicada**. No inventar valores. La aprobación de la estructura no aprueba automáticamente sus parámetros.

| ID | Decisión pendiente | Dependencia | Puerta de aprobación |
| --- | --- | --- | --- |
| O-01 | Jornadas, vigencias, festivos y zonas concretas | B-06/C-04 | Antes de configurar/activar cada sujeto |
| O-02 | Duración, buffers previos/posteriores y ámbito de política inicial común | B-06/C-05 | Antes de disponibilidad operativa; el modelo no fija minutos |
| O-03 | Anticipación mínima, horizonte y granularidad | B-04/B-06 | Antes de búsqueda pública y activación de reservas |
| O-04 | Inventario real de salas/unidades Zoom y capacidad comprobada | B-07/C-03 | Antes de activar recursos/cerrar Zoom; fixtures sintéticos no sirven de inventario |
| O-05 | Sala presencial obligatoria según modalidad/ubicación | B-07 | Antes de resolver recursos operativos |
| O-06 | Reparto determinista, candidatas, prioridad y desempates | B-04/C-06 | Antes de implementar selección automática |
| O-07 | Autorización, caducidad, alcance y recuperación de autoservicio | B-02/C-10 | Antes de implementar acceso público a citas |
| O-08 | Tratamiento exacto del buffer residual al cancelar durante ocupación | B-08/C-08 | Antes de activar esa liberación; no suponer cero |
| O-09 | Matriz de capacidades, roles, alcances y transición multirrol | B-05/C-10 | Antes de implementar evolución de autorización; no ampliar legacy por defecto |
| O-10 | Deduplicación/fusión, representantes/pagadores e identidades ambiguas | B-01 | Antes de implementar identidad cliente; preservar casos no resueltos |
| O-11 | Etapas, scoring/umbrales, prioridades, pérdidas y acciones rápidas | H-10 | Antes de seguimiento/oportunidades; no convertir ejemplos en reglas |
| O-12 | Métricas, atribución, metas y comisiones | H-11/H-16 | Antes de reporting/metas/comisiones |
| O-13 | Precios, monedas, promociones, cupos, ventas/pagos/devoluciones | H-12 | Antes de módulos comerciales/financieros |
| O-14 | Canales, plantillas, destinatarios, grupos familiares y recuperación | H-13/C-09 | Antes de automatizaciones. Horario WhatsApp inicial 24 h/2 h y omitir vencidos YA APROBADOS; email conserva decisión separada |
| O-15 | Resolución autorizada de históricos ambiguos/conflictivos | B-11/C-13 | Antes de ejecutar reconciliación y activar |
| O-16 | Importación/respaldo Sheets, vigencia y diagnóstico operativo | H-16 | Antes de implementar herramientas; sin exposición de clientes |
| O-17 | Límites locales ambiguos/inexistentes por DST | B-06/C-04 | Antes de implementar motor de calendarios; sin normalización silenciosa |
| O-18 | Contrato exacto de reasignación, errores de adaptación legacy y nuevas lecturas | B-09/B-10/A2A-11 | Antes de integrar escritores/API/UI |
| O-19 | Representación de actor técnico y auditoría de automatización | B-03 | Antes de reserva automática; no empleado ficticio |
| O-20 | Documentos, estados del proceso y acceso externo/representantes | H-01/H-05/H-13 | Antes de portal/documentos |

Los detalles de campos/endpoints/constraints no son decisiones empresariales aprobadas por este archivo. Deben derivarse de los contratos y revisarse en el checkpoint técnico correspondiente. No se agregan permisos, proveedores o capacidades físicas por conveniencia técnica.

## Observaciones de compatibilidad y evidencia

### OBC-01 — Vendedora histórica inactiva

La RPC vigente de reprogramación valida actor/padre/reunión/versión/tiempo, pero ese recorrido no revalida actividad de asignada: [workflow, línea 306](../supabase/migrations/20261022030000_meeting_context_schedule_workflows.sql#L306). B-09 aprueba una nueva condición para intentos nuevos. Consecuencia: documentar cambio deliberado de admisibilidad, conservar replay y estado ante rechazo. Atender en especificación de escritores F2 y O-18; probar V-15/V-16/V-19. No afirmar que ya funciona.

### OBC-02 — Multirrol frente a rol exclusivo

[internal_users](../supabase/migrations/20260930201949_create_internal_users.sql) y [rutas](../src/modules/meetings/meetings.admin.routes.js) usan roles exclusivos/concretos. B-05 aprueba evolución, no expansión implícita de autorizaciones. Consecuencia: mapear capacidades/alcances y compatibilidad expresamente. Atender O-09/F1-B antes de implementación y V-03/V-11; sujeto temporal sigue único.

### OBC-03 — Compatibilidad y nuevos rechazos

B-10 autoriza rechazo controlado de nuevos intentos no adaptables. Preservar interfaces/hash/DTO/replay no significa aceptar toda entrada antes aceptada. Consecuencia: especificar códigos HTTP/dominio y recuperación sin ocultarlos como error interno. Atender O-18/F2 escritores y F3 API/UI; V-12/V-13. Retirada de comandos sigue requiriendo aprobación independiente.

### OBC-04 — Revisión logística y recursos

La [comparación logística vigente](../supabase/migrations/20261022030000_meeting_context_schedule_workflows.sql#L357) comprende instante/zona textual/duración/modalidad. Cambio exclusivo de sala no pertenece a esa definición. Consecuencia: generación de asignación separada, sin redefinir `schedule_revision`; jobs deben comprobar también lifecycle, porque cancelar no incrementa esa revisión. Atender F2 diseño y F3/F4 integración; V-13/V-21/V-24.

### OBC-05 — Confirmación interna

Regla de negocio aprobada no acredita endpoint completo. No equiparar `scheduled`, `completed`, mensaje entregado o respuesta del cliente a confirmación interna de asistencia. Consecuencia: especificar representación, permisos y lectura sin cambiar lifecycle legacy por inferencia. Atender O-09/O-18 y F3; V-24.

### OBC-06 — Estado remoto no renovado

No hubo nuevo preflight Supabase en auditoría/formalización. Evidencia histórica en [PHASE_4D_API](PHASE_4D_API.md) no certifica ausencia actual de drift, consumidores o conflictos. Consecuencia: preflight READ-ONLY nuevo antes de una futura activación y prueba real para cada garantía. Atender B-11/O-15/F2 transición; V-23. No repetir SQL/harness histórico sin autorización.

Estas observaciones no bloquean cierre contractual. Sí bloquean los checkpoints afectados si no se atienden antes de su puerta. Exigir aceptación incondicional de entradas legacy incompatibles contradiría B-09/B-10; no es la compatibilidad aprobada.

## Plan de validación futura

**Estado: DISEÑADO, NO EJECUTADO EN ESTA FORMALIZACIÓN.** No se crean tests ni harness. Los resultados históricos permanecen atribuidos a su evidencia original, con sus límites.

Niveles: **E** estática (contratos/código/esquema); **U** unitaria/contractual con transporte controlado; **PG** PostgreSQL real (locks/constraints/transacciones); **HTTP** E2E API real con persistencia; **EXT** integración externa real autorizada; **UI** navegador, interacción, accesibilidad y comparación visual. Mocks no sustituyen PG/EXT; HTTP con mocks no es E2E persistido.

| ID | Escenario | Resultado esperado | Evidencia exigida | Dependencia contractual |
| --- | --- | --- | --- | --- |
| V-01 | Persona con múltiples solicitudes/reuniones/procesos | Identidad conservada y relaciones correctas | U + PG + HTTP | B-01/C-01/O-10 |
| V-02 | Personas distintas con datos similares | Sin fusión automática indebida ni acceso cruzado | U + PG + HTTP | B-01/C-10/O-10 |
| V-03 | Empleado multirrol | Un sujeto temporal, permisos por alcance | E + PG + HTTP | B-05/O-09 |
| V-04 | Horarios/aperturas/cierres/zonas y falta de configuración | Cierre prevalece, ocupación completa cubierta, sin configuración no disponible | U + PG | B-06/O-01 |
| V-05 | DST, medianoche y buffers | Sin desplazamiento silencioso ni ocupación omitida | U + PG | C-04/C-05/O-17 |
| V-06 | Adyacencia y solapamiento mínimo | Semiintervalos correctos; buffers incluidos | PG | B-06/B-07 |
| V-07 | Solicitudes distintas disputan vendedora/sala/Zoom | Sin incompatibilidad simultánea; sala reutilizable sucesivamente sin grupos | Dos sesiones PG + observación independiente | B-04/B-07/C-07 |
| V-08 | CREATE/RESCHEDULE y RESCHEDULE/RESCHEDULE | Resultado serial consistente; sustitución sin parcialidad | Dos sesiones PG, commit y rollback | C-07/C-08 |
| V-09 | Calendario/actividad cambia mientras se reserva | Relectura pertinente tras espera y validación estabilizada | Dos sesiones PG | B-06/B-09 |
| V-10 | Fallo tras reunión/primera reserva/audit/idempotencia/job/validación final | Rollback completo, sin trabajo o éxito parcial | PG con fallos inducidos en entorno autorizado | C-07/C-11 |
| V-11 | Usuario no autorizado o fuera de alcance | Denegación sin efectos/filtraciones; acceso directo también protegido | PG + HTTP | C-10/O-09 |
| V-12 | Legacy adaptable y no adaptable, incluidas RPC directas | Motor común o rechazo controlado; firmas/hash/DTO preservados; sin bypass | E + U + PG + HTTP | B-10/O-18 |
| V-13 | Replay histórico tras cambiar estado/calendario/recursos | Snapshot original y precedencias; cero nuevos efectos/contadores/jobs | PG + HTTP | C-11/C-12 |
| V-14 | Recurso inexistente/inactivo/incompatible/sin capacidad | Ninguna reserva confirmada/parcial; sin candidata no confirmar | PG + HTTP | B-04/B-07 |
| V-15 | Nueva reprogramación conserva asignada inactiva | Rechazo; reunión y reservas previas intactas; replay histórico intacto | PG + HTTP | B-09/O-18 |
| V-16 | Reasignación autorizada | Misma reunión, sustitución completa y audit; generación de recursos correcta | PG + HTTP | B-09/C-11/O-18 |
| V-17 | CANCEL antes/durante/después | Liberación exacta conforme a política, transcurrido/historial preservados | PG, incluida carrera con nueva reserva | B-08/O-08 |
| V-18 | COMPLETE anticipado y NO_SHOW | Franja original retenida hasta fin efectivo con buffer; umbrales legacy intactos | PG + HTTP | B-08/C-08 |
| V-19 | Desactivar con reservas existentes | No borrar/liberar; nuevas operaciones aplican elegibilidad | PG | B-09 |
| V-20 | Timeout/fallo/duplicado Zoom | Reserva local distinta de provisión, deduplicación/reconciliación sin éxito ficticio | U + EXT real autorizada | C-09/O-04 |
| V-21 | Respuesta Zoom tardía tras reprogramar/reasignar/cancelar | No sobrescribe generación vigente; recuperación auditada | EXT + HTTP | C-09/C-11 |
| V-22 | Disponibilidad pública/autoservicio ajeno | DTO sin PII privada; conocer ID no autoriza; conflicto entre canales protegido | HTTP + UI + PG para carrera | C-02/C-10/O-07 |
| V-23 | Históricos desconocidos/conflictos/manifiesto obsoleto | Detención o resolución autorizada; sin recursos/atribuciones/buffers ficticios | PG aislado y ensayo de transición autorizado; preflight READ-ONLY | B-11/O-15 |
| V-24 | Reserva/respuesta cliente/confirmación interna y comunicaciones | Hechos independientes. Recordatorios WhatsApp a 24 h y 2 h antes de la reunión; vencimientos ya transcurridos al crear/reprogramar omitidos sin ráfagas retroactivas; invalidar o sustituir trabajos obsoletos tras reprogramar o cancelar, sin envíos obsoletos; deduplicar entregas ante reintentos | U reloj controlado + HTTP/UI; EXT para entrega real | B-02/C-09/O-14; decisión posterior de recordatorios; email mantiene contrato separado |
| V-25 | P-01…P-41 y D-01…D-26 | Evidencia individual de cada control/flujo; persistencia/autorización/audit reales donde corresponda | HTTP/UI/PG/EXT según fila | Matriz de trazabilidad completa |
| V-26 | Paridad visual, móvil, teclado y estados | Secciones/jerarquía/controles conservados; carga/error/vacío/datos/envío/incertidumbre accesibles | Capturas comparables + navegador a tamaños acordados | Referencia SP, D-17, Agenda/ficha |

### Disciplina de evidencia

- Registrar base/entorno, caso, precondiciones, resultado esperado/observado y límites. No inventar PASS ni extrapolar proveedor desde mocks.
- Carreras: demostrar bloqueo/contención, ambas transacciones y estado final desde otra sesión; incluir rollback del primer escritor. PASS aislado sin contención no basta.
- Fixtures en entorno aislado deben identificarse como sintéticos; nunca usarlos como inventario real. Su creación/limpieza requiere autorización futura de pruebas mutantes.
- Conservar comparación visual por estado y tamaño, no solo por CSS. No atribuir funciones no encontradas (kanban o calendario mensual) al prototipo.
- Evidencia histórica se referencia, no se presenta como nueva ejecución; preflight remoto nuevo antes de activar.
- D-10 conserva 24 h/1 h/10 min de origen. La prueba vigente del primer cierre es 24 h/2 h, incluida omisión de vencidos al crear/reprogramar. Frecuencias email no se cambian por inferencia.

## Puertas de autorización

| Puerta | Requisito | Lo que NO autoriza |
| --- | --- | --- |
| G0 Documental | Paquete consistente, IDs completos, solo documentación sin staging; revisión humana | Código, SQL, tests de implementación, 2B o despliegue |
| G1 Implementación aislada 2B | Autorización expresa, especificación física y entorno de prueba identificados, dependencias resueltas | Cambios remotos/activación/Zoom/comunicaciones |
| G2 Escritores y compatibilidad | Todos los workflows, orden de locks, errores y transición especificados/probados; O-18 | Dejar entradas legacy desprotegidas o retirar comandos sin aprobación |
| G3 Reconciliación | Preflight vigente, manifiesto revisado y resoluciones autorizadas | Inventar datos, corregir silenciosamente o activar con conflictos |
| G4 Activación | Autorización independiente de despliegue, todos los escritores coordinados, reconciliación verificada y recuperación segura | Reutilizar aprobación F0 como permiso de producción |
| G5 Cierre funcional | Primer cierre funcional completo de Agenda: Zoom real y recorridos internos probados, más implementación y aceptación de ambos recordatorios WhatsApp a 24 h y 2 h de F4-B conforme a V-24, incluida omisión de vencimientos pasados sin ráfagas, invalidación/sustitución de trabajos obsoletos y deduplicación de entregas. Públicos, demás automatizaciones y visual según alcance de entrega; email mantiene contrato separado | Cerrar Agenda completa sin la entrega obligatoria de F4-B ni declarar CRM completo por cerrar núcleo temporal |

Los valores O pueden diferirse respecto de F0, pero no respecto de su puerta. La ausencia de respuesta no constituye aprobación. Se detiene esta formalización después de controles documentales; se espera revisión humana.

## Próximo checkpoint

**4D.4B.2B — Sujetos, calendarios y reservas con integridad verificable en entorno aislado.**

**Estado: PROPUESTO — NO AUTORIZADO.**

Alcance previsto, no ejecutado: modelo de sujetos con FK a usuario/recurso, unicidad de sujeto humano, calendarios/excepciones/asignaciones/reservas, buffers/procedencia, integridad temporal y correspondencia con meetings, privilegios y pruebas en aislamiento. No crear identidad de cliente paralela ni otro catálogo de empleados. No activar escritores operativos ni crear recursos externos.

Dependencias: autorización expresa G1; diseño físico revisable; verificar capacidades de PostgreSQL aislado sin asumir extensiones remotas; resolver O-17 antes del motor y delimitar cancelación sin inventar O-08; definir protocolo de locks y cómo demostrar integridad al final de transacción. Parámetros de prueba sintéticos deben declararse como tales, no como valores empresariales aprobados.

Riesgos a cubrir: duplicación de sujeto multirrol, huérfanos, solapamientos, reservas incompletas/incompatibles con reunión, capacidad Zoom supuesta, activación accidental y cambios a legacy. Cierre de 2B acredita modelo aislado, no disponibilidad productiva.

| Archivos previstos en futuro, no creados por este encargo | Finalidad |
| --- | --- |
| `backend/supabase/migrations/<version_futura>_<nombre_por_aprobar>.sql` | Migración nueva forward-only; nombre/versión pendientes |
| `backend/tests/<nombre_por_aprobar>.test.mjs` | Pruebas contractuales/estructurales nuevas |
| `backend/tests/manual/<directorio_por_aprobar>/` | Harness PostgreSQL aislado de integridad/concurrencia/rollback |
| `backend/docs/PHASE_4D_API.md` y documentación del checkpoint | Contrato técnico/evidencia futura, sin reescribir historial |

Este listado no autoriza crear ninguno de esos archivos ni comenzar diseño SQL ejecutable. No se proponen cambios frontend/endpoints en 2B.

## Roadmap completo

| Fase | Entrega incremental | Dependencia y aceptación |
| --- | --- | --- |
| F0 | Contrato maestro, matriz, decisiones y evidencia futura | G0; B aprobadas, O diferidas, observaciones visibles |
| F1 | A: persona/representantes/vínculos/origen. B: usuarios/permisos y catálogo compartido | B-01/B-05, O-09/O-10; sin identidades/catálogos duplicados; eliminar divergencia finder local/backend mediante entrega posterior |
| F2 | 2B aislado; después motor común/escritores; después transición/reconciliación/activación | G1→G2→G3→G4 independientes; PG real y legacy sin bypass |
| F3 | A: lecturas/ficha/Agenda interna. B: Zoom obligatorio primer cierre funcional. C: reserva pública/autoservicio | F1/F2, O-04/O-07/O-18/O-19; contexto y enlaces reales, autorización pública separada, conflictos entre canales. El primer cierre funcional completo de Agenda depende también de los recordatorios obligatorios de F4-B aceptados mediante V-24 y G5 |
| F4 | A: actividades/scoring/oportunidades. B: WhatsApp/email/alertas/confirmaciones/recordatorios | O-11/O-14; WhatsApp 24 h/2 h sin ráfagas; jobs vigentes/deduplicados, no confundir envío con asistencia. Comunicaciones y automatizaciones permanecen en F4; sus recordatorios WhatsApp obligatorios deben implementarse y aceptarse mediante V-24 antes del primer cierre funcional completo de Agenda en G5. Email mantiene contrato separado, sin inferir horarios ni obligaciones adicionales |
| F5 | Propuestas/ventas/links/abonos/completos/comprobantes/saldo/devoluciones | O-13; movimientos conciliables, duplicados externos sin doble cobro |
| F6 | Dashboard/rendimiento/metas/Histórico/exportación/reportes por correo | Hechos F3–F5 y O-12; métricas por identidad/fecha correctas, sin demo |
| F7 | Home/fichas/destinos/admin contenido/padres/testimonios/test/guías/SEO/landings/analytics/campañas | Catálogo F1 y eventos de conversión; edición sin código y recorrido móvil probado |
| F8 | Portal estudiante/representantes/proceso/documentos/pagos/fechas/asesor/comunicación | Identidad/F5/O-20; aislamiento de expedientes, documentos y pagos trazables |

F1 y F2 pueden secuenciarse independientemente donde sus contratos no se solapen; no implica autorización de trabajo paralelo ni de agentes. F7 puede avanzar tras catálogo común; eventos y definiciones métricas deben prepararse en cada módulo, no descubrirse al finalizar F6. Nada elimina el alcance P/D.

## Control documental y dictamen

Preflight de esta formalización: ruta/rama/HEAD esperados, `git status --short` vacío y `git diff --cached --name-only` vacío; no había cambios ajenos que sobrescribir. No se encontraron documentos F0 equivalentes en backend/docs; se usa el paquete propuesto y una referencia breve en PHASE_4D_API.

Controles de cierre requeridos: leer íntegros los tres archivos nuevos, validar contenido de cada B/C/P/D/A2A/O/OBC/V (y H preservados), enlaces locales/raíces de fuentes, coherencia de recordatorios, `git diff --check`, diff/stat de rastreados, inventario de untracked y staging vacío. Estos controles documentales no son V-01…V-26 ni pruebas funcionales. El informe de conversación registra el resultado de su ejecución; no se declara resultado de pruebas futuras.

**APTO CON OBSERVACIONES NO BLOQUEANTES** para cierre documental, sujeto a revisión humana del paquete. Sin paridad funcional/visual certificada ni preflight remoto renovado. **2B NO AUTORIZADA; implementación/despliegue NO AUTORIZADOS.** Próxima recomendación: auditoría READ-ONLY del paquete, trazabilidad y compatibilidad, con atención a OBC, política 24 h/2 h y puertas; sin SQL ni modificación del producto.
