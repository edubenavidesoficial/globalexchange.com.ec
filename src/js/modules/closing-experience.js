// ====================================================
// EXPERIENCIA FINAL
//
// Archivo:
// src/js/modules/closing-experience.js
//
// Responsabilidades:
//
// - Detectar cuándo entra la sección.
// - Fijar el escenario a la pantalla.
// - Liberarlo exactamente al terminar.
// - Calcular el progreso del scroll.
// - Revelar los textos.
// - Aplicar parallax.
// - Dibujar la ruta.
// - Mover el avión.
// - Actualizar la barra lateral.
// - Evitar espacios vacíos al final.
// ====================================================


// ====================================================
// INICIALIZACIÓN
// ====================================================

export function initClosingExperience() {

    const section =
        document.querySelector(
            '[data-closing-experience]'
        );


    if (!section) {
        return;
    }


    const stage =
        section.querySelector(
            '[data-closing-stage]'
        );


    if (!stage) {
        return;
    }


    // ================================================
    // MOVIMIENTO REDUCIDO
    // ================================================

    const reducedMotion =
        window.matchMedia(
            '(prefers-reduced-motion: reduce)'
        );


    if (reducedMotion.matches) {

        showCompleteExperience(
            section
        );

        return;

    }


    // ================================================
    // ESTADO DEL COMPONENTE
    // ================================================

    const state = {

        section,

        stage,

        reveals:
            Array.from(
                section.querySelectorAll(
                    '[data-closing-reveal]'
                )
            ),

        routePath:
            section.querySelector(
                '[data-closing-route-path]'
            ),

        plane:
            section.querySelector(
                '[data-closing-plane]'
            ),

        progressBar:
            section.querySelector(
                '[data-closing-progress-bar]'
            ),

        scrollIndicator:
            section.querySelector(
                '[data-closing-scroll-indicator]'
            ),

        frame:
            null

    };


    // ================================================
    // PREPARAR ELEMENTOS
    // ================================================

    prepareRoute(
        state
    );


    // ================================================
    // ACTUALIZACIÓN INICIAL
    // ================================================

    updateExperience(
        state
    );


    // ================================================
    // SCROLL
    // ================================================

    window.addEventListener(
        'scroll',
        () => {

            requestExperienceUpdate(
                state
            );

        },
        {
            passive: true
        }
    );


    // ================================================
    // CAMBIO DE TAMAÑO
    // ================================================

    window.addEventListener(
        'resize',
        () => {

            requestExperienceUpdate(
                state
            );

        },
        {
            passive: true
        }
    );

}


// ====================================================
// SOLICITAR ACTUALIZACIÓN
//
// requestAnimationFrame evita realizar demasiadas
// operaciones mientras el usuario hace scroll.
// ====================================================

function requestExperienceUpdate(
    state
) {

    if (state.frame) {
        return;
    }


    state.frame =
        window.requestAnimationFrame(
            () => {

                state.frame =
                    null;


                updateExperience(
                    state
                );

            }
        );

}


// ====================================================
// ACTUALIZACIÓN GENERAL
// ====================================================

function updateExperience(
    state
) {

    // ================================================
    // CONTROLAR POSICIÓN DEL ESCENARIO
    // ================================================

    updateStagePosition(
        state
    );


    // ================================================
    // CALCULAR PROGRESO
    // ================================================

    const progress =
        getSectionProgress(
            state.section
        );


    // ================================================
    // REVELAR TEXTO
    // ================================================

    updateReveals(
        state.reveals,
        progress
    );


    // ================================================
    // PARALLAX
    // ================================================

    updateBackgroundParallax(
        state.section,
        progress
    );


    // ================================================
    // RUTA Y AVIÓN
    // ================================================

    updateRoute(
        state,
        progress
    );


    // ================================================
    // BARRA DE PROGRESO
    // ================================================

    updateProgressBar(
        state.progressBar,
        progress
    );


    // ================================================
    // INDICADOR INICIAL
    // ================================================

    updateScrollIndicator(
        state.scrollIndicator,
        progress
    );

}


// ====================================================
// CONTROLAR EL ESCENARIO
//
// Existen tres estados:
//
// 1. ANTES:
//    El escenario está al comienzo de la sección.
//
// 2. ACTIVO:
//    El escenario está fijo en la pantalla.
//
// 3. COMPLETO:
//    El escenario queda pegado al final de la sección.
//
// Esta lógica sustituye position: sticky.
// ====================================================

function updateStagePosition(
    state
) {

    const section =
        state.section;


    const rectangle =
        section.getBoundingClientRect();


    const viewportHeight =
        window.innerHeight;


    // ================================================
    // TODAVÍA NO HEMOS ENTRADO
    // ================================================

    if (rectangle.top > 0) {

        section.classList.remove(
            'is-active'
        );


        section.classList.remove(
            'is-complete'
        );


        return;

    }


    // ================================================
    // LLEGAMOS AL FINAL
    //
    // El fondo del componente ya coincide con el
    // fondo de la pantalla.
    // ================================================

    if (
        rectangle.bottom <=
        viewportHeight
    ) {

        section.classList.remove(
            'is-active'
        );


        section.classList.add(
            'is-complete'
        );


        return;

    }


    // ================================================
    // ESTAMOS EN MEDIO DEL RECORRIDO
    // ================================================

    section.classList.remove(
        'is-complete'
    );


    section.classList.add(
        'is-active'
    );

}


// ====================================================
// CALCULAR PROGRESO
//
// Devuelve:
// 0 = inicio
// 1 = final
// ====================================================

function getSectionProgress(
    section
) {

    const rectangle =
        section.getBoundingClientRect();


    const viewportHeight =
        window.innerHeight;


    const travelDistance =
        Math.max(
            section.offsetHeight -
            viewportHeight,
            1
        );


    const traveled =
        -rectangle.top;


    return clamp(
        traveled /
        travelDistance,
        0,
        1
    );

}


// ====================================================
// REVELAR ELEMENTOS
// ====================================================

function updateReveals(
    elements,
    progress
) {

    elements.forEach(
        (element) => {

            const start =
                Number.parseFloat(
                    element.dataset.start ||
                    '0'
                );


            const end =
                Number.parseFloat(
                    element.dataset.end ||
                    '1'
                );


            const localProgress =
                normalizeRange(
                    progress,
                    start,
                    end
                );


            const eased =
                easeOutCubic(
                    localProgress
                );


            // ========================================
            // MOVIMIENTO VERTICAL
            // ========================================

            const translateY =
                (
                    1 -
                    eased
                ) *
                28;


            // ========================================
            // ESCALA MUY SUAVE
            // ========================================

            const scale =
                0.98 +
                (
                    eased *
                    0.02
                );


            // ========================================
            // OPACIDAD
            // ========================================

            element.style.opacity =
                `${eased}`;


            // ========================================
            // TRANSFORMACIÓN
            // ========================================

            element.style.transform =
                `
                    translate3d(
                        0,
                        ${translateY}px,
                        0
                    )
                    scale(
                        ${scale}
                    )
                `;


            // ========================================
            // INTERACCIÓN
            //
            // Evitamos que un botón invisible pueda
            // recibir clics accidentalmente.
            // ========================================

            element.style.pointerEvents =
                localProgress > 0.82
                    ? 'auto'
                    : 'none';

        }
    );

}


// ====================================================
// PARALLAX DE LAS FORMAS
// ====================================================

function updateBackgroundParallax(
    section,
    progress
) {

    // ================================================
    // AZUL
    // ================================================

    section.style.setProperty(
        '--closing-shape-blue-x',
        `${progress * 52}px`
    );


    section.style.setProperty(
        '--closing-shape-blue-y',
        `${progress * 34}px`
    );


    // ================================================
    // TURQUESA
    // ================================================

    section.style.setProperty(
        '--closing-shape-teal-x',
        `${progress * -48}px`
    );


    section.style.setProperty(
        '--closing-shape-teal-y',
        `${progress * 34}px`
    );


    // ================================================
    // NARANJA
    // ================================================

    section.style.setProperty(
        '--closing-shape-orange-x',
        `${progress * 46}px`
    );


    section.style.setProperty(
        '--closing-shape-orange-y',
        `${progress * -36}px`
    );


    // ================================================
    // LAVANDA
    // ================================================

    section.style.setProperty(
        '--closing-shape-lavender-x',
        `${progress * -44}px`
    );


    section.style.setProperty(
        '--closing-shape-lavender-y',
        `${progress * -38}px`
    );

}


// ====================================================
// PREPARAR RUTA
// ====================================================

function prepareRoute(
    state
) {

    if (!state.routePath) {
        return;
    }


    state.routePath.style.strokeDasharray =
        '1';


    state.routePath.style.strokeDashoffset =
        '1';


    if (state.plane) {

        state.plane.style.opacity =
            '0';

    }

}


// ====================================================
// ACTUALIZAR RUTA
// ====================================================

function updateRoute(
    state,
    progress
) {

    if (!state.routePath) {
        return;
    }


    const routeProgress =
        normalizeRange(
            progress,
            0.18,
            0.90
        );


    // ================================================
    // DIBUJAR LA LÍNEA
    // ================================================

    state.routePath.style.strokeDashoffset =
        `${1 -
        routeProgress
        }`;


    // ================================================
    // MOVER EL AVIÓN
    // ================================================

    updatePlanePosition(
        state.routePath,
        state.plane,
        routeProgress
    );

}


// ====================================================
// MOVER EL AVIÓN POR LA RUTA
// ====================================================

function updatePlanePosition(
    path,
    plane,
    progress
) {

    if (
        !path ||
        !plane
    ) {
        return;
    }


    // ================================================
    // LONGITUD DE LA RUTA
    // ================================================

    const totalLength =
        path.getTotalLength();


    const currentLength =
        totalLength *
        progress;


    // ================================================
    // POSICIÓN ACTUAL
    // ================================================

    const point =
        path.getPointAtLength(
            currentLength
        );


    // ================================================
    // SIGUIENTE POSICIÓN
    //
    // Se utiliza para conocer la orientación.
    // ================================================

    const nextLength =
        Math.min(
            currentLength + 2,
            totalLength
        );


    const nextPoint =
        path.getPointAtLength(
            nextLength
        );


    // ================================================
    // ÁNGULO
    // ================================================

    const angle =
        Math.atan2(
            nextPoint.y -
            point.y,

            nextPoint.x -
            point.x
        ) *
        (
            180 /
            Math.PI
        );


    // ================================================
    // ACTUALIZAR SVG
    // ================================================

    plane.setAttribute(
        'transform',

        `
            translate(
                ${point.x}
                ${point.y}
            )
            rotate(
                ${angle}
            )
        `
    );


    // ================================================
    // APARICIÓN DEL AVIÓN
    // ================================================

    plane.style.opacity =
        `${normalizeRange(
            progress,
            0.01,
            0.08
        )
        }`;

}


// ====================================================
// BARRA DE PROGRESO
// ====================================================

function updateProgressBar(
    progressBar,
    progress
) {

    if (!progressBar) {
        return;
    }


    progressBar.style.height =
        `${progress *
        100
        }%`;

}


// ====================================================
// INDICADOR "SIGUE EXPLORANDO"
// ====================================================

function updateScrollIndicator(
    indicator,
    progress
) {

    if (!indicator) {
        return;
    }


    // ================================================
    // DESAPARECE AL COMENZAR LA EXPERIENCIA
    // ================================================

    const visibility =
        1 -
        normalizeRange(
            progress,
            0,
            0.18
        );


    indicator.style.opacity =
        `${visibility}`;


    indicator.style.transform =
        `
            translateX(-50%)
            translateY(
                ${progress * 7}px
            )
        `;

}


// ====================================================
// MOSTRAR EXPERIENCIA COMPLETA
//
// Se utiliza cuando el sistema tiene activada
// la preferencia de movimiento reducido.
// ====================================================

function showCompleteExperience(
    section
) {

    section.classList.remove(
        'is-active'
    );


    section.classList.remove(
        'is-complete'
    );


    // ================================================
    // MOSTRAR TEXTOS
    // ================================================

    section
        .querySelectorAll(
            '[data-closing-reveal]'
        )
        .forEach(
            (element) => {

                element.style.opacity =
                    '1';


                element.style.transform =
                    'none';


                element.style.pointerEvents =
                    'auto';

            }
        );


    // ================================================
    // COMPLETAR RUTA
    // ================================================

    const route =
        section.querySelector(
            '[data-closing-route-path]'
        );


    const plane =
        section.querySelector(
            '[data-closing-plane]'
        );


    if (route) {

        route.style.strokeDasharray =
            '1';


        route.style.strokeDashoffset =
            '0';


        updatePlanePosition(
            route,
            plane,
            1
        );

    }


    // ================================================
    // COMPLETAR PROGRESO
    // ================================================

    const progressBar =
        section.querySelector(
            '[data-closing-progress-bar]'
        );


    if (progressBar) {

        progressBar.style.height =
            '100%';

    }


    // ================================================
    // OCULTAR INDICADOR INICIAL
    // ================================================

    const scrollIndicator =
        section.querySelector(
            '[data-closing-scroll-indicator]'
        );


    if (scrollIndicator) {

        scrollIndicator.style.display =
            'none';

    }

}


// ====================================================
// NORMALIZAR UN RANGO
//
// Convierte una parte del progreso general
// en un valor de 0 a 1.
// ====================================================

function normalizeRange(
    value,
    start,
    end
) {

    if (
        end <=
        start
    ) {

        return (
            value >= end
                ? 1
                : 0
        );

    }


    return clamp(
        (
            value -
            start
        ) /
        (
            end -
            start
        ),
        0,
        1
    );

}


// ====================================================
// SUAVIZADO
// ====================================================

function easeOutCubic(
    value
) {

    return (
        1 -
        Math.pow(
            1 -
            value,
            3
        )
    );

}


// ====================================================
// LIMITAR VALORES
// ====================================================

function clamp(
    value,
    minimum,
    maximum
) {

    return Math.min(
        Math.max(
            value,
            minimum
        ),
        maximum
    );

}