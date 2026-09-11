// ====================================================
// MAP EXPERIENCE
//
// Archivo:
// src/js/modules/map-experience.js
//
// Responsabilidades:
//
// - Detectar cuándo la sección entra en pantalla.
// - Ejecutar animaciones de entrada.
// - Animar estadísticas.
// - Controlar ubicación activa.
// - Actualizar el panel.
// - Resaltar pins.
// - Animar rutas.
// - Autoplay entre ubicaciones.
// - Pausar autoplay durante interacción.
// - Respetar prefers-reduced-motion.
// ====================================================


// ====================================================
// DATOS DE UBICACIONES
// ====================================================

const MAP_LOCATIONS = {

    ecuador: {

        title:
            'Ecuador',

        description:
            'Programas locales y conexiones con experiencias internacionales desde Ecuador.',

        items: [
            'Opciones académicas y culturales dentro del país',
            'Conexión con destinos internacionales',
            'Acompañamiento personalizado durante tu proceso'
        ]

    },


    america: {

        title:
            'América',

        description:
            'Explora oportunidades educativas, culturales y de intercambio en diferentes destinos del continente americano.',

        items: [
            'Experiencias académicas y culturales',
            'Programas para diferentes perfiles',
            'Asesoría durante la planificación de tu experiencia'
        ]

    },


    europa: {

        title:
            'Europa',

        description:
            'Descubre programas de idiomas, escolaridad, educación superior y experiencias internacionales en Europa.',

        items: [
            'Programas de idiomas y formación internacional',
            'Opciones para jóvenes y adultos',
            'Experiencias académicas y culturales'
        ]

    },


    africa: {

        title:
            'África',

        description:
            'Descubre nuevas culturas y experiencias internacionales en una región llena de diversidad y oportunidades.',

        items: [
            'Experiencias culturales',
            'Alternativas internacionales',
            'Orientación personalizada antes de viajar'
        ]

    },


    asia: {

        title:
            'Asia',

        description:
            'Explora destinos dinámicos con oportunidades educativas, culturales y de inmersión internacional.',

        items: [
            'Experiencias culturales únicas',
            'Programas académicos internacionales',
            'Acompañamiento durante la planificación'
        ]

    },


    oceania: {

        title:
            'Oceanía',

        description:
            'Conoce destinos reconocidos internacionalmente por sus oportunidades educativas y calidad de vida.',

        items: [
            'Opciones académicas y de inmersión',
            'Experiencias internacionales',
            'Orientación para elegir el destino adecuado'
        ]

    }

};


// ====================================================
// INICIALIZACIÓN
// ====================================================

export function initMapExperience() {

    const section =
        document.querySelector(
            '[data-map-experience]'
        );


    if (!section) {
        return;
    }


    // ================================================
    // MOVIMIENTO REDUCIDO
    // ================================================

    const reducedMotion =
        window.matchMedia(
            '(prefers-reduced-motion: reduce)'
        );


    // ================================================
    // ELEMENTOS PRINCIPALES
    // ================================================

    const panel =
        section.querySelector(
            '.map__panel'
        );


    const title =
        section.querySelector(
            '[data-map-active-title]'
        );


    const description =
        section.querySelector(
            '[data-map-active-description]'
        );


    const list =
        section.querySelector(
            '[data-map-active-list]'
        );


    const pins =
        Array.from(
            section.querySelectorAll(
                '.map__pin[data-map-location]'
            )
        );


    const chips =
        Array.from(
            section.querySelectorAll(
                '.map__chip[data-map-location]'
            )
        );


    const routes =
        Array.from(
            section.querySelectorAll(
                '[data-map-route]'
            )
        );


    const stats =
        Array.from(
            section.querySelectorAll(
                '[data-map-stat]'
            )
        );


    // ================================================
    // ESTADO
    // ================================================

    const locationKeys =
        Object.keys(
            MAP_LOCATIONS
        );


    let currentIndex =
        0;


    let autoplayTimer =
        null;


    let statsAnimated =
        false;


    let sectionVisible =
        false;


    // ================================================
    // ESTADO INICIAL
    // ================================================

    setActiveLocation(
        'ecuador',
        false
    );


    // ================================================
    // OBSERVAR ENTRADA DE LA SECCIÓN
    // ================================================

    const observer =
        new IntersectionObserver(
            (entries) => {

                entries.forEach(
                    (entry) => {

                        if (
                            entry.isIntersecting
                        ) {

                            sectionVisible =
                                true;


                            section.classList.add(
                                'is-visible'
                            );


                            // =========================
                            // ESTADÍSTICAS
                            // =========================

                            if (
                                !statsAnimated
                            ) {

                                animateStats(
                                    stats,
                                    reducedMotion.matches
                                );


                                statsAnimated =
                                    true;

                            }


                            // =========================
                            // AUTOPLAY
                            // =========================

                            if (
                                !reducedMotion.matches
                            ) {

                                startAutoplay();

                            }

                        } else {

                            sectionVisible =
                                false;


                            stopAutoplay();

                        }

                    }
                );

            },
            {
                threshold:
                    0.18
            }
        );


    observer.observe(
        section
    );


    // ================================================
    // EVENTOS PINS
    // ================================================

    pins.forEach(
        (pin) => {

            bindLocationElement(
                pin
            );

        }
    );


    // ================================================
    // EVENTOS CHIPS
    // ================================================

    chips.forEach(
        (chip) => {

            bindLocationElement(
                chip
            );

        }
    );


    // ================================================
    // VINCULAR ELEMENTO
    // ================================================

    function bindLocationElement(
        element
    ) {

        const activate =
            () => {

                const key =
                    element.dataset.mapLocation;


                if (!key) {
                    return;
                }


                setActiveLocation(
                    key,
                    true
                );


                stopAutoplay();

            };


        element.addEventListener(
            'mouseenter',
            activate
        );


        element.addEventListener(
            'focus',
            activate
        );


        element.addEventListener(
            'click',
            activate
        );

    }


    // ================================================
    // REANUDAR AL SALIR DEL COMPONENTE
    // ================================================

    section.addEventListener(
        'mouseleave',
        () => {

            if (
                sectionVisible &&
                !reducedMotion.matches
            ) {

                startAutoplay();

            }

        }
    );


    // ================================================
    // REANUDAR AL PERDER EL FOCO
    // ================================================

    section.addEventListener(
        'focusout',
        () => {

            window.setTimeout(
                () => {

                    if (
                        sectionVisible &&
                        !section.contains(
                            document.activeElement
                        ) &&
                        !reducedMotion.matches
                    ) {

                        startAutoplay();

                    }

                },
                80
            );

        }
    );


    // ================================================
    // CAMBIO DE PREFERENCIA DE MOVIMIENTO
    // ================================================

    reducedMotion.addEventListener?.(
        'change',
        (event) => {

            if (
                event.matches
            ) {

                stopAutoplay();

                return;

            }


            if (
                sectionVisible
            ) {

                startAutoplay();

            }

        }
    );


    // ================================================
    // ACTIVAR UBICACIÓN
    // ================================================

    function setActiveLocation(
        key,
        animatePanel = true
    ) {

        const location =
            MAP_LOCATIONS[key];


        if (!location) {
            return;
        }


        const foundIndex =
            locationKeys.indexOf(
                key
            );


        if (
            foundIndex >=
            0
        ) {

            currentIndex =
                foundIndex;

        }


        // ============================================
        // PINS
        // ============================================

        pins.forEach(
            (pin) => {

                const active =
                    pin.dataset.mapLocation ===
                    key;


                pin.classList.toggle(
                    'is-active',
                    active
                );


                pin.setAttribute(
                    'aria-pressed',
                    String(active)
                );

            }
        );


        // ============================================
        // CHIPS
        // ============================================

        chips.forEach(
            (chip) => {

                const active =
                    chip.dataset.mapLocation ===
                    key;


                chip.classList.toggle(
                    'is-active',
                    active
                );


                chip.setAttribute(
                    'aria-pressed',
                    String(active)
                );

            }
        );


        // ============================================
        // RUTAS
        //
        // Ecuador funciona como punto de origen.
        // Por eso no necesita una ruta independiente.
        // ============================================

        routes.forEach(
            (route) => {

                route.classList.toggle(
                    'is-active',
                    route.dataset.mapRoute ===
                    key
                );

            }
        );


        // ============================================
        // PANEL
        // ============================================

        if (
            animatePanel &&
            panel &&
            !reducedMotion.matches
        ) {

            panel.classList.add(
                'is-changing'
            );


            window.setTimeout(
                () => {

                    updatePanel(
                        location
                    );


                    panel.classList.remove(
                        'is-changing'
                    );

                },
                150
            );


            return;

        }


        updatePanel(
            location
        );

    }


    // ================================================
    // ACTUALIZAR PANEL
    // ================================================

    function updatePanel(
        location
    ) {

        if (title) {

            title.textContent =
                location.title;

        }


        if (description) {

            description.textContent =
                location.description;

        }


        renderList(
            location.items
        );

    }


    // ================================================
    // LISTA
    // ================================================

    function renderList(
        items
    ) {

        if (!list) {
            return;
        }


        list.replaceChildren();


        items.forEach(
            (item) => {

                const li =
                    document.createElement(
                        'li'
                    );


                li.textContent =
                    item;


                list.appendChild(
                    li
                );

            }
        );

    }


    // ================================================
    // SIGUIENTE DESTINO
    // ================================================

    function nextLocation() {

        currentIndex =
            (
                currentIndex +
                1
            ) %
            locationKeys.length;


        setActiveLocation(
            locationKeys[
            currentIndex
            ],
            true
        );

    }


    // ================================================
    // INICIAR AUTOPLAY
    // ================================================

    function startAutoplay() {

        stopAutoplay();


        if (
            reducedMotion.matches ||
            !sectionVisible
        ) {
            return;
        }


        autoplayTimer =
            window.setInterval(
                nextLocation,
                4200
            );

    }


    // ================================================
    // DETENER AUTOPLAY
    // ================================================

    function stopAutoplay() {

        if (
            autoplayTimer ===
            null
        ) {
            return;
        }


        window.clearInterval(
            autoplayTimer
        );


        autoplayTimer =
            null;

    }

}


// ====================================================
// ANIMAR ESTADÍSTICAS
// ====================================================

function animateStats(
    elements,
    reducedMotion
) {

    elements.forEach(
        (element) => {

            const target =
                Number.parseInt(
                    element.dataset.mapStatTarget,
                    10
                );


            if (
                !Number.isFinite(
                    target
                )
            ) {
                return;
            }


            // ========================================
            // MOVIMIENTO REDUCIDO
            // ========================================

            if (
                reducedMotion
            ) {

                element.textContent =
                    formatStat(
                        target
                    );


                return;

            }


            const duration =
                target >= 1000
                    ? 1300
                    : 1000;


            const startTime =
                performance.now();


            function frame(
                currentTime
            ) {

                const elapsed =
                    currentTime -
                    startTime;


                const progress =
                    clamp(
                        elapsed /
                        duration,
                        0,
                        1
                    );


                const eased =
                    easeOutCubic(
                        progress
                    );


                const value =
                    Math.round(
                        target *
                        eased
                    );


                element.textContent =
                    formatStat(
                        value
                    );


                if (
                    progress <
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
    );

}


// ====================================================
// FORMATEAR ESTADÍSTICA
// ====================================================

function formatStat(
    value
) {

    return new Intl.NumberFormat(
        'es-EC'
    ).format(
        value
    );

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