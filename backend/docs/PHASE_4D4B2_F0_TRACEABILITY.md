# Trazabilidad empresarial F0 / 4D.4B.2A

Fecha: 2026-11-10. Parte del [contrato maestro](PHASE_4D4B2_F0_MASTER_CONTRACT.md); [decisiones, validación y roadmap](PHASE_4D4B2_F0_DECISIONS_AND_VALIDATION.md).

Se conservan 41 capacidades P y 26 grupos D sin eliminar funciones simuladas. Las filas siguientes contienen opciones funcionales, situación real, entrega, dependencia y aceptación. Agrupar controles no los vuelve opcionales. Una función compartida puede satisfacer varias filas, pero cada fila exige evidencia. No se acredita paridad visual/funcional ni integración externa actual.

## Fuentes y localizadores

- **SP** = `C:\Users\LuisFernandoIlbayHer\Downloads\globalexchange\global-exchange-crm-web`. Las rutas `app/...` y líneas siguientes se resuelven dentro de esta raíz exacta auditada, no dentro del proyecto real. No se usa la otra copia del prototipo en Proyectos.
- **SD** = `C:\Users\LuisFernandoIlbayHer\Downloads\proyecto crm + pagina.docx`. `¶` es el orden de párrafos de `word/document.xml`, incluidos vacíos, no número de página. Texto revisado hasta ¶1164; imagen WMF no validada visualmente.
- **SR** = `C:\Proyectos\globalexchange.com.ec`, base `df2e2703e2052c3deffab6ed266fff2279b7c7b8`.
- Procedencia de auditorías y aprobaciones: contrato maestro, sección Autoridad. No se volvió a auditar exhaustivamente el prototipo/DOCX en esta formalización.

Estados: **EX** implementado en alcance auditado (validación histórica con sus límites); **PA** parcial; **PE** pendiente en proyecto real; **RED** prototipo requiere rediseño. Fuente conectada en código no equivale a integración validada. **Solo P**, **solo D** o **P+D** se determina por referencias cruzadas, no por estado de implementación.

Fases: F1 identidad/permisos/catálogo; F2 temporal; F3 Agenda/ficha/Zoom/público; F4 seguimiento/comunicaciones; F5 ventas/cobros; F6 gestión/reportes; F7 web/marketing; F8 portal. F0 preserva las decisiones. Los sufijos de entrega se detallan en el roadmap.

## Bases actuales reutilizables

| Ref. | Evidencia real | Alcance y límite |
| --- | --- | --- |
| R1 | [app.js](../src/app.js), [rutas reuniones](../src/modules/meetings/meetings.admin.routes.js) | Auth, programs, consultations, internal-users y meetings; no APIs comerciales completas |
| R2 | [catálogo](../supabase/migrations/20260917061136_create_programs.sql), [repository](../src/modules/programs/programs.repository.js) | programs/destinations/program_destinations y GET; falta administración comercial completa |
| R3 | [solicitudes](../supabase/migrations/20260923005317_create_consultation_requests.sql), [service](../src/modules/consultations/consultations.service.js), [formulario](../../frontend/src/js/modules/services.js) | Preferencias persistidas, no reserva; WhatsApp manual tras POST |
| R4 | [usuarios](../supabase/migrations/20260930201949_create_internal_users.sql), [listado](../src/modules/internal-users/internal-users.admin.routes.js) | Identidad y tres roles exclusivos; listado asignable, no administración multirrol |
| R5 | [reuniones/audit/idempotencia](../supabase/migrations/20261007040229_create_meetings_workflow.sql), [workflows vigentes](../supabase/migrations/20261022030000_meeting_context_schedule_workflows.sql) | Operaciones transaccionales por solicitud/reunión; sin exclusión temporal entre solicitudes |
| R6 | [contexto](../supabase/migrations/20261022010000_meeting_context_schema.sql), [workflows contexto](../supabase/migrations/20261022020000_meeting_context_workflows.sql), [GET](../src/modules/meetings/meetings.repository.js) | Atribución/notas/revisión SQL; GET no expone todo el contexto |
| R7 | [Sidebar](../../frontend/src/components/crm/CRM_Sidebar.html), [Inicio](../../frontend/src/components/pages/crm/CRM_Home.html), [Agenda](../../frontend/src/components/pages/crm/CRM_Agenda.html), [render](../../frontend/src/js/modules/crm-agenda.js) | Shell/Solicitudes/Agenda; otros módulos deshabilitados, Inicio sin métricas |
| R8 | [finder](../../frontend/src/js/modules/program-finder.js), [datos locales](../../frontend/src/js/data/program-finder-data.js) | Catálogo local; auditoría no encontró consumo frontend de /api/programs |
| R9 | [web](../../frontend/src/components/pages), [CRM 2](../../frontend/docs/CRM_PHASE_2.md), [CRM 3](../../frontend/docs/CRM_PHASE_3.md), [CRM 4C](../../frontend/docs/CRM_PHASE_4C_API.md), [CRM 4D](../../frontend/docs/CRM_PHASE_4D_API.md) | Contenido y evidencia histórica; no certificación actual completa |

## Matriz P del prototipo

| ID | Fuente SP precisa y opciones completas | Situación real / entrega prevista | Dependencia y aceptación |
| --- | --- | --- | --- |
| P-01 | `components/Sidebar.tsx:50`: Dashboard, Clientes, Oportunidades, Agenda, Agendadoras, Vendedoras, Ventas, Reportes, Histórico, Configuración; navegación activa, identidad, roles, logout | PA R7; F1–F8. D-24/D-25/D-26 | Permisos/módulos. Cada acceso habilitado lleva a función real; pendientes permanecen trazados |
| P-02 | `app/layout.tsx:240`: Buscar global y campana; hoy visuales sin flujo | PE R7; F4/F6. D-19/D-25 | APIs autorizadas/eventos. Buscar no revela recursos ajenos; alertas consultables |
| P-03 | `app/login/page.tsx:16`: correo, contraseña, iniciar sesión, envío y errores | EX login/shell dentro de evidencia histórica R9; conservar. D-25 | Auth real. Probar acceso, credenciales inválidas, sesión/red/denegación |
| P-04 | `app/mi-perfil/page.tsx:98`: identidad, activo/inactivo, roles, ID; errores de sesión/perfil; consulta, no edición | PA identidad shell R7; F1. D-25 | Usuario/permisos. Pantalla muestra cuenta real sin inventar edición de perfil |
| P-05 | `app/page.tsx:616`: mes/Ver; evolución mensual/anual; reuniones, ventas, conversión, cobrado y comparación anterior | PE dashboard R7; RED períodos restringidos a 2026/default agosto; F6. D-20 | Hechos y períodos aprobados. Comparaciones con denominadores homogéneos |
| P-06 | `app/page.tsx:765–1102`: metas oficina cobros/ventas/conversión, embudo Lead→Cobrado, cotizado/pendiente/ticket, evolución/conversión | PE; RED acumulados del cliente; F6. D-20/D-26 | F4/F5/metas. Reconciliar importes y fechas con movimientos/cierres |
| P-07 | `app/page.tsx:1125–1475`: prioridades, rankings vendedoras/agendadoras, ventas por programa, resumen financiero y anual | PE; RED; F6. D-18/D-20 | Identidades/atribución/scoring. Sin agrupar por nombre ni duplicar venta por reuniones |
| P-08 | `app/clientes/page.tsx:518`: Nuevo cliente; total/reuniones/ventas/cobrado; seguimientos hoy/atrasados | PE R1/R7; F1/F4/F6. D-07/D-18/D-26 | Persona/actividades/ventas. Datos persistidos e indicadores reconciliables |
| P-09 | `app/clientes/page.tsx:647–827`: buscar nombre/correo/teléfono/país/programa/ID; servicio, estado, resultado; limpiar/actualizar | PE; F1/F4. D-25 | API clientes y volumen. Filtros correctos sobre conjunto autorizado |
| P-10 | `app/clientes/page.tsx:872–1205`: tabla cliente/contacto/país/programa/reunión/seguimiento/estado/resultado; ver ficha/editar; Hoy/Atrasado/carga/vacío | PE; F3/F4. D-07/D-26 | Identidad/ficha. Navegación conserva expediente y estados veraces |
| P-11 | `app/clientes/nuevo/page.tsx:2100`: nombre/apellido/teléfono/email/nacimiento/edad manual o calculada/institución/cursos-semestres múltiples | PE; RED escapes TSX literales; F1. D-02/D-07/D-09 | B-01/O-10. Persistir y validar todos los campos sin duplicar persona |
| P-12 | `app/clientes/nuevo/page.tsx:2480–3038`: categoría→programa, país buscable, ciudad opcional, agendadora/vendedora y sin perfiles | PA bases R2/R4, falta expediente; RED catálogos hardcodeados; F1/F3. D-02/D-06/D-24 | B-04/O-06. Catálogo único, candidatas elegibles; no inferir destino habilitado de lista mundial |
| P-13 | `app/clientes/nuevo/page.tsx:3072–3142`, `app/clientes/[id]/editar/page.tsx:2249`: padre/madre/representantes con nombre/celular/email independientes | PE; F1/F8. D-13/D-16 | O-10/O-20. Representante, estudiante y pagador no se confunden |
| P-14 | `app/clientes/nuevo/page.tsx:3172–3880`: estado/resultado/pago; cita opcional fecha/hora/30-40-60 min/Meet-Zoom; cotizado/cobrado/observaciones; guardar/cancelar | PA reunión por flujo distinto R5; RED alta no atómica; F1/F3/F5. D-04/D-12 | Dominios separados. UI integrada no elude RPC/pagos; valores 30/40/60 son opciones de fuente, no política operativa aprobada |
| P-15 | `app/clientes/[id]/page.tsx:848`: volver/editar/WhatsApp; tarjetas estado/resultado/servicio/pago; identidad/educación/categoría/programa/país/ciudad/responsables | PE ficha R7; F3. D-07/D-24/D-26 | F1/lecturas. Conservar secciones y accesos autorizados |
| P-16 | `app/clientes/[id]/page.tsx:1040–1100,1624–1672`: cita actual, abrir enlace, ver Agenda, reagendar fecha/hora, confirmar/cancelar/errores | PA reprogramación Agenda R5/R7; RED proveedor+varios writes; F3. D-04/D-05 | F2/Zoom. Misma reunión, reservas atómicas, proveedor recuperable |
| P-17 | `app/clientes/[id]/page.tsx:1115–1226`: scoring/prioridad/próximo seguimiento/hoy-atrasado/último contacto/valor potencial/nota | PE; F4. D-18/D-19 | O-11. No usar notes de reunión como seguimiento; scoring explicable |
| P-18 | `app/clientes/[id]/page.tsx:1252–1386`: cotizado/cobrado/pendiente/pago/progreso, observaciones editables, Contacto→Reunión→Venta→Proceso | PE; RED; F5/F8. D-12/D-13/D-26 | Ventas/movimientos/proceso. Saldos derivados, sin edición de acumulados sin hechos |
| P-19 | `app/clientes/[id]/page.tsx:1412–1494`: WhatsApp individual; grupo de familia «Aún no conectado»; etapa/vendedora | PE en ficha; F4/F8. D-10/D-13 | O-14. Enlace individual, grupo y automatización son capacidades distintas |
| P-20 | `app/clientes/[id]/page.tsx:1519–1607`: historial fechas/estados/enlaces, reunión actual, nuevas citas sin otro cliente | PA reuniones históricas R5, falta vista; F3. D-05/D-26 | F1/audit. Reagendar no crea filas de reuniones ficticias para historial |
| P-21 | `app/clientes/[id]/editar/page.tsx:2152–2454`: estudiante/padres/responsables/programa; estado reunión/resultado/pago/etapa | PE edición; RED formulario mezcla dominios; F1/F4/F5. D-07/D-12/D-25 | O-09/O-11/O-13. Cada cambio usa su autorización y comando |
| P-22 | `app/clientes/[id]/editar/page.tsx:2466–2632`: HOT/WARM/COLD/DORMIDO; Alta/Media/Baja; próximo/último contacto/valor/pérdida/notas; rápidas contacto/seguimiento/reunión/propuesta/venta/pago/pérdida | PE; RED acciones sobre texto; F4/F5. D-18/D-19/D-26 | Actividades y hechos financieros. Pago recibido exige movimiento real, no solo etapa |
| P-23 | `app/clientes/[id]/editar/page.tsx:2644–2769`: fecha/hora/enlace/cotizado/cobrado/observaciones/guardar-cancelar e historial | PA reuniones R5; RED mutaciones genéricas; F3/F5. D-05/D-12 | RPC/finanzas. Sin bypass temporal ni financiero |
| P-24 | `app/oportunidades/page.tsx:492`: ruta/menu pero pantalla Clientes duplicada con filtros/indicadores/ficha/editar | PE módulo independiente; RED; F4. D-18/D-19/D-26 | B-01/O-11. Proceso de oportunidad propio; no atribuir kanban inexistente |
| P-25 | `app/agenda/page.tsx:965`: prioridad del día/hoy/próximas/próxima; Reuniones/Hoy/Pendientes/Online | PA R7 día seleccionado y cinco estados; F3. D-04 | Definiciones temporales. Diferenciar próxima global/día/en curso y conteos |
| P-26 | `app/agenda/page.tsx:1138–1234,1488–1715`: aviso 15 min, fecha/hora/duración/cliente-ID/plataforma/estado/agendadora/vendedora/servicio/teléfono/sala/notas; ver cliente/abrir | PA R6/R7 sin todo contexto/Zoom; F3/F4. D-04/D-10 | DTO/ficha/recursos. Aviso visual 15 min no es recordatorio WhatsApp; enlaces y recursos vigentes |
| P-27 | `app/agenda/page.tsx:796–817,1255–1265,1359–1394`: carga/error/sin próximas/sin reuniones/cliente no encontrado/sin enlace | PA carga-error-vacío-retry R7; F3. D-04/D-25 | API/provisión. Estados veraces y recuperación sin falsas confirmaciones |
| P-28 | `app/agendadoras/page.tsx:1`: activas/reuniones/asistencias/ventas/conversión por persona | PE; demo; F6. D-20 | Usuarios/atribución. Sin nuevas identidades ni demo en producción |
| P-29 | `app/vendedoras/page.tsx:1`: activas/reuniones/asistencias/ventas/conversión/comparación/resumen | PE; demo; F6. D-20 | Reuniones/ventas/metas. Totales por persona reconciliados |
| P-30 | `app/ventas/page.tsx:1`: cerradas/vendido/cobrado/pendiente/ticket/% cobrado; por vendedora/programa; tabla cliente/importes/pago | PE; demo; F5/F6. D-12/D-20 | Venta/cobro persistidos. No confundir etiqueta Vendido con ledger de pagos |
| P-31 | `app/reportes/page.tsx:120`: Exportar, cotizado/cobrado/pendiente/conversión, resumen/distribuciones/ejecutivo | PE; demo y Exportar visual; F6. D-20 | Datos/permisos. Exportación real y autorizada del período correcto |
| P-32 | `app/historico/page.tsx:174`: gestiones/reuniones/cambios; fecha/cliente/programa/tipo/gestión/estado/usuario; editar/ver clientes; errores parciales | PA audit_events R5; RED autor desde texto y límite combinado 400; F4/F6. D-25/D-26 | Eventos/actores estructurados. Historial consultable sin truncamiento engañoso |
| P-33 | `app/configuracion/page.tsx:137`: usuarios/programas/estados comerciales/pago/calendario/correo/objetivos | PE panel, bases R2/R4; F1–F6. D-23/D-24 | Módulos administrativos. Siete accesos conservados |
| P-34 | `app/usuarios/UsuariosClient.tsx:742`: buscar nombre/rol; activos/inactivos/multirrol; crear nombre/email/contraseña/roles; editar nombre/roles; activar-desactivar/confirmar | PA R4; F1. D-24/D-25 | B-05/O-09. Contabilidad y multirrol conservados; no ampliar legacy silenciosamente |
| P-35 | `app/configuracion/programas/page.tsx:430`: buscar/filtrar categoría-actividad/contar; crear/editar/activar/desactivar programas; nombre/categoría/destino/precio/USD-EUR-GBP/duración/descripción | PA R2, sin admin/comercial completo; F1/F7. D-02/D-03/D-23/D-24 | Catálogo único/O-13. Edición compartida; monedas/opciones fuente no política financiera aprobada. Aceptación: activación y desactivación autorizadas, estado persistido correctamente, integridad de registros relacionados, consultas y pantallas coherentes, sin cambios colaterales indebidos. Política exacta de desactivación de programas en uso pendiente de decisión de negocio antes de implementar ese comportamiento |
| P-36 | `app/configuracion/estados-comerciales/page.tsx:21`: buscar/filtrar/crear/editar/descripción/color/activar/desactivar estados comerciales/orden↑↓; Lead/Contacto/Reunión/Oportunidad/Cotización/Venta/Cobrado/Perdido | PE; UI local con API separada; RED; F4. D-18/D-26 | O-11. Etapas configurables sin reemplazar estados técnicos. Aceptación: activación y desactivación autorizadas, estado persistido correctamente, integridad de registros relacionados, consultas y pantallas coherentes, sin cambios colaterales indebidos. Política exacta de desactivación de estados comerciales en uso pendiente de decisión de negocio antes de implementar ese comportamiento |
| P-37 | `app/configuracion/estados-pago/page.tsx:299`: listar/contar/crear/editar nombre-descripción/activar/desactivar estados de pago/orden↑↓/guardar-cancelar | PE; F5. D-12 | O-13. Etiqueta/configuración no crea dinero ni altera saldo. Aceptación: activación y desactivación autorizadas, estado persistido correctamente, integridad de registros relacionados, consultas y pantallas coherentes, sin cambios colaterales indebidos. Política exacta de desactivación de estados de pago en uso pendiente de decisión de negocio antes de implementar ese comportamiento |
| P-38 | `app/configuracion/calendar/page.tsx:164`: correo fijo readonly, Zoom/Meet, 30-40-60, auto-create/notificaciones, guardar/test Zoom/resumen | PE; preferencias no prueban efecto ni calendario; F2/F3. D-04/D-05/D-11 | B-06/B-07. Zoom operativo; Meet futuro explícito; no confundir preferencias con disponibilidad |
| P-39 | `app/configuracion/reportes/page.tsx:235`: destinatarios, agregar/eliminar adicionales, diario/semanal/anual, guardar/mensajes | PE; preferencias prototipo no prueban envío; F6. D-20 | Generación/canal/O-14. Entrega y frecuencia verificables |
| P-40 | `app/configuracion/objetivos/page.tsx:1346`: rol/persona/diario-semanal-mensual-anual/fecha-mes-año; guardar-actualizar-eliminar; vendedora reuniones/ventas/facturación/cobros/conversión/asistencia; agendadora contactos/leads/citas agendadas-confirmadas/conversión/asistencia | PE; F6. D-20 | O-12. Metas por identidad/rol/período sin doble cómputo multirrol |
| P-41 | `app/test-supabase/page.tsx:3`: diagnóstico éxito/error/listado/vacío | PE como herramienta operativa; O-16, no pantalla comercial obligatoria | Política de diagnóstico. Acceso técnico sin exposición de datos/secretos |

## Opciones de fuente que no deben perderse ni copiarse como reglas aprobadas

- P-11/P-12: categorías Estudio, Trabajo, Estudio + Trabajo, Experiencias/Intercambio, Otros servicios. Programas High School, Universidad exterior, Studienkolleg, Ausbildung, Pasantías universitarias, Idiomas, Idiomas profesionales, Nanny, Au Pair, Trabajo profesional, Estudio y trabajo, Work & Travel, Summer Camp, Voluntariado, Intercambio cultural, Orientación educativa, Asesoría visa y Otro. Su aparición no prueba habilitación comercial.
- Cursos/semestres: 10mo; 1ero/2do/3ero bachillerato; 1er–12vo semestre; Egresado, Graduado, Maestría, Doctorado, Otra opción. Selección múltiple independiente del programa.
- P-09/P-14: estados Pendiente/Agendada/Asistió/No asistió/Reagendada/Cancelada; resultados Pendiente/Seguimiento/Vendido/No vendido/Reagendar. Alta muestra pago Pendiente/Abono/Pagado/Reembolso.
- P-21: edición usa Sin definir, Agendado, Confirmado, Asistió, No asistió, Canceló, Reagendar; resultado En seguimiento; pago incluye Vencido/Cancelado. SQL y otras pantallas difieren. Normalizar conceptos mediante O-11/O-13, no trasladar inconsistencias a lifecycle real.
- Ficha son secciones, no pestañas inventadas. No se encontró calendario mensual/semanal interactivo ni kanban de oportunidades en el prototipo. Conservar alcance demostrado, sin atribuir funciones nuevas a la fuente.

## Matriz D del documento empresarial

| ID | Fuente SD y opción/requisito completo | Relación y situación real / entrega | Dependencia y aceptación |
| --- | --- | --- | --- |
| D-01 | ¶11–35,702–716: Home comercial hero/mensaje/buscador/agendar/WhatsApp/destacados/destinos/testimonios/beneficios/proceso/FAQ/CTA final | Solo D público; PA web R9; F7 | Catálogo/contenido. Recorridos comerciales y secciones completos |
| D-02 | ¶37–83,718–767: match edad/objetivo/destino; programa con edades/países/duración/categoría/nivel académico/idioma/precio/modalidad/estado | P-11/P-12/P-35; PA R2/R8; F1/F7 | Catálogo/reglas. Misma fuente web/CRM; no recomendaciones con requisitos inventados |
| D-03 | ¶86–121,769–805: fichas por programa nombre/país/edad/duración/precio-desde-cotización/requisitos/incluye-no incluye/fechas/proceso/testimonios/fotos/video/FAQ; agendar/aplicar/WhatsApp/pagar | P-35; PA informativas R9; F1/F5/F7 | Contenido/productos. CTAs funcionales y precio según política aprobada |
| D-04 | ¶123–207,832–849: programa/fecha/hora/datos/confirmar; cliente+reunión+responsable+Zoom | P-14/P-16/P-25/P-26; PA R3/R5, hoy preferencias; F3 | F1/F2/Zoom. Solo confirmar después de reserva atómica; estado externo explícito |
| D-05 | ¶234–257,636–644,1116–1125: autoservicio reagendar/cancelar; actualizar CRM/calendario/Zoom/email/WhatsApp sin duplicados | P-16/P-20/P-23; PA interno R5; F3/F4 | O-07/proveedor. Misma identidad/reunión, autorización titular y recuperación |
| D-06 | ¶174–207,881–893: asignación automática agendadora; Sin asignar admisible sin perfiles | P-12/P-34; PE; F1/F3 | B-03/B-04. No confundir booked_by con responsable; sin vendedora elegible no reservar |
| D-07 | ¶307–321,851–871,999–1011: formularios crean/actualizan lead; edad/programa/destino/source/campaign/medium/landing_page | P-08/P-11/P-12/P-15; PA R3 sin perfil/atribución completos; F1 | Identidad/captación. Persistir atributos y deduplicar según política |
| D-08 | ¶307–321: guía descargable con nombre/edad/WhatsApp/email→lead→campaña→seguimiento | Solo D; PE; F4/F7 | F1/contenido. No forzar cita para descargar; trazabilidad comercial |
| D-09 | ¶323–338,923–937: test independiente edad/país/objetivo/nivel/idioma/fecha viaje/presupuesto; recomendación, ver programa/agendar | Solo D como test; PA finder R8; F7 | Reglas. Resultado explicable; porcentajes del ejemplo no reglas productivas |
| D-10 | ¶209–225,895–906: WhatsApp confirmación/recordatorios históricos 24 h,1 h,10 min/seguimiento | P-19/P-26; PA solo enlaces R3; F4 | Decisión posterior: primer cierre **24 h y 2 h**, vencidos al crear/reprogramar omitidos sin ráfagas. Probar entregas, vigencia y omisión; no borrar referencia original |
| D-11 | ¶227–232,908–921: email bienvenida/confirmación/recordatorios históricos 24 h-1 h/pago/instrucciones aplicación | PE; test Resend prototipo no satisface; F4/F5 | Eventos/canal/O-14. No aplicar horarios WhatsApp a email sin decisión; entregas verificadas |
| D-12 | ¶259–284,645–652,807–830: cotización/propuesta/link; pago inicial/abono/completo/inscripción/curso/servicio; comprobante y estado financiero | P-18/P-22/P-30/P-37; PE; RED acumulados; F5 | O-13/proveedor. Duplicado de notificación no duplica cobro; saldo conciliable |
| D-13 | ¶286–305,653–660,1150–1157: portal login cliente/proceso registro-documentación-visa-viaje-llegada/documentos/pagos/saldo/fechas/asesor/comunicación/progreso | Solo D portal; P-13/P-18/P-19 relacionados; PE; F8 | Identidad/representación/F5/O-20. Login interno no sustituye externo; aislamiento por expediente |
| D-14 | ¶341–352,963–978: destinos y país con programas/edades/requisitos/costes/idioma/duración/experiencias/testimonios/FAQ | Solo D público; PA contenido R9; F7 | Catálogo/editorial. Páginas de destino completas y consistentes |
| D-15 | ¶354–364,952–961: testimonios y vídeos dentro de cada programa | Solo D; PA sección independiente R9; F7 | Relaciones editoriales. Cobertura contextual verificable |
| D-16 | ¶366–382,939–950: Para padres seguridad/familia/supervisión/alojamiento/seguro/acompañamiento/visa/costes/comunicación | Solo D sección; PA contenido disperso; F7 | Editorial. Sección completa, distinta de datos de representantes P-13 |
| D-17 | ¶384–402,1070–1073: mobile first; ver programas/agendar/aplicar/pagar; WhatsApp y agendar accesibles permanentemente | PA responsive/contacto R9; F3/F7/transversal | Flujos reales. Navegador móvil/teclado y CTAs alcanzables |
| D-18 | ¶447–459,873–879: scoring automático HOT/WARM/COLD/DORMIDO por perfil/actividad | P-07/P-17/P-22; PE; F4 | O-11. Cálculo reproducible; selección manual no cierra automatización |
| D-19 | ¶461–468,1134–1141: alertas lead HOT, seguimiento, oportunidades y nurturing | P-02/P-17/P-24; PE; F4 | Eventos/destinatarios/O-14. Disparadores y entregas trazables |
| D-20 | ¶426–445,980–1011: leads/reuniones/ventas/ingresos por origen/programa; web/Instagram/Facebook/WhatsApp/feria/referido/Google/TikTok/otro | P-05–P-07/P-28–P-31/P-40; PE; F6 | Atribución/F5/O-12. Definiciones y totales reconciliados |
| D-21 | ¶404–424,980–992: GA4/GTM/Meta Pixel; view_home/view_program/start_quiz/complete_quiz/submit_lead/click_whatsapp/start_booking/book_meeting/start_payment/purchase | Solo D; PE sistema integrado; F7 | Eventos desde sus módulos. No contar clic/intento como reserva/pago exitoso |
| D-22 | ¶471–494,661–670,1142–1149: contenido comercial/SEO por programa-destino/blog/guías/landings/formularios/campañas/remarketing | Solo D; PA páginas R9; F7 | Editorial/medición. Publicación y embudo medible |
| D-23 | ¶497–514,1044–1068: admin sin código nombre/descr/edad/país-ciudad/precio/duración/requisitos/fotos/video/FAQ/publicación; promociones/precio/fechas/cupos | P-33/P-35; PA R2; F1/F7 | Catálogo/CMS/O-13. Editar y publicar sin duplicar catálogo ni usar reservas temporales para cupos |
| D-24 | ¶596–615,1159–1164: ecosistema único web/CRM/contabilidad/operaciones y catálogo compartido | P-01/P-12/P-33/P-34/P-35; PA R2/R4/R8; F1–F8 | B-01/B-05/O-09. Contabilidad y Operaciones conservadas; sin atribuir permisos aún no aprobados |
| D-25 | ¶1075–1094: público catálogo/disponibilidad/lead/solicitud/pago; privado clientes/comercial/responsables/pagos/notas/historial/oportunidades | P-01–P-04/P-21/P-32/P-34; PA Express protegido R1; transversal | C-10. Sin PII privada pública y autorización por recurso |
| D-26 | ¶551–614,691–698,1013–1042: lead→contacto→reunión→seguimiento→oportunidad→cotización→venta→cobro→cliente/proceso | P-06/P-08/P-15/P-18/P-20–P-24/P-32; PA solicitud→reunión R3/R5; F1–F8 | Relaciones/eventos. Trazabilidad de extremo a extremo sin mezclar persistencias |

## Inventario complementario y diferencias que conservar

Las 23 páginas auditadas: `/`, `/agenda`, `/agendadoras`, `/clientes`, `/clientes/nuevo`, `/clientes/[id]`, `/clientes/[id]/editar`, `/configuracion`, sus seis subpáginas `calendar`, `estados-comerciales`, `estados-pago`, `objetivos`, `programas`, `reportes`, `/historico`, `/login`, `/mi-perfil`, `/oportunidades`, `/reportes`, `/test-supabase`, `/usuarios`, `/vendedoras`, `/ventas`.

| Superficie SP | Operaciones inventariadas y límite |
| --- | --- |
| `/api/usuarios`, `/api/usuarios/editar`, `/api/usuarios/estado` | Alta, edición, actividad; no copiar autorización desigual |
| `/api/programas` | GET/POST/PATCH de catálogo |
| `/api/estados-comerciales`, `/api/estados-pago` | GET/POST/PATCH/PUT; ciertos GET inicializan datos, no ejecutarlos en auditoría READ-ONLY |
| `/api/configuracion/calendar`, `/api/configuracion/reportes` | GET/POST preferencias; no demuestran automatización |
| `/api/zoom/room` | POST/PUT/DELETE creación-reutilización/reprogramación/limpieza; no ejecutados |
| `/api/zoom/test` | GET/POST diagnóstico/creación; no ejecutados |
| `/api/google/create-meet` | POST devuelve demo; capacidad futura explícita |
| `/api/reportes/test-email` | POST prueba Resend; no demuestra reportes programados |
| `/clientes/update` | PATCH privilegiado; requiere rediseño de autorización |
| `/api/health` | Diagnóstico técnico |

Referencia SP `docs/ARQUITECTURA.md:9`: comisiones; `docs/MIGRACION.md:3`: importación/contraste/respaldo Sheets. Se conservan en H-16/O-12/O-16, no se declaran implementadas. El SQL SP `supabase/schema.sql` no reproduce todos los campos/tablas consumidos por el prototipo.

Agenda real conserva tarjetas/prioridad y añade navegación diaria. Faltan ficha enlazada, agendadora/responsabilidad diferenciada, notas proyectadas, recursos y Zoom; sus cinco contadores diarios no equivalen exactamente a Reuniones/Hoy/Pendientes/Online del prototipo. Ficha real todavía ausente. Mantener mejoras de drawer/accesibilidad real sin copiar limitaciones de referencia. Comparación visual por código no es certificación renderizada.

Las afirmaciones históricas del DOCX «Zoom funciona» y «base Next.js» no acreditan el estado Vite/Express actual. Ejemplos de importes, porcentajes o personas no son configuración ni datos productivos. Todos los cierres deben remitir a evidencia V y a la puerta correspondiente del documento de decisiones.
