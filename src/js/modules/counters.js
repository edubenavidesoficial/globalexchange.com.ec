// ====================================================
// COUNTERS
//
// Archivo:
// src/js/modules/counters.js
//
// Responsabilidad:
// - Animar los contadores de la sección Stats.
// - Formatear números según el idioma activo.
// - Actualizar el formato cuando cambia el idioma.
// ====================================================

import i18next from '../../languages/i18n.js';


// ====================================================
// CONFIGURACIÓN DE LOCALES
// ====================================================

const LOCALES = {

    es: 'es-EC',

    en: 'en-US',

    de: 'de-DE'

};


// ====================================================
// OBTENER LOCALE ACTUAL
// ====================================================

function getCurrentLocale() {

    const language =
        i18next.language || 'es';


    return LOCALES[language] || LOCALES.es;

}


// ====================================================
// FORMATEAR VALOR
// ====================================================

function formatCounterValue(
    value,
    useSeparator,
    suffix
) {

    const roundedValue =
        Math.round(value);


    let formattedValue =
        String(roundedValue);


    if (useSeparator) {

        const formatter =
            new Intl.NumberFormat(
                getCurrentLocale(),
                {
                    maximumFractionDigits: 0
                }
            );


        formattedValue =
            formatter.format(
                roundedValue
            );

    }


    return `${formattedValue}${suffix}`;

}


// ====================================================
// OBTENER CONFIGURACIÓN DEL CONTADOR
// ====================================================

function getCounterConfig(item) {

    return {

        start:
            Number(
                item.dataset.start ?? 0
            ),

        end:
            Number(
                item.dataset.end ?? 0
            ),

        duration:
            Number(
                item.dataset.duration ?? 900
            ),

        useSeparator:
            item.dataset.separator === 'true',

        suffix:
            item.dataset.suffix ?? ''

    };

}


// ====================================================
// MOSTRAR VALOR FINAL
// ====================================================

function renderFinalValue(item) {

    const numberElement =
        item.querySelector(
            '.stats__number'
        );


    if (!numberElement) {
        return;
    }


    const {
        end,
        useSeparator,
        suffix
    } = getCounterConfig(item);


    if (!Number.isFinite(end)) {
        return;
    }


    numberElement.textContent =
        formatCounterValue(
            end,
            useSeparator,
            suffix
        );

}


// ====================================================
// ANIMAR CONTADOR
// ====================================================

function animateCounter(item) {

    const numberElement =
        item.querySelector(
            '.stats__number'
        );


    if (!numberElement) {
        return;
    }


    const {
        start,
        end,
        duration,
        useSeparator,
        suffix
    } = getCounterConfig(item);


    if (
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        !Number.isFinite(duration)
    ) {
        return;
    }


    const prefersReducedMotion =
        window.matchMedia(
            '(prefers-reduced-motion: reduce)'
        ).matches;


    if (
        prefersReducedMotion ||
        duration <= 0
    ) {

        renderFinalValue(item);

        return;
    }


    const startTime =
        performance.now();


    // ================================================
    // ACTUALIZAR FOTOGRAMA
    // ================================================

    function updateCounter(currentTime) {

        const elapsed =
            currentTime - startTime;


        const progress =
            Math.min(
                elapsed / duration,
                1
            );


        const currentValue =
            start +
            (end - start) * progress;


        numberElement.textContent =
            formatCounterValue(
                currentValue,
                useSeparator,
                suffix
            );


        if (progress < 1) {

            window.requestAnimationFrame(
                updateCounter
            );

            return;
        }


        // ============================================
        // ASEGURAR VALOR FINAL EXACTO
        // ============================================

        renderFinalValue(item);

    }


    window.requestAnimationFrame(
        updateCounter
    );

}


// ====================================================
// ACTUALIZAR FORMATO AL CAMBIAR IDIOMA
// ====================================================

function updateCountersLanguage(
    counterItems
) {

    counterItems.forEach((item) => {

        /*
         * Solo actualizamos directamente los
         * contadores cuya animación ya comenzó.
         *
         * Si todavía no son visibles, seguirán
         * esperando al IntersectionObserver.
         */

        if (
            item.dataset.counterStarted !==
            'true'
        ) {
            return;
        }


        renderFinalValue(item);

    });

}


// ====================================================
// INICIALIZAR CONTADORES
// ====================================================

export function initCounters() {

    const counterItems =
        document.querySelectorAll(
            '[data-counter]'
        );


    if (!counterItems.length) {
        return;
    }


    // ================================================
    // CAMBIO DE IDIOMA
    // ================================================

    i18next.on(
        'languageChanged',
        () => {

            updateCountersLanguage(
                counterItems
            );

        }
    );


    // ================================================
    // FALLBACK SIN INTERSECTION OBSERVER
    // ================================================

    if (
        !(
            'IntersectionObserver'
            in window
        )
    ) {

        counterItems.forEach((item) => {

            item.dataset.counterStarted =
                'true';


            animateCounter(item);

        });


        return;
    }


    // ================================================
    // OBSERVADOR
    // ================================================

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


                        const item =
                            entry.target;


                        if (
                            item.dataset
                                .counterStarted ===
                            'true'
                        ) {

                            currentObserver
                                .unobserve(item);

                            return;
                        }


                        item.dataset
                            .counterStarted =
                            'true';


                        animateCounter(
                            item
                        );


                        currentObserver
                            .unobserve(item);

                    }
                );

            },

            {
                threshold: 0.35
            }

        );


    // ================================================
    // OBSERVAR CONTADORES
    // ================================================

    counterItems.forEach((item) => {

        observer.observe(item);

    });

}