// ====================================================
// ABOUT LOCATIONS PROGRESS
// Animación de porcentajes de la sección Sedes
// ====================================================

export function initAboutLocationsProgress() {
    const progressElements = document.querySelectorAll(
        '.about-locations__progress[data-progress]'
    );

    if (!progressElements.length) {
        return;
    }

    const reduceMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
    ).matches;

    function animateProgress(element) {
        if (element.dataset.animated === 'true') {
            return;
        }

        element.dataset.animated = 'true';

        const target = Number(element.dataset.progress);
        const valueElement = element.querySelector(
            '.about-locations__progress-value'
        );

        if (!Number.isFinite(target) || !valueElement) {
            return;
        }

        const finalDegrees = target * 3.6;

        if (reduceMotion) {
            valueElement.textContent = `${target}%`;
            element.style.setProperty(
                '--progress',
                `${finalDegrees}deg`
            );
            return;
        }

        const duration = 1600;
        const startTime = performance.now();

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const rawProgress = Math.min(elapsed / duration, 1);

            const easedProgress =
                1 - Math.pow(1 - rawProgress, 3);

            const currentValue = Math.round(
                target * easedProgress
            );

            const currentDegrees =
                finalDegrees * easedProgress;

            valueElement.textContent = `${currentValue}%`;

            element.style.setProperty(
                '--progress',
                `${currentDegrees}deg`
            );

            if (rawProgress < 1) {
                requestAnimationFrame(update);
            }
        }

        requestAnimationFrame(update);
    }

    const observer = new IntersectionObserver(
        (entries, currentObserver) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) {
                    return;
                }

                animateProgress(entry.target);
                currentObserver.unobserve(entry.target);
            });
        },
        {
            threshold: 0.35
        }
    );

    progressElements.forEach((element) => {
        observer.observe(element);
    });
}