# Plan de validación — 4D.4B.2B / 2B.0

**PLAN FUTURO — NO EJECUTADO.** Fecha documental: 2026-11-11.

4D.4B.2B: **PROPUESTO — NO AUTORIZADO PARA IMPLEMENTACIÓN. 2B.1 NO AUTORIZADO.**

El [contrato físico](PHASE_4D4B2B_2B0_PHYSICAL_CONTRACT.md) define exclusivamente los objetos y permisos. La [revisión de cierre](PHASE_4D4B2B_2B0_CLOSURE_REVIEW.md) identifica las fuentes. Este plan no concede permisos ni autoriza PostgreSQL, fixtures, migraciones o proveedores.

## Estados y evidencia obligatoria

Todos los casos y subcasos están **NO EJECUTADO**, incluidos controles positivos, negativos, D/E y pruebas de integración. No se asigna PASS por inspección estática.

| Estado futuro | Significado |
|---|---|
| PASS | Se alcanzó la capa objetivo y se verificaron resultado, control equivalente y estado final/COMMIT o ROLLBACK |
| FAIL | La capa alcanzada incumple el resultado contractual o deja efectos inesperados |
| NO EVALUADO — rechazo previo | Otra capa detuvo la observación; registrar causa real |
| BLOQUEADO POR PRECONDICIÓN | Falta autorización, entorno, fixture, dependencia o condición necesaria |
| NO EJECUTADO | No se realizó el ensayo |

Registrar rol de sesión y efectivo, objeto/firma/constraint, ACL de tabla y columna, USAGE, EXECUTE, policies y membresías efectivas, etapa alcanzada, diagnóstico y estado posterior independiente. Separar retorno de función, COMMIT y ROLLBACK. Un error genérico no identifica por sí solo la capa.

## Matriz N-01 a N-24

Categorías: **P** prototipo aislado; **I** integración posterior. En P, los intentos que requieran introducir corrupción deliberada usan un harness autorizado separado, sin conceder esos permisos a runtime.

Evidencia común: entorno, rol efectivo, estado inicial, operación, resultado, estado final independiente y recuento de efectos. En carreras: ambas sesiones y locks observados.

| Caso | Categoría | Precondición y estado inicial | Operación | Resultado esperado / evidencia específica | Estado actual |
|---|---|---|---|---|---|
| N-01 | P | Reunión incorporada, head válido | Eliminar head | Denegación; incorporación y head intactos | NO EJECUTADO |
| N-02 | P | Dos reuniones con sets válidos | Trasladar reserva cambiando FK | Rechazo; ambas cadenas intactas | NO EJECUTADO |
| N-03 | P | Perfil exige humano+Zoom | Confirmar set solo humano | Fallo; ninguna reunión/set/reserva parcial | NO EJECUTADO |
| N-04 | P | Programa/ubicación distintos del perfil | Usar perfil incorrecto | Rechazo antes de confirmar | NO EJECUTADO |
| N-05 | P | Unidad con identidad y alias registrados | Segundo alias tratado como nueva unidad | Rechazo o resolución a unidad existente; un sujeto; prueba adicional de manifiesto ajeno rechazada | NO EJECUTADO |
| N-06 | P | Sujeto sin reservas previas | Dos sesiones reservan mismo intervalo | B espera E; tras commit A, B rechaza; tras rollback A, B puede aceptar | NO EJECUTADO |
| N-07 | P | Usuarios activos y configuración válida | Reserva frente a edición de actividad/elegibilidad | Espera en E, sin U/G invertidos | NO EJECUTADO |
| N-08 | P | Reserva y calendario válidos | Publicar frente a reprogramar | Serialización; ningún G→M tardío en validador | NO EJECUTADO |
| N-09 | P | S1/S2 disponibles | A: S1→S2; B: S2→S1 en transacciones compuestas | Serialización por E; estado final coherente; repetir con rollback a savepoint | NO EJECUTADO |
| N-10 | P | Reserva con journal válido | Cambiar efectivo sin transición | ACL/guard/validador rechazan; proyección intacta | NO EJECUTADO |
| N-11 | P | Generación histórica | Editar/eliminar set, original o journal | Rechazo; historia idéntica | NO EJECUTADO |
| N-12 | P | Parte de ocupación transcurrida | Vaciar o recortar pasado | Rechazo; pasado conservado | NO EJECUTADO |
| N-13 | P | Cierre intersecta reunión o buffer | Crear reserva | Rechazo completo; evidencia muestra intersección | NO EJECUTADO |
| N-14 | P | Reserva futura aceptada | Nueva edición elimina cobertura | Publicación rechazada; head anterior intacto | NO EJECUTADO |
| N-15 | P | Cierre local ambiguo sin resolución | Evaluar/publicar para intervalo afectado | Rechazo; cierre no omitido | NO EJECUTADO |
| N-16 | P | Roles sin DML base | INSERT/UPDATE/DELETE/TRUNCATE directo | Denegación; permisos efectivos registrados | NO EJECUTADO |
| N-17 | P/I | Meeting incorporada | Cambiar logística/asignada/programa padre sin coordinación | Rechazo en aislamiento; integración verifica todos los escritores reales | NO EJECUTADO |
| N-18 | I | Registro idempotente histórico; estado/configuración cambiados | Replay mismo contrato/key/hash | Snapshot y precedencia originales; cero nuevos efectos | NO EJECUTADO |
| N-19 | P | Head g y cadena válida | Salto g+2, bifurcación o retroceso | Rechazo; head y cadena originales | NO EJECUTADO |
| N-20 | P | Revisión repetida en varias publicaciones | Reserva atraviesa vigencias | Aceptación solo con cobertura exacta; hueco produce rechazo | NO EJECUTADO |
| N-21 | P | Operación multirrecurso | Fallo inducido al final/COMMIT | Rollback total, incluido contexto y efectos de operación | NO EJECUTADO |
| N-22 | P | Pool deshabilitado, verificación vencida o unidad ausente del manifiesto | Nueva reserva online | Rechazo; ninguna reserva/provisión | NO EJECUTADO |
| N-23 | P | Login ordinario | SET ROLE owner/kernel/validator o falsificar actor/contexto | Denegación; revisar membresías transitivas y `session_user` | NO EJECUTADO |
| N-24 | P/I | Reunión `scheduled`, padre válido, actor autorizado y versión correcta | Subcasos temporales siguientes | Resultado y ocupación según cada umbral | NO EJECUTADO |

**N-24 se divide obligatoriamente**

| Subcaso | Tiempo evaluado tras locks | Resultado | Estado actual |
|---|---|---|---|
| A: COMPLETE temprano | `t < scheduled_at` | `MEETING_TOO_EARLY`; cero efectos | NO EJECUTADO |
| B: COMPLETE permitido | `t ≥ scheduled_at` | Puede completar sin esperar al final; efectivo sin cambios | NO EJECUTADO |
| C: NO_SHOW temprano | `t < scheduled_at + duration` | `MEETING_TOO_EARLY`; cero efectos | NO EJECUTADO |
| D: NO_SHOW permitido | `t ≥ scheduled_at + duration` | Puede marcar no-show; efectivo sin cambios | NO EJECUTADO |
| E: Buffer posterior retenido | Resultado ya permitido y buffer sintético positivo todavía vigente | Otra reserva que lo intersecte debe rechazarse | NO EJECUTADO |

Los parámetros sintéticos no son políticas empresariales aprobadas.

Los umbrales están en [COMPLETE](../supabase/migrations/20261020120000_meeting_outcome_workflow.sql#L361) y [NO_SHOW](../supabase/migrations/20261020120000_meeting_outcome_workflow.sql#L550). La categoría I verifica RPC reales; P verifica el modelo aislado sin atribuirle integración terminada.

## Matriz R1 a R20

La evidencia mínima común será: entorno, rol de sesión y efectivo, ACL/policies aplicables, precondiciones, operación, resultado observado y estado final independiente. Los defectos de seguridad se introducen únicamente mediante harness privilegiado autorizado, nunca otorgando esos permisos al runtime.

| Caso | Precondición / rol | Operación | Resultado esperado | Evidencia específica | Estado actual |
|---|---|---|---|---|---|
| N-16/R1 | Kernel tiene GRANT; falta policy SELECT | Ejecutar entrada que consulta la tabla | Ver observaciones D/E y control positivo en RVF-02 | Registrar cada capa por separado | NO EJECUTADO |
| N-16/R2 | Kernel tiene INSERT ACL; falta policy INSERT | Intentar operación escritora | Ver observaciones D/E y control positivo en RVF-02 | Registrar cada capa por separado | NO EJECUTADO |
| N-16/R3 | Policy UPDATE USING falsa o selectiva | Actualizar una reunión | Ver observaciones D/E y control positivo en RVF-02 | Registrar cada capa por separado | NO EJECUTADO |
| N-16/R4 | UPDATE USING permite; WITH CHECK rechaza nuevo estado | Ejecutar cambio | Ver observaciones D/E y control positivo en RVF-02 | Registrar cada capa por separado | NO EJECUTADO |
| N-16/R5 | Runtime sin DML base | INSERT/UPDATE/DELETE/TRUNCATE directo | Denegación | ACL efectiva y tablas intactas | NO EJECUTADO |
| N-16/R6 | Admin con EXECUTE administrativo | UPDATE directo de reserva | Denegación | Rol efectivo y reserva intacta | NO EJECUTADO |
| N-16/R7 | Falta USAGE de esquema requerido | Ejecutar función que depende de él | Error; nunca éxito parcial | ACL de esquema y rollback | NO EJECUTADO |
| N-16/R8 | Kernel tiene permiso de locking de guarda | SELECT FOR UPDATE | Lock adquirido | Observación desde segunda sesión | NO EJECUTADO |
| N-16/R9 | Mismos permisos de guarda | UPDATE, incluso `id=id`, o DELETE | Trigger/ACL rechaza modificación | Fila singleton intacta | NO EJECUTADO |
| N-17/R10 | Validator con policy selectiva por actor | Confirmar operación con reservas de otros actores | Ver observaciones D/E y control positivo en RVF-02 | Registrar cada capa por separado | NO EJECUTADO |
| N-17/R11 | Policy SELECT true más restrictive SELECT/ALL | Ejecutar validador | Ver observaciones D/E y control positivo en RVF-02 | Registrar cada capa por separado | NO EJECUTADO |
| N-17/R12 | Contrato RLS correcto; falta un head/recurso/evidencia requerida | Validar estado corrupto del harness | Error de integridad; no aceptación vacía | Cardinalidad real y resultado | NO EJECUTADO |
| N-21/R13 | Operación válida, contexto retirado | COMMIT | Validadores funcionan como validator y leen conjunto completo | Contexto vacío, identidad efectiva y éxito real | NO EJECUTADO |
| N-21/R14 | Contexto retirado; invariante final rota | COMMIT | Fallo y rollback total | Sin efectos parciales | NO EJECUTADO |
| N-21/R15 | RLS y FORCE según configuración autorizada | Repetir operación válida y negativa | Kernel/validator siguen sujetos a policies; resultado equivalente | Flags, propietarios y roles | NO EJECUTADO |
| N-23/R16 | Login runtime/admin | SET ROLE owner/kernel/validator, también por ruta transitiva | Denegación | Membresías y error | NO EJECUTADO |
| N-23/R17 | Login ordinario | Ejecutar helper interno o abrir contexto | Denegación | EXECUTE y ausencia de contexto | NO EJECUTADO |
| N-23/R18 | Función DEFINER autorizada | Alterar actor indicado por cliente o GUC | No suplanta `session_user`; rechazo si contradice el mapeo | Principal/actor persistidos | NO EJECUTADO |
| N-23/R19 | Dependencia exacta utf16_length(text) y roles autorizados | Subcasos A1/A2/B/C/D1/D2 | Ver matriz ampliada obligatoria | Capa alcanzada, permisos, identidades y estado final | NO EJECUTADO |
| N-23/R20 | Función o tabla con propietario inesperado/BYPASSRLS | Ejecutar entrada o validador | Comprobación de seguridad rechaza | Catálogo de propiedad/roles | NO EJECUTADO |

R13 y R14 son complementarios: la ausencia de contexto no debe impedir una validación correcta ni permitir una incorrecta.

Se ensayará FORCE sobre tablas nuevas conforme a la cláusula y, mediante variantes expresamente autorizadas del aislamiento, su efecto en dependencias existentes. No se cambia FORCE en producción.

## RVF-02: atribución y controles equivalentes

> **Atribución obligatoria de resultados negativos.**
>
> Cada caso declarará la capa que pretende verificar y la etapa que debe alcanzar. Un rechazo anterior no constituye PASS de la capa objetivo.
>
> Se distinguirán: detector de configuración, USAGE de esquema, ACL de tabla/columna, EXECUTE de función, RLS, trigger y constraint.
>
> Todo caso negativo tendrá un control positivo con condiciones equivalentes, variando únicamente la condición examinada. El registro incluirá rol de sesión y efectivo, objeto, privilegios/policies pertinentes, etapa alcanzada, diagnóstico y estado final.
>
> Un SQLSTATE o mensaje genérico aislado no será evidencia suficiente cuando varias capas puedan producirlo. Si la capa objetivo no fue alcanzada, el resultado será «NO EVALUADO — rechazo previo», con identificación de la causa real.

**Actualización R1–R4 y R10–R11**

Cada caso se divide en dos observaciones cuando corresponda:

- **D:** detector `assert_security_contract()`.
- **E:** efecto nativo de RLS en el harness autorizado, sin el detector previo y sin retirar las demás defensas.

| Caso | Condición negativa | Observación D | Observación E | Control positivo | Estado actual |
|---|---|---|---|---|---|
| **R1** | Kernel con SELECT ACL, sin policy SELECT aplicable | Rechazo de configuración | SELECT no ve las filas conocidas por falta de policy; no necesariamente produce excepción | Policy SELECT válida muestra las filas esperadas | NO EJECUTADO |
| **R2** | Kernel con INSERT ACL, sin policy INSERT aplicable | Rechazo de configuración | INSERT alcanza RLS y se rechaza | INSERT equivalente con policy válida | NO EJECUTADO |
| **R3** | UPDATE USING excluye la fila; SELECT permite verla | Rechazo de configuración | UPDATE puede afectar cero filas sin excepción; ese cero no es éxito del comando | USING válido afecta la fila prevista | NO EJECUTADO |
| **R4** | USING permite la fila; WITH CHECK rechaza su estado nuevo | Rechazo de configuración | Error por RLS al comprobar el estado nuevo | Mismo cambio con WITH CHECK válido | NO EJECUTADO |
| **R10** | SELECT del validator filtra por actor | Rechazo de configuración | Consulta controlada demuestra que faltan filas de otro actor; no se ejecuta un validador para aprobar integridad con esa visibilidad | SELECT técnico completo incluye ambos actores | NO EJECUTADO |
| **R11** | SELECT permisiva verdadera y restrictive aplicable que limita filas | Rechazo de configuración | Consulta muestra el efecto combinado de ambas policies | Sin la restricción defectuosa se recupera el conjunto esperado | NO EJECUTADO |

En R11 debe demostrarse que la policy restrictiva es aplicable al rol efectivo, directamente, mediante PUBLIC o por membresía. No basta con que exista en la tabla.

PostgreSQL puede filtrar filas mediante `USING` sin lanzar error; `WITH CHECK` controla el estado nuevo. Las policies permisivas se combinan mediante OR y las restrictivas mediante AND. [CREATE POLICY](https://www.postgresql.org/docs/17/sql-createpolicy.html).

**Reglas para evitar falsos PASS**

- Falta USAGE: prueba de USAGE, no de RLS.
- Falta EXECUTE: prueba de función, no del CHECK que no llegó a evaluarse.
- Trigger rechaza antes de `WITH CHECK`: prueba del trigger, no de RLS.
- Detector rechaza una policy: prueba del detector, no del efecto nativo.
- SELECT devuelve cero filas: requiere demostrar que existían filas y que el control positivo las muestra.
- UPDATE afecta cero filas: no equivale a una transición empresarial completada.
- COMMIT falla: debe verificarse rollback; no basta observar un retorno previo de función.

Las vías de diagnóstico del harness no forman parte de las funciones exportadas ni de los permisos ordinarios del producto.

## R19: dependencia public.utf16_length(text)

Precondiciones comunes:

- PostgreSQL aislado y pruebas autorizados independientemente.
- Roles, ACL, USAGE, RLS, funciones y constraints identificados.
- Reuniones sintéticas con padre, actor, asignada, perfil y recursos válidos.
- Contexto de escritura válido cuando la prueba deba alcanzar el DML.
- Todos los controles ajenos a la variable examinada deben permitir avanzar.
- Sin desactivar RLS, triggers ni constraints para obtener el resultado.

| Subcaso | Rol efectivo y precondición | Operación futura | Resultado esperado | Evidencia mínima | Estado actual |
|---|---|---|---|---|---|
| **A1 — Detector** | Kernel sin EXECUTE del helper | Entrada normal que comprueba seguridad | `assert_security_contract()` rechaza antes del DML | Permiso ausente, etapa del rechazo y cero efectos | NO EJECUTADO |
| **A2 — Dependencia nativa** | Kernel sin EXECUTE; demás controles válidos; vía exclusiva del harness descrita debajo | INSERT con notas válidas no nulas y, por separado, UPDATE permitido de una reunión con notas válidas | Rechazo atribuible a EXECUTE de `utf16_length(text)` | Identidad efectiva, firma, diagnóstico y estado sin cambios | NO EJECUTADO |
| **B — Control positivo** | Kernel con EXECUTE autorizado; condiciones equivalentes a A2 | INSERT y UPDATE equivalentes | Superan la dependencia y las demás validaciones; éxito sujeto a COMMIT | Estado final independiente, journal y ausencia de parcialidad | NO EJECUTADO |
| **C — CHECK** | Kernel con EXECUTE; demás controles válidos; notas de más de 2000 unidades UTF-16 | INSERT que alcance el CHECK | Rechazo por `meetings_notes_utf16_length_valid`, no por permisos | Nombre del constraint, diagnóstico y ausencia de inserción | NO EJECUTADO |
| **D1 — Acceso directo** | Runtime/admin sin EXECUTE adicional del helper | Invocación directa de la función | Denegación de acceso directo | Privilegios efectivos y diagnóstico | NO EJECUTADO |
| **D2 — Entrada autorizada** | Runtime/admin con EXECUTE de una entrada que les corresponda | Operación legítima mediante esa entrada | El kernel puede evaluar el CHECK sin conceder EXECUTE directo al llamador | `session_user`, rol efectivo interno y resultado | NO EJECUTADO |

**Aclaración necesaria para A2**

Con el contrato normal, A1 debe detener la operación antes del CHECK. Por tanto, A2 necesita una prueba separada del harness privilegiado autorizado:

- Ejecuta la sentencia con rol efectivo kernel y contexto válido.
- No pasa por el detector previo, para observar específicamente la dependencia nativa.
- Mantiene ACL, RLS, triggers y constraints.
- No modifica la función de entrada normal ni introduce una vía exportada al runtime.

No debe declararse A2 superado si solo se observó A1.

**Precisiones de C y del UPDATE**

- El máximo se mide en unidades UTF-16, no simplemente en número de caracteres.
- Un dato inequívoco para el caso negativo es una cadena de 2001 caracteres ASCII.
- C se prueba mediante INSERT: esta corrección no concede UPDATE de `notes`.
- El UPDATE de A2/B modifica una columna ya permitida y conserva notas válidas existentes.
- Si un validador previo rechaza las notas largas antes de llegar al CHECK, ese resultado no demuestra C; se registra la capa real.

## Harness: preparación, observación y limpieza obligatorias

El harness es exclusivo de un PostgreSQL aislado, con autorización futura independiente. No desactiva RLS, constraints o triggers; no concede BYPASSRLS ni convierte roles ordinarios en propietarios. No se exportan funciones diagnósticas al producto.

1. **Preparación privilegiada:** identificar entorno desechable, autorización y responsable; capturar inventario previo; establecer únicamente fixtures, mapeos y condición negativa del caso. Separar la capacidad del controlador de los permisos de runtime/admin. Toda membresía diagnóstica o función auxiliar queda inventariada y limitada al aislamiento.
2. **Observación:** ejecutar con rol efectivo kernel, validator o rol ordinario según el caso, sin privilegios efectivos de owner o BYPASSRLS. Registrar session_user/current_user; un SET ROLE del controlador no demuestra que un usuario ordinario pueda asumir ese rol. A2 y E omiten solo la llamada previa al detector en su recorrido diagnóstico: no alteran las entradas normales ni retiran las restantes defensas. Los controles positivos y negativos varían únicamente la condición examinada.
3. **Limpieza y verificación independiente:** restaurar ACL/policies/membresías al inventario autorizado, retirar fixtures y funciones diagnósticas y comprobar tablas y permisos residuales. Ejecutar esta verificación también tras error, rollback o interrupción. Una limpieza incompleta deja el entorno bloqueado para nuevos ensayos y no permite declarar el caso completo como PASS.

**Roles diagnósticos:** antes de la preparación, inventariar los roles diagnósticos existentes, sus membresías y permisos efectivos. Los roles diagnósticos adicionales solo podrán crearse mediante autorización futura expresa y deberán identificarse en el manifiesto de preparación. Durante la limpieza se retirarán los roles adicionales creados por el harness, sus membresías y permisos asociados, sin eliminar roles legítimos preexistentes. Una verificación independiente del catálogo antes/después exigirá ausencia final de roles diagnósticos adicionales y de privilegios persistentes introducidos por el ensayo. Si la limpieza queda incompleta, se registrará FAIL para la limpieza y BLOQUEADO POR PRECONDICIÓN para nuevos ensayos; nunca PASS. El procedimiento ordinario no concede a runtime/admin privilegios de propietario, kernel, validator ni BYPASSRLS.

| Inventario obligatorio antes/después | Evidencia y restauración |
|---|---|
| ACL | Esquema, tablas, columnas y firmas; grants directos/heredados/PUBLIC y ausencia de concesiones residuales |
| Policies | Nombre, roles, comando, permisiva/restrictiva, USING/WITH CHECK y flags RLS/FORCE |
| Membresías | Grafo directo/transitivo y facultad SET ROLE; retirar privilegios diagnósticos |
| Fixtures | Identificadores sintéticos, dependencias y eliminación/restauración controlada en aislamiento |
| Funciones diagnósticas | Firma, propietario, seguridad, search_path, EXECUTE; ausencia final y no exposición productiva |
| Estado de tablas | Filas, cadenas, heads, reservas, evidencia, journal y contexto; comparación independiente |
| Permisos residuales | Comparación completa con baseline autorizado; cero ampliaciones no previstas |
| Identidades | session_user/current_user en preparación, observación y limpieza; observar con rol correcto |

## Cobertura de ensayos reales futuros

| Área | Casos y condición de aceptación futura | Estado |
|---|---|---|
| GiST e intervalos | N-06/12/13: solapamiento rechazado, adyacencia [) permitida, buffers incluidos y pasado preservado | NO EJECUTADO |
| Dos sesiones y esperas | N-06/07/08: registrar espera en E, COMMIT y ROLLBACK del competidor y relectura posterior | NO EJECUTADO |
| Composición y savepoints | N-09: varias llamadas; rollback al savepoint revierte efectos y locks posteriores sin estado parcial | NO EJECUTADO |
| Integridad diferida y fallos | N-01/03/19/21, R12/13/14: rechazo al COMMIT y rollback total; control válido sin contexto persistente | NO EJECUTADO |
| Inmutabilidad | N-02/10/11/12: caminos INSERT/UPDATE/DELETE/TRUNCATE; historia y original intactos | NO EJECUTADO |
| Privilegios y RLS | N-16/23 y R1–R20; capa objetivo demostrada, identidad efectiva y controles equivalentes | NO EJECUTADO |
| Zoom sintético | N-05/22: pool/unidad/manifiesto/alias/evidencia coherentes; no acredita capacidad externa O-04 | NO EJECUTADO |
| Calendarios, buffers y DST | N-13/14/15/20: cobertura exacta, huecos, cierres, ambigüedad y revisiones; datos sintéticos sin aprobar políticas reales | NO EJECUTADO |
| Legacy | N-17/18/24 categoría I: escritores coordinados, replay/snapshots/hash/version/schedule_revision/booked_by conservados | NO EJECUTADO |

No usar la categoría P como prueba de integración. O-04, O-08, O-15/O-18, políticas operativas y emergencia T-06 conservan las puertas del contrato. Los umbrales de COMPLETE y NO_SHOW siguen diferenciados. No iniciar ensayos ni 2B.1 con esta autorización documental.
