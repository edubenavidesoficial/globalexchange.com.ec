// ====================================================
// FAQ PAGE
//
// Archivo:
// src/js/modules/faq-accordion.js
//
// Responsabilidades:
// - Acordeón de preguntas.
// - Búsqueda.
// - Contador de resultados.
// - Estado sin resultados.
// - Animaciones reveal.
// - Parallax suave del hero.
// - Accesibilidad.
// - Movimiento reducido.
//
// Se conserva el nombre y export original para evitar
// cambios innecesarios en main.js.
// ====================================================


// ====================================================
// SELECTORES
// ====================================================

const ITEM_SELECTOR =
    '[data-faq-item]';


const QUESTION_SELECTOR =
    '.faq-questions__question';


const ANSWER_SELECTOR =
    '.faq-questions__answer';


const QUESTION_TEXT_SELECTOR =
    '.faq-questions__question-text';


const SEARCH_SELECTOR =
    '[data-faq-search]';


const CLEAR_SELECTOR =
    '[data-faq-clear]';


const COUNT_SELECTOR =
    '[data-faq-visible-count]';


const EMPTY_SELECTOR =
    '[data-faq-empty]';


const REVEAL_SELECTOR =
    '[data-faq-reveal]';


const HERO_SELECTOR =
    '[data-faq-hero]';


// ====================================================
// INICIALIZACIÓN
// ====================================================

export function initFaqAccordion() {

    const page =
        document.querySelector(
            '.faq-page'
        );


    if (!page) {
        return;
    }


    const items =
        Array.from(
            page.querySelectorAll(
                ITEM_SELECTOR
            )
        );


    if (!items.length) {
        return;
    }


    const reducedMotion =
        window.matchMedia(
            '(prefers-reduced-motion: reduce)'
        );


    initAccordion(
        items
    );


    initFaqSearch(
        page,
        items
    );


    if (
        reducedMotion.matches
    ) {

        showAllRevealElements(
            page
        );


        return;
    }


    initRevealAnimations(
        page
    );


    initHeroParallax(
        page
    );

}


// ====================================================
// ACCORDION
// ====================================================

function initAccordion(
    items
) {

    items.forEach(
        (item) => {

            const button =
                item.querySelector(
                    QUESTION_SELECTOR
                );


            const answer =
                item.querySelector(
                    ANSWER_SELECTOR
                );


            if (
                !button ||
                !answer
            ) {
                return;
            }


            syncAccordionAccessibility(
                item,
                button,
                answer
            );


            button.addEventListener(
                'click',
                () => {

                    const willOpen =
                        !item.classList.contains(
                            'is-open'
                        );


                    // =================================
                    // CERRAR TODAS
                    // =================================

                    items.forEach(
                        (currentItem) => {

                            closeItem(
                                currentItem
                            );

                        }
                    );


                    // =================================
                    // ABRIR SELECCIONADA
                    // =================================

                    if (willOpen) {

                        openItem(
                            item
                        );

                    }

                }
            );

        }
    );

}


// ====================================================
// ABRIR ITEM
// ====================================================

function openItem(
    item
) {

    const button =
        item.querySelector(
            QUESTION_SELECTOR
        );


    const answer =
        item.querySelector(
            ANSWER_SELECTOR
        );


    item.classList.add(
        'is-open'
    );


    button?.setAttribute(
        'aria-expanded',
        'true'
    );


    answer?.setAttribute(
        'aria-hidden',
        'false'
    );

}


// ====================================================
// CERRAR ITEM
// ====================================================

function closeItem(
    item
) {

    const button =
        item.querySelector(
            QUESTION_SELECTOR
        );


    const answer =
        item.querySelector(
            ANSWER_SELECTOR
        );


    item.classList.remove(
        'is-open'
    );


    button?.setAttribute(
        'aria-expanded',
        'false'
    );


    answer?.setAttribute(
        'aria-hidden',
        'true'
    );

}


// ====================================================
// SINCRONIZAR ACCESIBILIDAD
// ====================================================

function syncAccordionAccessibility(
    item,
    button,
    answer
) {

    const open =
        item.classList.contains(
            'is-open'
        );


    button.setAttribute(
        'aria-expanded',
        String(open)
    );


    answer.setAttribute(
        'aria-hidden',
        String(!open)
    );

}


// ====================================================
// BÚSQUEDA
// ====================================================

function initFaqSearch(
    page,
    items
) {

    const input =
        page.querySelector(
            SEARCH_SELECTOR
        );


    const clearButton =
        page.querySelector(
            CLEAR_SELECTOR
        );


    const countElement =
        page.querySelector(
            COUNT_SELECTOR
        );


    const emptyElement =
        page.querySelector(
            EMPTY_SELECTOR
        );


    if (!input) {
        return;
    }


    function filterQuestions() {

        const query =
            normalizeText(
                input.value
            );


        let visibleItems =
            0;


        items.forEach(
            (item) => {

                const question =
                    item.querySelector(
                        QUESTION_TEXT_SELECTOR
                    );


                const answer =
                    item.querySelector(
                        ANSWER_SELECTOR
                    );


                const searchableText =
                    normalizeText(
                        `
                            ${question?.textContent ?? ''}
                            ${answer?.textContent ?? ''}
                        `
                    );


                const matches =
                    !query ||
                    searchableText.includes(
                        query
                    );


                item.classList.toggle(
                    'is-filtered-out',
                    !matches
                );


                if (matches) {

                    visibleItems += 1;

                } else {

                    closeItem(
                        item
                    );

                }

            }
        );


        // =============================================
        // CONTADOR
        // =============================================

        if (countElement) {

            countElement.textContent =
                String(
                    visibleItems
                );

        }


        // =============================================
        // ESTADO VACÍO
        // =============================================

        if (emptyElement) {

            emptyElement.hidden =
                visibleItems !== 0;

        }


        // =============================================
        // BOTÓN LIMPIAR
        // =============================================

        if (clearButton) {

            clearButton.hidden =
                input.value.length === 0;

        }

    }


    input.addEventListener(
        'input',
        filterQuestions
    );


    input.addEventListener(
        'keydown',
        (event) => {

            if (
                event.key !==
                'Escape'
            ) {
                return;
            }


            clearSearch(
                input,
                items,
                countElement,
                emptyElement,
                clearButton
            );

        }
    );


    clearButton?.addEventListener(
        'click',
        () => {

            clearSearch(
                input,
                items,
                countElement,
                emptyElement,
                clearButton
            );

        }
    );


    filterQuestions();

}


// ====================================================
// LIMPIAR BÚSQUEDA
// ====================================================

function clearSearch(
    input,
    items,
    countElement,
    emptyElement,
    clearButton
) {

    input.value =
        '';


    items.forEach(
        (item) => {

            item.classList.remove(
                'is-filtered-out'
            );

        }
    );


    if (countElement) {

        countElement.textContent =
            String(
                items.length
            );

    }


    if (emptyElement) {

        emptyElement.hidden =
            true;

    }


    if (clearButton) {

        clearButton.hidden =
            true;

    }


    input.focus();

}


// ====================================================
// NORMALIZACIÓN DE TEXTO
//
// Permite buscar:
//
// "como"
// "cómo"
//
// y obtener el mismo resultado.
// ====================================================

function normalizeText(
    value
) {

    return String(
        value
    )
        .normalize(
            'NFD'
        )
        .replace(
            /[\u0300-\u036f]/g,
            ''
        )
        .toLocaleLowerCase(
            'es'
        )
        .trim();

}


// ====================================================
// REVEAL
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


    if (
        !(
            'IntersectionObserver'
            in window
        )
    ) {

        showAllRevealElements(
            page
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


                        entry.target.classList.add(
                            'is-visible'
                        );


                        currentObserver.unobserve(
                            entry.target
                        );

                    }
                );

            },
            {
                threshold:
                    0.12,

                rootMargin:
                    '0px 0px -6% 0px'
            }
        );


    elements.forEach(
        (
            element,
            index
        ) => {

            const delay =
                (
                    index %
                    3
                ) *
                65;


            element.style.transitionDelay =
                `${delay}ms`;


            observer.observe(
                element
            );

        }
    );

}


// ====================================================
// MOSTRAR TODOS LOS REVEALS
// ====================================================

function showAllRevealElements(
    page
) {

    page
        .querySelectorAll(
            REVEAL_SELECTOR
        )
        .forEach(
            (element) => {

                element.style.transitionDelay =
                    '0ms';


                element.classList.add(
                    'is-visible'
                );

            }
        );

}


// ====================================================
// HERO PARALLAX
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
            passive: true
        }
    );


    window.addEventListener(
        'resize',
        requestUpdate,
        {
            passive: true
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


    if (
        rectangle.bottom <
        0
    ) {

        hero.style.setProperty(
            '--faq-hero-parallax',
            '38px'
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


    const movement =
        progress *
        38;


    hero.style.setProperty(
        '--faq-hero-parallax',
        `${movement}px`
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