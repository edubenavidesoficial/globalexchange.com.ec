// ====================================================
// FOREIGN FLAGS CAROUSEL
// Carruseles de banderas del programa idiomático
// ====================================================

export function initForeignFlagsCarousel() {
    const carousels = document.querySelectorAll(
        '[data-flags-carousel]'
    );

    if (!carousels.length) {
        return;
    }

    carousels.forEach((carousel) => {
        createFlagsCarousel(carousel);
    });
}

function createFlagsCarousel(carousel) {
    const track = carousel.querySelector(
        '[data-flags-track]'
    );

    const slides = Array.from(
        carousel.querySelectorAll(
            '.foreign-flags-carousel__slide'
        )
    );

    const previousButton = carousel.querySelector(
        '[data-flags-previous]'
    );

    const nextButton = carousel.querySelector(
        '[data-flags-next]'
    );

    const dotsContainer = carousel.querySelector(
        '[data-flags-dots]'
    );

    if (
        !track ||
        !slides.length ||
        !previousButton ||
        !nextButton ||
        !dotsContainer
    ) {
        return;
    }

    let currentIndex = 0;
    let visibleSlides = getVisibleSlides();
    let autoplayId = null;
    let resizeTimeout = null;

    const reduceMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
    ).matches;

    function getConfiguredNumber(attribute, fallback) {
        const value = Number(
            carousel.dataset[attribute]
        );

        return Number.isFinite(value) && value > 0
            ? value
            : fallback;
    }

    function getVisibleSlides() {
        if (window.innerWidth <= 600) {
            return getConfiguredNumber(
                'mobileVisible',
                1
            );
        }

        if (window.innerWidth <= 900) {
            return getConfiguredNumber(
                'tabletVisible',
                2
            );
        }

        return getConfiguredNumber(
            'desktopVisible',
            4
        );
    }

    function getMaximumIndex() {
        return Math.max(
            0,
            slides.length - visibleSlides
        );
    }

    function applySlideWidth() {
        const width = 100 / visibleSlides;

        carousel.style.setProperty(
            '--flags-slide-width',
            `${width}%`
        );
    }

    function createDots() {
        dotsContainer.innerHTML = '';

        const positions =
            getMaximumIndex() + 1;

        if (positions <= 1) {
            dotsContainer.hidden = true;
            return;
        }

        dotsContainer.hidden = false;

        for (
            let index = 0;
            index < positions;
            index += 1
        ) {
            const dot = document.createElement(
                'button'
            );

            dot.type = 'button';

            dot.className =
                'foreign-flags-carousel__dot';

            dot.setAttribute(
                'aria-label',
                `Mostrar posición ${index + 1}`
            );

            dot.addEventListener('click', () => {
                currentIndex = index;

                updateCarousel();
                restartAutoplay();
            });

            dotsContainer.appendChild(dot);
        }
    }

    function updateCarousel() {
        const maximumIndex =
            getMaximumIndex();

        if (currentIndex > maximumIndex) {
            currentIndex = maximumIndex;
        }

        if (currentIndex < 0) {
            currentIndex = 0;
        }

        const movement =
            currentIndex *
            (100 / visibleSlides);

        track.style.transform =
            `translate3d(-${movement}%, 0, 0)`;

        const dots =
            dotsContainer.querySelectorAll(
                '.foreign-flags-carousel__dot'
            );

        dots.forEach((dot, index) => {
            const isActive =
                index === currentIndex;

            dot.classList.toggle(
                'is-active',
                isActive
            );

            if (isActive) {
                dot.setAttribute(
                    'aria-current',
                    'true'
                );
            } else {
                dot.removeAttribute(
                    'aria-current'
                );
            }
        });
    }

    function showNext() {
        const maximumIndex =
            getMaximumIndex();

        currentIndex =
            currentIndex >= maximumIndex
                ? 0
                : currentIndex + 1;

        updateCarousel();
    }

    function showPrevious() {
        const maximumIndex =
            getMaximumIndex();

        currentIndex =
            currentIndex <= 0
                ? maximumIndex
                : currentIndex - 1;

        updateCarousel();
    }

    function stopAutoplay() {
        if (autoplayId === null) {
            return;
        }

        window.clearInterval(autoplayId);
        autoplayId = null;
    }

    function startAutoplay() {
        if (
            reduceMotion ||
            getMaximumIndex() === 0
        ) {
            return;
        }

        stopAutoplay();

        autoplayId = window.setInterval(
            showNext,
            5000
        );
    }

    function restartAutoplay() {
        stopAutoplay();
        startAutoplay();
    }

    previousButton.addEventListener(
        'click',
        () => {
            showPrevious();
            restartAutoplay();
        }
    );

    nextButton.addEventListener(
        'click',
        () => {
            showNext();
            restartAutoplay();
        }
    );

    carousel.addEventListener(
        'mouseenter',
        stopAutoplay
    );

    carousel.addEventListener(
        'mouseleave',
        startAutoplay
    );

    carousel.addEventListener(
        'focusin',
        stopAutoplay
    );

    carousel.addEventListener(
        'focusout',
        startAutoplay
    );

    window.addEventListener('resize', () => {
        window.clearTimeout(resizeTimeout);

        resizeTimeout = window.setTimeout(
            () => {
                const updatedVisibleSlides =
                    getVisibleSlides();

                if (
                    updatedVisibleSlides ===
                    visibleSlides
                ) {
                    return;
                }

                visibleSlides =
                    updatedVisibleSlides;

                currentIndex = 0;

                applySlideWidth();
                createDots();
                updateCarousel();
                restartAutoplay();
            },
            150
        );
    });

    applySlideWidth();
    createDots();
    updateCarousel();
    startAutoplay();
}