# Revisión de cierre documental — 4D.4B.2B / 2B.0

Fecha: 2026-11-11. **PAQUETE LOCAL PREPARADO — PENDIENTE DE AUDITORÍA INDEPENDIENTE READ-ONLY DEL DIFF.**

**4D.4B.2B: PROPUESTO — NO AUTORIZADO PARA IMPLEMENTACIÓN. 2B.1 NO AUTORIZADO.**

Esta revisión consolida evidencia documental previa. No constituye una nueva auditoría independiente del propio diff ni declara cierre documental definitivo, publicación Git, implementación, pruebas PostgreSQL aprobadas o certificación de Supabase remoto.

## Preflight y alcance autorizado

Repositorio C:/Proyectos/globalexchange.com.ec; rama migracion-vite; HEAD comprobado antes de redactar: 49192c933e8eb51b362ab8069884392ed2de8f57. Árbol inicial limpio, staging vacío; los tres documentos 2B.0 no existían. Se localizaron los cuatro documentos normativos F0/API. No había cambios previos que incorporar.

Autorización humana limitada, opción A: adjunto 377cbeac-ac11-4e10-b2e6-4150945e2bc7/Texto pegado.txt. Solo autoriza crear contrato físico, plan y esta revisión, y añadir sus referencias al índice API. No autoriza SQL, fixtures, servicios, proveedores, código, staging, commit ni push.

## Fuentes y línea de tiempo

Las fuentes completas se recuperaron del chat 01a1c5f7-0f8e-7ab1-9214-d1b1d0428c35. Los identificadores siguientes permiten distinguir informes de sus solicitudes. No se reconstruyeron vacíos mediante hipótesis.

| Fuente | Turno de conversación | Alcance normativo |
|---|---|---|
| V1 | 01a1c78f-613a-7042-b396-b70c410b50e6 | Diseño inicial, sustituido como definición física |
| Auditoría F-01…F-07 | 01a1c798-d609-73f2-b325-1438377abd93 | Hallazgos que motivan V2 |
| V2 | 01a1c7a3-5b0c-7ce3-a0b5-f7ae9eb74907 | Correcciones; variantes posteriormente consolidadas |
| V2.1 | 01a1c7b6-f682-72d3-9ef4-e328ef363823 | Fuente física canónica |
| Verificación VF-01 | 01a1cc8f-dd1e-7db1-88b6-cb15e6ba56b2 | Detecta insuficiencia ACL/RLS |
| Corrección VF-01 | 01a1cc95-34ef-7eb2-b16f-0402d1008a3e | Sustituye la cláusula preliminar de seguridad |
| Reauditoría RVF | 01a1cca3-dd1c-7e73-91c9-9e077c415280 | RVF-01 MEDIUM y RVF-02 LOW |
| Corrección RVF | 01a1ccaa-0ca5-73e1-bcb2-ab8594e01a98 | Dependencia exacta, detector y pruebas por capas |
| Reauditoría final | 01a1ccaf-089d-7582-ad5e-f8a6db4f775b | APROBADO CON OBSERVACIONES LOW; harness a detallar |

V1 → auditoría F → V2 → consolidación V2.1 → VF-01 → RVF-01/RVF-02 → reauditoría favorable con LOW → formalización local actual. Las cláusulas posteriores de seguridad y validación prevalecen sobre sus exposiciones preliminares. La primera exposición V2 parcialmente interrumpida fue aportada por el usuario y comparada en la consolidación V2.1.

## Definición única y variantes retiradas

Solo el [contrato físico](PHASE_4D4B2B_2B0_PHYSICAL_CONTRACT.md) define objetos canónicos. La tabla siguiente es histórica: sus columnas de variantes no autorizan tablas alternativas.

| Aspecto | Primera exposición | Segunda exposición | Naturaleza | Definición canónica V2.1 |
|---|---|---|---|---|
| Guarda | `id smallint=1` | `singleton boolean=true` | Representación equivalente si existe fila permanente | `engine_guard(id smallint PK CHECK id=1)` |
| Head de reunión | `allocation_heads` | `meeting_allocation_heads` | Nomenclatura | `meeting_allocation_heads` |
| Ediciones | `config_editions/config_head` | `configuration_editions/configuration_head` | Nomenclatura | Nombres largos |
| Revisiones de perfil | `profile_revisions` | `requirement_profile_revisions` | Nomenclatura | `requirement_profile_revisions` |
| Evidencia de perfil | `set_profile_evidence`, con claves compuestas explícitas | `allocation_profile_evidence`, correspondencia parcialmente procedimental | Nomenclatura y fuerza declarativa | Nombre largo; columnas redundantes protegidas por FK compuestas |
| Elegibilidad | Por sujeto humano | Por `internal_user_id` | Modelado | Por sujeto humano único; correspondencia con empleado validada |
| Zoom | Verificación del pool y lista de unidades | Verificación independiente por unidad | Modelado y comportamiento | Verificación por pool con manifiesto relacional de unidades |
| Evidencia de capacidad usada | No plenamente vinculada a cada reserva | Tampoco explícita como relación propia | Omisión compartida | `reservation_zoom_evidence` |
| Sala opcional | `optional_room_requested` persistido | Petición expresa descrita, sin columna | Comportamiento verificable | Columna persistida y validada |
| Evidencia de calendario | PK con `piece_no` | PK reserva/publicación | Cardinalidad | Una fila por reserva/publicación; el tramo es su intersección exacta |
| Vigencias | Pueden ser no acotadas en ambos extremos | Inicio finito; fin eventualmente no acotado | Comportamiento | Inicio finito, fin opcionalmente no acotado; nunca timestamp `infinity` |
| Corte temporal | En transición | En operación | Modelado | En operación; todas sus transiciones comparten el corte |
| Guarda global | Nivel E | Nivel L−1 | Nomenclatura | Nivel E, previo a L0 |
| Roles y funciones | Apartado no incluido en el fragmento | Owner/kernel/runtime/admin | Comparación documental incompleta | Se fija aquí una matriz nueva, incluyendo rol de validación |

La elección no favorece automáticamente a la segunda exposición. Se conserva de la primera la identificación explícita de sala opcional, la elegibilidad por sujeto y la necesidad de acreditar independencia de capacidad dentro del pool.

En seguridad, la matriz VF-01 y la dependencia RVF-01 sustituyen el apartado preliminar de privilegios V2.1. El [plan de validación](PHASE_4D4B2B_2B0_VALIDATION_PLAN.md) aplica RVF-02; no duplica el modelo físico.

## F-01 a F-07

| Hallazgo | Invariante y objeto | Declarativo | Procedimental / I-U-D | Concurrencia y bypass | Prueba refutadora / dependencia | Dictamen V2.1 |
|---|---|---|---|---|---|---|
| F-01 | Incorporación permanente y una cadena vigente | FK recíproca, PK, self-FK, consecutividad | Alta completa; head avanza; identidad/historia no se editan ni borran; OLD/NEW | E; ACL; validación final sin nuevos locks | N-01/02/19; reconciliación histórica O-15 aparte | Resuelto en diseño |
| F-02 | Conjunto exacto según perfil autoritativo | Unicidad de ámbito, EXCLUDE, FK compuestas | Selección por programa real; cobertura, duración, asignada y opcionales; publicaciones inmutables | Publicar/reservar bajo E; cliente no elige autoridad | N-03/04/13; valores O-02/05/06 diferidos | Resuelto en diseño |
| F-03 | Escritores conformes sin ciclo de dominio | Guarda permanente y ACL | Entrada previa, relectura, composición acotada; validadores no adquieren locks explícitos | No cubre escritores ajenos | N-06…09; integración completa posterior | Resuelto con límite de aislamiento |
| F-04 | Capacidad no duplicada dentro del registro verificado | UNIQUE/FK pool-unidad-manifiesto-sujeto | Alta/alias controlados; verificación actual y evidencia histórica; sin eliminación | E; alias desconocido no crea capacidad | N-05/22; verdad externa O-04 | Resuelto con evidencia externa pendiente |
| F-05 | Sin DML ordinario que eluda invariantes | ACL, propietarios separados | Bootstrap definido; contexto privado; validadores con identidad propia; I/U/D por clase | Roles sin membresía privilegiada; sin API pública de contexto | N-16/17/23; integración de service_role posterior | Resuelto en diseño aislado |
| F-06 | Original inmutable y efectivo/journal consistentes | Rangos, contención, EXCLUDE, FK proyección | Creación exacta; transiciones consecutivas; sin pasado perdido; historia no editable | E y corte tras esperas | N-10/11/12/24; O-08 | Resuelto con transiciones limitadas |
| F-07 | Cada porción original justificada | FK compuestas, PK reserva/publicación, EXCLUDE de evidencia | Unión exacta; cierres/DST; evidencia inmutable | Ediciones y reservas bajo E | N-13/14/15/20; prueba del evaluador pendiente | Resuelto en diseño |

“Resuelto” se refiere a mecanismos contractualmente definidos; no a resultados de pruebas.

## Hallazgos de la consolidación V2.1

| ID | Severidad en V2 | Hallazgo | Corrección contractual V2.1 |
|---|---|---|---|
| V21-01 | HIGH | Bootstrap operación/contexto circular si la guarda genérica se aplica indiscriminadamente | Excepciones internas acotadas, ACL exclusivas y secuencia explícita |
| V21-02 | HIGH | Privilegios de validadores al COMMIT sin definición suficiente | Rol validator de solo lectura y funciones DEFINER independientes del contexto |
| V21-03 | MEDIUM | Permiso UPDATE necesario para bloquear la guarda no explicitado | Grant por columna más prohibición de mutación real |
| V21-04 | MEDIUM | N-24 podía confundir umbrales | Cinco subcasos con reglas reales diferenciadas |
| V21-05 | HIGH | Verificación individual no acredita explícitamente independencia conjunta ni deja referencia en cada reserva | Pool, manifiesto relacional y evidencia de reserva |
| V21-06 | MEDIUM | Sala opcional y pertenencia de evidencias no equivalentes entre variantes | Campo persistido y FK compuestas canónicas |
| V21-07 | LOW | Nombres y representaciones duplicados | Lista única; variantes retiradas como definiciones |
| V21-08 | LOW | Coste de guarda única y copias completas | Limitación de rendimiento documentada; optimización fuera de este cierre |

No identifico un HIGH o MEDIUM **residual** dentro del alcance aislado aquí delimitado. Los anteriores quedan corregidos en la propuesta documental, no mediante implementación.

Persisten dos observaciones LOW: coste de serialización/copia y necesidad de comprobar que el futuro DDL traduzca exactamente las restricciones descritas. Las pruebas pendientes no se presentan como PASS.

## VF-01, RVF-01 y RVF-02

| Hallazgo | Corrección incorporada | Evidencia futura y estado |
|---|---|---|
| VF-01 — bloqueo de seguridad | ACL por tabla/columna, RLS y FORCE según clase, policies técnicas, roles separados, restricciones de membresía, detector y validator DEFINER sin dependencia del contexto al COMMIT | R1–R20; NO EJECUTADO |
| RVF-01 — MEDIUM | EXECUTE de public.utf16_length(text) exclusivamente para kernel en aislamiento autorizado; firma exacta, retorno bigint, INVOKER y CHECK conservados; inventario del detector actualizado | R19 A1/A2/B/C/D1/D2; NO EJECUTADO |
| RVF-02 — LOW | Rechazo previo no demuestra capa objetivo; detector separado de RLS nativo; controles equivalentes y estados diferenciados | R1–R4/R10–R11 D/E y R19; NO EJECUTADO |
| LOW final — harness | Preparación privilegiada, observación con rol efectivo correcto, limpieza/restauración independiente; inventario antes/después de ACL, policies, membresías, fixtures, funciones, tablas, permisos e identidades | Incorporado al plan; ejecución futura NO EJECUTADO |

La reauditoría final fue **APROBADO CON OBSERVACIONES LOW** en análisis estático. La formalización incorpora el detalle exigido por esa observación; no se atribuye una nueva aprobación independiente a estos archivos recién redactados. No se reabren F-01…F-07 ni se crea V3.

## Compatibilidad y trazabilidad

Se conservan [F0 maestro](PHASE_4D4B2_F0_MASTER_CONTRACT.md), [matrices P/D](PHASE_4D4B2_F0_TRACEABILITY.md), [decisiones y validación F0](PHASE_4D4B2_F0_DECISIONS_AND_VALIDATION.md) y [API histórica](PHASE_4D_API.md).

- B-01…B-11 y T-01…T-07 permanecen aprobadas, opción A; el contrato conserva las decisiones B por referencia normativa y la definición aprobada de T.
- P-01…P-41, D-01…D-26, A2A-01…A2A-14, OBC y puertas F0 no pierden alcance.
- Sala compartida: recurso reutilizable de capacidad temporal uno; sin reuniones grupales por defecto.
- Zoom obligatorio al primer cierre funcional de Agenda; Meet futuro. WhatsApp obligatorio 24 h/2 h, omisión de vencidos, sin ráfagas, sustitución de trabajos obsoletos y deduplicación; email separado.
- Reserva pública, respuesta del cliente y confirmación interna autorizada siguen distintas.
- RPC, firmas, hashes, DTO, snapshots, replays, version, schedule_revision y booked_by conservados. Generación de recursos no sustituye schedule_revision. COMPLETE desde inicio; NO_SHOW desde final.
- Sin cambios de permisos productivos, service_role o Supabase remoto. Ningún rol nuevo obtiene BYPASSRLS ni acceso privilegiado por membresía ordinaria.

## Dependencias y límites pendientes

O-01/O-02: valores operativos; O-04: evidencia externa de capacidad real; O-05: reglas de sala; O-06: selección automática; O-08: cancelación residual; O-15/O-18: reconciliación y todos los escritores legacy; O-19: actor técnico; T-06: emergencia no habilitada. Las restantes O conservan sus puertas F0. No se asignan valores ni se activan políticas por esta redacción.

La guarda serializa escritores conformes del aislamiento y limita rendimiento. No prueba coordinación con escritores legacy. Copias completas de configuración y traducción fiel a futuro DDL requieren evaluación posterior. Calendarios/DST, GiST, privilegios efectivos, COMMIT, concurrencia y Zoom sintético no se han ensayado aquí. Capacidad Zoom real no se infiere de fixtures.

## Criterios para la siguiente auditoría documental

1. Solo los cuatro Markdown autorizados cambian; tres nuevos inspeccionados explícitamente aunque estén untracked.
2. Índice API con adición mínima; texto histórico conservado y F0 sin modificaciones.
3. Nomenclatura única y precedencia V2.1/VF/RVF coherente; variantes solo históricas en esta revisión.
4. Inventario físico y seguridad completos; garantías declarativas separadas de validadores y evidencia externa.
5. N-01…N-24, cinco subcasos N-24, R1–R20 y seis subcasos R19 conservados; todos NO EJECUTADO.
6. Atribución por capas y harness completo sin vías privilegiadas productivas.
7. Enlaces locales válidos, UTF-8 legible y diff sin errores de whitespace; staging vacío.
8. Sin implementación ni autorización implícita para 2B.1, pruebas mutantes, integración o despliegue.

## Estado de aprobación

**APROBADO EN DISEÑO DOCUMENTAL** describe las decisiones humanas y el dictamen estático de las fuentes, con los límites registrados. No significa **IMPLEMENTADO Y PROBADO**.

Este paquete está preparado localmente para auditoría READ-ONLY del diff. La autorización de implementación debe ser independiente, identificar alcance aislado, entorno, permisos, pruebas y límites, y resolver las dependencias aplicables antes de integraciones/activación. No se declara cierre definitivo ni publicación en Git: no se hizo staging, commit o push en esta tarea. Detenerse tras la comprobación documental; no comenzar 2B.1.
