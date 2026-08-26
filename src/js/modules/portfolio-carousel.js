// ====================================================
// PORTFOLIO CAROUSEL
// Carrusel propio para la sección Portfolio
// ====================================================

export function initPortfolioCarousel() {

    const carousel = document.querySelector(
        '[data-portfolio-carousel]'
    );

    if (!carousel) {
        return;
    }


    const track = carousel.querySelector(
        '.portfolio__track'
    );


    const slides = Array.from(
        carousel.querySelectorAll(
            '.portfolio__slide'
        )
    );


    const dots = Array.from(
        carousel.querySelectorAll(
            '[data-carousel-dot]'
        )
    );


    if (!track || slides.length === 0) {
        return;
    }


    let currentIndex = 0;


    // =================================================
    // DIAPOSITIVAS VISIBLES
    // =================================================

    function getVisibleSlides() {

        const width = window.innerWidth;


        if (width <= 600) {
            return 1;
        }


        if (width <= 900) {
            return 2;
        }


        return 3;
    }


    // =================================================
    // ÍNDICE MÁXIMO
    // =================================================

    function getMaxIndex() {

        return Math.max(
            0,
            slides.length -
            getVisibleSlides()
        );
    }


    // =================================================
    // ACTUALIZAR PUNTOS
    // =================================================

    function updateDots() {

        dots.forEach(
            (dot, index) => {

                const isActive =
                    index === currentIndex;


                dot.classList.toggle(
                    'is-active',
                    isActive
                );


                dot.setAttribute(
                    'aria-selected',
                    String(isActive)
                );

            }
        );
    }


    // =================================================
    // ACTUALIZAR CARRUSEL
    // =================================================

    function updateCarousel() {

        const visibleSlides =
            getVisibleSlides();


        const gap = 20;


        const viewport =
            carousel.querySelector(
                '.portfolio__viewport'
            );


        if (!viewport) {
            return;
        }


        const slideWidth =
            (
                viewport.clientWidth -
                gap * (visibleSlides - 1)
            ) /
            visibleSlides;


        currentIndex =
            Math.min(
                currentIndex,
                getMaxIndex()
            );


        const offset =
            currentIndex *
            (slideWidth + gap);


        track.style.transform =
            `translateX(-${offset}px)`;


        updateDots();
    }


    // =================================================
    // EVENTOS DE LOS PUNTOS
    // =================================================

    dots.forEach((dot) => {

        dot.addEventListener(
            'click',
            () => {

                const requestedIndex =
                    Number(
                        dot.dataset.carouselDot
                    );


                if (
                    !Number.isFinite(
                        requestedIndex
                    )
                ) {
                    return;
                }


                currentIndex =
                    Math.min(
                        requestedIndex,
                        getMaxIndex()
                    );


                updateCarousel();

            }
        );

    });


    // =================================================
    // RESPONSIVE
    // =================================================

    window.addEventListener(
        'resize',
        updateCarousel
    );


    // =================================================
    // ESTADO INICIAL
    // =================================================

    updateCarousel();
}