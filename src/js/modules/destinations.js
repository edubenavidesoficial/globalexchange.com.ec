// ====================================================
// DESTINATIONS
//
// Archivo:
// src/js/modules/destinations.js
//
// Responsabilidades:
//
// - Duplicar grupos para marquee infinito.
// - Pausar cada fila de forma independiente.
// - Aplicar efecto 3D sutil.
// - Conectar destinos con Program Finder.
// - Leer destino desde la URL.
// - Respetar prefers-reduced-motion.
// ====================================================


// ====================================================
// INIT
// ====================================================

export function initDestinations() {

    const section =
        document.querySelector(
            '[data-destinations]'
        );


    if (!section) {
        return;
    }


    prepareDestinationRows(
        section
    );


    initDestinationSelection(
        section
    );


    initDestinationTilt(
        section
    );


    applyDestinationFromURL();

}


// ====================================================
// PREPARAR FILAS
// ====================================================

function prepareDestinationRows(
    section
) {

    const rows =
        section.querySelectorAll(
            '[data-destinations-row]'
        );


    rows.forEach(
        (row) => {

            const track =
                row.querySelector(
                    '[data-destinations-track]'
                );


            const originalGroup =
                track?.querySelector(
                    '[data-destinations-group]'
                );


            if (
                !track ||
                !originalGroup
            ) {
                return;
            }


            // ========================================
            // DUPLICADO PARA LOOP INFINITO
            // ========================================

            if (
                !track.querySelector(
                    '[data-destinations-clone]'
                )
            ) {

                const clone =
                    originalGroup.cloneNode(
                        true
                    );


                clone.removeAttribute(
                    'data-destinations-group'
                );


                clone.setAttribute(
                    'data-destinations-clone',
                    ''
                );


                clone.setAttribute(
                    'aria-hidden',
                    'true'
                );


                // Evitar elementos duplicados
                // en navegación mediante teclado.

                clone
                    .querySelectorAll(
                        'a, button, input, select, textarea'
                    )
                    .forEach(
                        (element) => {

                            element.tabIndex =
                                -1;

                        }
                    );


                track.appendChild(
                    clone
                );

            }


            // ========================================
            // PAUSA POR TARJETA
            // ========================================

            const cards =
                row.querySelectorAll(
                    '[data-destination-card]'
                );


            cards.forEach(
                (card) => {

                    card.addEventListener(
                        'pointerenter',
                        () => {

                            row.classList.add(
                                'is-paused'
                            );

                        }
                    );


                    card.addEventListener(
                        'pointerleave',
                        () => {

                            row.classList.remove(
                                'is-paused'
                            );

                        }
                    );


                    card.addEventListener(
                        'focus',
                        () => {

                            row.classList.add(
                                'is-paused'
                            );

                        }
                    );


                    card.addEventListener(
                        'blur',
                        () => {

                            window.requestAnimationFrame(
                                () => {

                                    if (
                                        !row.contains(
                                            document.activeElement
                                        )
                                    ) {

                                        row.classList.remove(
                                            'is-paused'
                                        );

                                    }

                                }
                            );

                        }
                    );

                }
            );

        }
    );

}


// ====================================================
// SELECCIÓN DE DESTINO
// ====================================================

function initDestinationSelection(
    section
) {

    const cards =
        section.querySelectorAll(
            '[data-destination-card]'
        );


    cards.forEach(
        (card) => {

            card.addEventListener(
                'click',
                (event) => {

                    const destination =
                        card.dataset.destination;


                    if (!destination) {
                        return;
                    }


                    const destinationField =
                        document.querySelector(
                            '#program-destination'
                        );


                    const finderForm =
                        document.querySelector(
                            '[data-program-finder-form]'
                        );


                    // =================================
                    // SI PROGRAM FINDER ESTÁ EN PÁGINA
                    // =================================

                    if (
                        destinationField &&
                        hasSelectOption(
                            destinationField,
                            destination
                        )
                    ) {

                        event.preventDefault();


                        destinationField.value =
                            destination;


                        destinationField.dispatchEvent(
                            new Event(
                                'change',
                                {
                                    bubbles:
                                        true
                                }
                            )
                        );


                        const scrollTarget =
                            finderForm ||
                            destinationField;


                        scrollTarget.scrollIntoView({

                            behavior:
                                prefersReducedMotion()
                                    ? 'auto'
                                    : 'smooth',

                            block:
                                'center'

                        });


                        window.setTimeout(
                            () => {

                                destinationField.focus({

                                    preventScroll:
                                        true

                                });

                            },
                            prefersReducedMotion()
                                ? 0
                                : 500
                        );


                        return;

                    }


                    // =================================
                    // FALLBACK
                    // =================================

                    const url =
                        new URL(
                            '/',
                            window.location.origin
                        );


                    url.searchParams.set(
                        'destination',
                        destination
                    );


                    url.hash =
                        'programas';


                    window.location.href =
                        url.toString();

                }
            );

        }
    );

}


// ====================================================
// VERIFICAR OPTION
// ====================================================

function hasSelectOption(
    select,
    value
) {

    return Array
        .from(
            select.options
        )
        .some(
            (option) =>

                option.value ===
                value
        );

}


// ====================================================
// LEER DESTINO DE URL
// ====================================================

function applyDestinationFromURL() {

    const parameters =
        new URLSearchParams(
            window.location.search
        );


    const destination =
        parameters.get(
            'destination'
        );


    if (!destination) {
        return;
    }


    const field =
        document.querySelector(
            '#program-destination'
        );


    if (
        !field ||
        !hasSelectOption(
            field,
            destination
        )
    ) {
        return;
    }


    field.value =
        destination;


    field.dispatchEvent(
        new Event(
            'change',
            {
                bubbles:
                    true
            }
        )
    );

}


// ====================================================
// EFECTO 3D SUTIL
// ====================================================

function initDestinationTilt(
    section
) {

    const supportsHover =
        window.matchMedia(
            '(hover: hover) and (pointer: fine)'
        ).matches;


    if (
        !supportsHover ||
        prefersReducedMotion()
    ) {
        return;
    }


    const cards =
        section.querySelectorAll(
            '[data-destination-card]'
        );


    cards.forEach(
        (card) => {

            card.addEventListener(
                'pointermove',
                (event) => {

                    const rectangle =
                        card.getBoundingClientRect();


                    const x =
                        (
                            event.clientX -
                            rectangle.left
                        ) /
                        rectangle.width;


                    const y =
                        (
                            event.clientY -
                            rectangle.top
                        ) /
                        rectangle.height;


                    const rotateY =
                        (
                            x -
                            0.5
                        ) * 4;


                    const rotateX =
                        (
                            0.5 -
                            y
                        ) * 3;


                    card.style.setProperty(
                        '--destination-rotate-x',
                        `${rotateX}deg`
                    );


                    card.style.setProperty(
                        '--destination-rotate-y',
                        `${rotateY}deg`
                    );

                }
            );


            card.addEventListener(
                'pointerleave',
                () => {

                    resetDestinationTilt(
                        card
                    );

                }
            );

        }
    );

}


// ====================================================
// RESET TILT
// ====================================================

function resetDestinationTilt(
    card
) {

    card.style.setProperty(
        '--destination-rotate-x',
        '0deg'
    );


    card.style.setProperty(
        '--destination-rotate-y',
        '0deg'
    );

}


// ====================================================
// REDUCED MOTION
// ====================================================

function prefersReducedMotion() {

    return window.matchMedia(
        '(prefers-reduced-motion: reduce)'
    ).matches;

}