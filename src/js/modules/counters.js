// ====================================================
// COUNTERS.JS
// Contadores animados para la sección Stats
// ====================================================

/**
 * Convierte un valor numérico en el formato solicitado.
 *
 * @param {number} value
 * @param {string} separator
 * @param {string} suffix
 * @returns {string}
 */
function formatCounterValue(value, separator, suffix) {
    const roundedValue = Math.round(value);

    let formattedValue = String(roundedValue);

    if (separator) {
        formattedValue = roundedValue.toLocaleString('en-US', {
            maximumFractionDigits: 0
        });
    }

    return `${formattedValue}${suffix}`;
}

/**
 * Anima un contador.
 *
 * @param {HTMLElement} item
 */
function animateCounter(item) {
    const numberElement = item.querySelector('.stats__number');

    if (!numberElement) {
        return;
    }

    const start = Number(item.dataset.start ?? 0);
    const end = Number(item.dataset.end ?? 0);
    const duration = Number(item.dataset.duration ?? 900);

    const separator = item.dataset.separator ?? '';
    const suffix = item.dataset.suffix ?? '';

    if (
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        !Number.isFinite(duration)
    ) {
        console.warn('⚠️ Configuración inválida en contador:', item);
        return;
    }

    const prefersReducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
    ).matches;

    if (prefersReducedMotion || duration <= 0) {
        numberElement.textContent = formatCounterValue(
            end,
            separator,
            suffix
        );

        return;
    }

    const startTime = performance.now();

    /**
     * Actualiza el valor en cada fotograma.
     *
     * @param {number} currentTime
     */
    function updateCounter(currentTime) {
        const elapsed = currentTime - startTime;

        const progress = Math.min(
            elapsed / duration,
            1
        );

        const currentValue =
            start + (end - start) * progress;

        numberElement.textContent = formatCounterValue(
            currentValue,
            separator,
            suffix
        );

        if (progress < 1) {
            window.requestAnimationFrame(updateCounter);
        }
    }

    window.requestAnimationFrame(updateCounter);
}

/**
 * Inicializa todos los contadores de la página.
 */
export function initCounters() {
    const counterItems = document.querySelectorAll(
        '[data-counter]'
    );

    if (!counterItems.length) {
        return;
    }

    if (!('IntersectionObserver' in window)) {
        counterItems.forEach((item) => {
            animateCounter(item);
        });

        return;
    }

    const observer = new IntersectionObserver(
        (entries, currentObserver) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) {
                    return;
                }

                const item = entry.target;

                if (item.dataset.counterStarted === 'true') {
                    currentObserver.unobserve(item);
                    return;
                }

                item.dataset.counterStarted = 'true';

                animateCounter(item);

                currentObserver.unobserve(item);
            });
        },
        {
            threshold: 0.35
        }
    );

    counterItems.forEach((item) => {
        observer.observe(item);
    });
}