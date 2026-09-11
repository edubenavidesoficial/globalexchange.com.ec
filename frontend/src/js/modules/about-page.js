// ====================================================
// ABOUT PAGE
//
// Archivo:
// src/js/modules/about-page.js
//
// Página:
// Nosotros / Nuestra Historia
//
// Responsabilidades:
//
// - Revelar elementos al entrar en pantalla.
// - Animar la línea temporal de Nuestra Historia.
// - Activar visualmente las etapas del timeline.
// - Aplicar parallax suave al hero.
// - Aplicar profundidad 3D sutil a imágenes.
// - Animar los indicadores circulares de Sedes.
// - Respetar prefers-reduced-motion.
//
// Este módulo reemplaza también la responsabilidad de:
// src/js/modules/about-locations-progress.js
// ====================================================


// ====================================================
// CONFIGURACIÓN
// ====================================================

const REVEAL_SELECTOR =
    '[data-about-reveal]';


const STORY_SELECTOR =
    '[data-about-story]';


const STORY_PROGRESS_SELECTOR =
    '[data-about-story-progress]';


const STORY_ITEM_SELECTOR =
    '[data-about-story-item]';


const TILT_SELECTOR =
    '[data-about-tilt]';


const PROGRESS_SELECTOR =
    '[data-about-progress]';


const PROGRESS_VALUE_SELECTOR =
    '[data-about-progress-value]';


const HERO_SELECTOR =
    '[data-about-hero]';


// ====================================================
// INICIALIZACIÓN
// ====================================================

export function initAboutPage() {

    const page =
        document.querySelector(
            '.about-page'
        );


    // ================================================
    // ESTA PÁGINA NO ESTÁ PRESENTE
    //
    // main.js se utiliza en distintas páginas.
    // Si no estamos en Nosotros, salimos sin hacer
    // ningún trabajo adicional.
    // ================================================

    if (!page) {
        return;
    }


    // ================================================
    // PREFERENCIA DE MOVIMIENTO
    // ================================================

    const reducedMotionQuery =
        window.matchMedia(
            '(prefers-reduced-motion: reduce)'
        );


    // ================================================
    // MOVIMIENTO REDUCIDO
    // ================================================

    if (reducedMotionQuery.matches) {

        showCompleteAboutPage(
            page
        );

        return;
    }


    // ================================================
    // INICIALIZAR EXPERIENCIAS
    // ================================================

    initRevealAnimations(
        page
    );


    initStoryTimeline(
        page
    );


    initHeroParallax(
        page
    );


    initTiltEffects(
        page
    );


    initProgressCircles(
        page
    );

}


// ====================================================
// REVEAL DE ELEMENTOS
//
// Los elementos pueden declarar:
//
// data-about-reveal="up"
// data-about-reveal="left"
// data-about-reveal="right"
//
// CSS define desde dónde aparecen.
// JavaScript solamente activa .is-visible.
// ====================================================

function initRevealAnimations(
    page
) {

    const elements =
        Array.from(
            page.querySelectorAll(
                REVEAL_SELECTOR
            )
        );


    if (!elements.length) {
        return;
    }


    // ================================================
    // FALLBACK
    //
    // Navegadores modernos soportan
    // IntersectionObserver, pero evitamos dejar
    // contenido invisible si no estuviera disponible.
    // ================================================

    if (
        !(
            'IntersectionObserver'
            in window
        )
    ) {

        elements.forEach(
            showRevealElement
        );


        return;
    }


    const observer =
        new IntersectionObserver(
            (
                entries,
                currentObserver
            ) => {

                entries.forEach(
                    (entry) => {

                        if (
                            !entry.isIntersecting
                        ) {
                            return;
                        }


                        showRevealElement(
                            entry.target
                        );


                        currentObserver.unobserve(
                            entry.target
                        );

                    }
                );

            },
            {
                threshold:
                    0.14,

                rootMargin:
                    '0px 0px -7% 0px'
            }
        );


    elements.forEach(
        (
            element,
            index
        ) => {

            // ========================================
            // STAGGER MUY SUTIL
            //
            // Evitamos retrasos grandes porque hacen
            // sentir lenta la navegación.
            // ========================================

            const delay =
                (
                    index %
                    3
                ) *
                70;


            element.style.transitionDelay =
                `${delay}ms`;


            observer.observe(
                element
            );

        }
    );

}


// ====================================================
// MOSTRAR ELEMENTO REVEAL
// ====================================================

function showRevealElement(
    element
) {

    element.classList.add(
        'is-visible'
    );

}


// ====================================================
// TIMELINE DE NUESTRA HISTORIA
//
// La línea vertical se llena según el scroll.
// También activa los nodos cuando cada etapa llega
// a una posición relevante del viewport.
// ====================================================

function initStoryTimeline(
    page
) {

    const story =
        page.querySelector(
            STORY_SELECTOR
        );


    const progressElement =
        page.querySelector(
            STORY_PROGRESS_SELECTOR
        );


    const items =
        Array.from(
            page.querySelectorAll(
                STORY_ITEM_SELECTOR
            )
        );


    if (
        !story ||
        !progressElement
    ) {
        return;
    }


    let frame =
        null;


    // ================================================
    // SOLICITAR ACTUALIZACIÓN
    // ================================================

    function requestUpdate() {

        if (
            frame !==
            null
        ) {
            return;
        }


        frame =
            window.requestAnimationFrame(
                () => {

                    frame =
                        null;


                    updateStoryTimeline(
                        story,
                        progressElement,
                        items
                    );

                }
            );

    }


    // ================================================
    // EVENTOS
    // ================================================

    window.addEventListener(
        'scroll',
        requestUpdate,
        {
            passive:
                true
        }
    );


    window.addEventListener(
        'resize',
        requestUpdate,
        {
            passive:
                true
        }
    );


    // ================================================
    // ESTADO INICIAL
    // ================================================

    requestUpdate();

}


// ====================================================
// ACTUALIZAR TIMELINE
// ====================================================

function updateStoryTimeline(
    story,
    progressElement,
    items
) {

    const rectangle =
        story.getBoundingClientRect();


    const viewportHeight =
        window.innerHeight;


    // ================================================
    // PUNTOS DE REFERENCIA
    //
    // La animación empieza antes de que el timeline
    // llegue al centro de la pantalla y finaliza
    // cuando su parte inferior se aproxima al centro.
    // ================================================

    const startPoint =
        viewportHeight *
        0.70;


    const endPoint =
        viewportHeight *
        0.30;


    const travelDistance =
        Math.max(
            rectangle.height +
            startPoint -
            endPoint,
            1
        );


    const traveled =
        startPoint -
        rectangle.top;


    const progress =
        clamp(
            traveled /
            travelDistance,
            0,
            1
        );


    // ================================================
    // LÍNEA
    // ================================================

    progressElement.style.transform =
        `scaleY(${progress})`;


    // ================================================
    // ETAPAS
    // ================================================

    items.forEach(
        (item) => {

            const itemRectangle =
                item.getBoundingClientRect();


            const itemCenter =
                itemRectangle.top +
                (
                    itemRectangle.height /
                    2
                );


            const active =
                itemCenter <
                viewportHeight *
                0.70;


            item.classList.toggle(
                'is-active',
                active
            );

        }
    );

}


// ====================================================
// PARALLAX DEL HERO
//
// Se mueve solamente el background-position.
// No modificamos el layout ni la altura del hero.
// ====================================================

function initHeroParallax(
    page
) {

    const hero =
        page.querySelector(
            HERO_SELECTOR
        );


    if (!hero) {
        return;
    }


    let frame =
        null;


    function requestUpdate() {

        if (
            frame !==
            null
        ) {
            return;
        }


        frame =
            window.requestAnimationFrame(
                () => {

                    frame =
                        null;


                    updateHeroParallax(
                        hero
                    );

                }
            );

    }


    window.addEventListener(
        'scroll',
        requestUpdate,
        {
            passive:
                true
        }
    );


    window.addEventListener(
        'resize',
        requestUpdate,
        {
            passive:
                true
        }
    );


    requestUpdate();

}


// ====================================================
// ACTUALIZAR PARALLAX
// ====================================================

function updateHeroParallax(
    hero
) {

    const rectangle =
        hero.getBoundingClientRect();


    const height =
        Math.max(
            hero.offsetHeight,
            1
        );


    // ================================================
    // SI ESTÁ MUY LEJOS DEL VIEWPORT
    // ================================================

    if (
        rectangle.bottom <
        0
    ) {

        hero.style.setProperty(
            '--about-hero-parallax',
            '42px'
        );


        return;
    }


    if (
        rectangle.top >
        window.innerHeight
    ) {

        hero.style.setProperty(
            '--about-hero-parallax',
            '0px'
        );


        return;
    }


    const progress =
        clamp(
            -rectangle.top /
            height,
            0,
            1
        );


    // ================================================
    // MOVIMIENTO MÁXIMO
    //
    // 42px mantiene el efecto elegante.
    // ================================================

    const movement =
        progress *
        42;


    hero.style.setProperty(
        '--about-hero-parallax',
        `${movement}px`
    );

}


// ====================================================
// EFECTOS 3D
//
// Se aplican únicamente a elementos marcados con:
//
// data-about-tilt
//
// El movimiento es deliberadamente pequeño para
// mantener una estética corporativa.
// ====================================================

function initTiltEffects(
    page
) {

    const elements =
        Array.from(
            page.querySelectorAll(
                TILT_SELECTOR
            )
        );


    if (!elements.length) {
        return;
    }


    elements.forEach(
        (element) => {

            let frame =
                null;


            let pointerX =
                0.5;


            let pointerY =
                0.5;


            // ========================================
            // POINTER MOVE
            // ========================================

            element.addEventListener(
                'pointermove',
                (event) => {

                    // =================================
                    // NO HACER TILT EN TOUCH
                    // =================================

                    if (
                        event.pointerType ===
                        'touch'
                    ) {
                        return;
                    }


                    const rectangle =
                        element.getBoundingClientRect();


                    pointerX =
                        clamp(
                            (
                                event.clientX -
                                rectangle.left
                            ) /
                            Math.max(
                                rectangle.width,
                                1
                            ),
                            0,
                            1
                        );


                    pointerY =
                        clamp(
                            (
                                event.clientY -
                                rectangle.top
                            ) /
                            Math.max(
                                rectangle.height,
                                1
                            ),
                            0,
                            1
                        );


                    if (
                        frame !==
                        null
                    ) {
                        return;
                    }


                    frame =
                        window.requestAnimationFrame(
                            () => {

                                frame =
                                    null;


                                applyTilt(
                                    element,
                                    pointerX,
                                    pointerY
                                );

                            }
                        );

                }
            );


            // ========================================
            // POINTER LEAVE
            // ========================================

            element.addEventListener(
                'pointerleave',
                () => {

                    if (
                        frame !==
                        null
                    ) {

                        window.cancelAnimationFrame(
                            frame
                        );


                        frame =
                            null;

                    }


                    resetTilt(
                        element
                    );

                }
            );

        }
    );

}


// ====================================================
// APLICAR TILT
// ====================================================

function applyTilt(
    element,
    x,
    y
) {

    const rotateY =
        (
            x -
            0.5
        ) *
        6;


    const rotateX =
        (
            0.5 -
            y
        ) *
        5;


    element.style.transform =
        `
            perspective(900px)
            rotateX(${rotateX}deg)
            rotateY(${rotateY}deg)
            translateZ(0)
        `;

}


// ====================================================
// RESTAURAR TILT
// ====================================================

function resetTilt(
    element
) {

    element.style.transform =
        '';

}


// ====================================================
// CÍRCULOS DE PROGRESO
//
// Esta funcionalidad sustituye:
//
// about-locations-progress.js
//
// Nuevo HTML:
//
// data-about-progress="76"
// data-about-progress-value
// ====================================================

function initProgressCircles(
    page
) {

    const elements =
        Array.from(
            page.querySelectorAll(
                PROGRESS_SELECTOR
            )
        );


    if (!elements.length) {
        return;
    }


    // ================================================
    // FALLBACK SIN INTERSECTION OBSERVER
    // ================================================

    if (
        !(
            'IntersectionObserver'
            in window
        )
    ) {

        elements.forEach(
            animateProgressCircle
        );


        return;
    }


    const observer =
        new IntersectionObserver(
            (
                entries,
                currentObserver
            ) => {

                entries.forEach(
                    (entry) => {

                        if (
                            !entry.isIntersecting
                        ) {
                            return;
                        }


                        animateProgressCircle(
                            entry.target
                        );


                        currentObserver.unobserve(
                            entry.target
                        );

                    }
                );

            },
            {
                threshold:
                    0.35
            }
        );


    elements.forEach(
        (element) => {

            observer.observe(
                element
            );

        }
    );

}


// ====================================================
// ANIMAR CÍRCULO DE PROGRESO
// ====================================================

function animateProgressCircle(
    element
) {

    // ================================================
    // EVITAR DOBLE ANIMACIÓN
    // ================================================

    if (
        element.dataset.aboutAnimated ===
        'true'
    ) {
        return;
    }


    const target =
        Number.parseFloat(
            element.dataset.aboutProgress
        );


    const valueElement =
        element.querySelector(
            PROGRESS_VALUE_SELECTOR
        );


    if (
        !Number.isFinite(
            target
        ) ||
        !valueElement
    ) {
        return;
    }


    element.dataset.aboutAnimated =
        'true';


    // ================================================
    // NORMALIZAR A 0 - 100
    // ================================================

    const safeTarget =
        clamp(
            target,
            0,
            100
        );


    const duration =
        1450;


    const finalDegrees =
        safeTarget *
        3.6;


    const startTime =
        performance.now();


    // ================================================
    // FRAME
    // ================================================

    function frame(
        currentTime
    ) {

        const elapsed =
            currentTime -
            startTime;


        const rawProgress =
            clamp(
                elapsed /
                duration,
                0,
                1
            );


        const eased =
            easeOutCubic(
                rawProgress
            );


        const currentValue =
            Math.round(
                safeTarget *
                eased
            );


        const currentDegrees =
            finalDegrees *
            eased;


        // ============================================
        // TEXTO
        // ============================================

        valueElement.textContent =
            `${currentValue}%`;


        // ============================================
        // CÍRCULO
        // ============================================

        element.style.setProperty(
            '--about-progress',
            `${currentDegrees}deg`
        );


        // ============================================
        // CONTINUAR
        // ============================================

        if (
            rawProgress <
            1
        ) {

            window.requestAnimationFrame(
                frame
            );

        }

    }


    window.requestAnimationFrame(
        frame
    );

}


// ====================================================
// MOSTRAR PÁGINA COMPLETA
//
// Utilizado cuando:
// prefers-reduced-motion: reduce
// ====================================================

function showCompleteAboutPage(
    page
) {

    // ================================================
    // REVEALS
    // ================================================

    page
        .querySelectorAll(
            REVEAL_SELECTOR
        )
        .forEach(
            (element) => {

                element.classList.add(
                    'is-visible'
                );


                element.style.transitionDelay =
                    '0ms';

            }
        );


    // ================================================
    // TIMELINE COMPLETO
    // ================================================

    const storyProgress =
        page.querySelector(
            STORY_PROGRESS_SELECTOR
        );


    if (
        storyProgress
    ) {

        storyProgress.style.transform =
            'scaleY(1)';

    }


    page
        .querySelectorAll(
            STORY_ITEM_SELECTOR
        )
        .forEach(
            (item) => {

                item.classList.add(
                    'is-active'
                );

            }
        );


    // ================================================
    // HERO SIN PARALLAX
    // ================================================

    const hero =
        page.querySelector(
            HERO_SELECTOR
        );


    if (hero) {

        hero.style.setProperty(
            '--about-hero-parallax',
            '0px'
        );

    }


    // ================================================
    // CÍRCULOS COMPLETOS
    // ================================================

    page
        .querySelectorAll(
            PROGRESS_SELECTOR
        )
        .forEach(
            showCompleteProgressCircle
        );

}


// ====================================================
// MOSTRAR PROGRESO COMPLETO
// ====================================================

function showCompleteProgressCircle(
    element
) {

    const target =
        Number.parseFloat(
            element.dataset.aboutProgress
        );


    const valueElement =
        element.querySelector(
            PROGRESS_VALUE_SELECTOR
        );


    if (
        !Number.isFinite(
            target
        )
    ) {
        return;
    }


    const safeTarget =
        clamp(
            target,
            0,
            100
        );


    element.dataset.aboutAnimated =
        'true';


    element.style.setProperty(
        '--about-progress',
        `${safeTarget * 3.6}deg`
    );


    if (
        valueElement
    ) {

        valueElement.textContent =
            `${Math.round(
                safeTarget
            )}%`;

    }

}


// ====================================================
// EASING
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
// CLAMP
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