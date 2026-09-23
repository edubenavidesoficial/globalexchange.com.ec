// ====================================================
// TESTIMONIALS PAGE
//
// Responsabilidades:
// - Reveal al hacer scroll.
// - Movimiento del hero mediante CSS compartido.
// - Tilt 3D suave en videos.
// - Lightbox de la galería.
// - Accesibilidad.
// - Movimiento reducido.
// ====================================================


const PAGE_SELECTOR =
    '.testimonials-page';


const REVEAL_SELECTOR =
    '[data-testimonials-reveal]';


const TILT_SELECTOR =
    '[data-testimonials-tilt]';


const GALLERY_ITEM_SELECTOR =
    '[data-testimonials-gallery-item]';


const LIGHTBOX_SELECTOR =
    '[data-testimonials-lightbox]';


const LIGHTBOX_IMAGE_SELECTOR =
    '[data-testimonials-lightbox-image]';


const LIGHTBOX_CLOSE_SELECTOR =
    '[data-testimonials-lightbox-close]';


// ====================================================
// INIT
// ====================================================

export function initTestimonialsPage() {

    const page =
        document.querySelector(
            PAGE_SELECTOR
        );


    if (!page) {
        return;
    }


    const reducedMotion =
        window.matchMedia(
            '(prefers-reduced-motion: reduce)'
        ).matches;


    initGalleryCarousel(page);

    initLightbox(
        page
    );


    if (reducedMotion) {

        showAllReveals(
            page
        );

        return;
    }


    initReveals(
        page
    );


    // Hero motion is handled by the shared CSS system (no scroll listener).


    initTilt(
        page
    );

}


// ====================================================
// REVEALS
// ====================================================

function initReveals(
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

        showAllReveals(
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
                threshold: 0.12,

                rootMargin:
                    '0px 0px -7% 0px'
            }
        );


    elements.forEach(
        (
            element,
            index
        ) => {

            element.style.transitionDelay =
                `${(index % 3) * 65}ms`;


            observer.observe(
                element
            );

        }
    );

}


// ====================================================
// SHOW ALL
// ====================================================

function showAllReveals(
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
// TILT
// ====================================================

function initTilt(
    page
) {

    const elements =
        page.querySelectorAll(
            TILT_SELECTOR
        );


    elements.forEach(
        (element) => {

            let frame =
                null;


            element.addEventListener(
                'pointermove',
                (event) => {

                    if (
                        event.pointerType ===
                        'touch'
                    ) {
                        return;
                    }


                    const rectangle =
                        element.getBoundingClientRect();


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


                    if (
                        frame !==
                        null
                    ) {
                        return;
                    }


                    frame =
                        window.requestAnimationFrame(
                            () => {

                                frame = null;


                                const rotateY =
                                    (x - 0.5) * 4;


                                const rotateX =
                                    (0.5 - y) * 3.5;


                                element.style.transform =
                                    `
                                        perspective(1000px)
                                        rotateX(${rotateX}deg)
                                        rotateY(${rotateY}deg)
                                    `;

                            }
                        );

                }
            );


            element.addEventListener(
                'pointerleave',
                () => {

                    if (
                        frame !==
                        null
                    ) {

                        cancelAnimationFrame(
                            frame
                        );


                        frame = null;

                    }


                    element.style.transform =
                        '';

                }
            );

        }
    );

}


// ====================================================
// LIGHTBOX
// ====================================================

function initLightbox(
    page
) {

    const items =
        Array.from(
            page.querySelectorAll(
                GALLERY_ITEM_SELECTOR
            )
        );


    const lightbox =
        page.querySelector(
            LIGHTBOX_SELECTOR
        );


    const image =
        lightbox?.querySelector(
            LIGHTBOX_IMAGE_SELECTOR
        );


    if (
        !items.length ||
        !lightbox ||
        !image
    ) {
        return;
    }


    let lastFocusedElement =
        null;


    items.forEach(
        (item) => {

            item.addEventListener(
                'click',
                (event) => {

                    event.preventDefault();


                    const itemImage =
                        item.querySelector(
                            'img'
                        );


                    lastFocusedElement =
                        item;


                    image.src =
                        item.getAttribute(
                            'href'
                        ) ?? '';


                    image.alt =
                        itemImage?.alt ?? '';


                    lightbox.classList.add(
                        'is-open'
                    );


                    lightbox.setAttribute(
                        'aria-hidden',
                        'false'
                    );


                    document.body.classList.add(
                        'testimonials-lightbox-open'
                    );


                    const closeButton =
                        lightbox.querySelector(
                            '.testimonials-lightbox__close'
                        );


                    page.dispatchEvent(new CustomEvent('testimonials:lightbox', { detail: { open: true } }));
                    closeButton?.focus();

                }
            );

        }
    );


    lightbox
        .querySelectorAll(
            LIGHTBOX_CLOSE_SELECTOR
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    'click',
                    () => {

                        closeLightbox(
                            lightbox,
                            image,
                            lastFocusedElement
                        );

                    }
                );

            }
        );


    document.addEventListener(
        'keydown',
        (event) => {

            if (
                event.key !==
                'Escape' ||
                !lightbox.classList.contains(
                    'is-open'
                )
            ) {
                return;
            }


            closeLightbox(
                lightbox,
                image,
                lastFocusedElement
            );

        }
    );

}


// ====================================================
// CLOSE LIGHTBOX
// ====================================================

function closeLightbox(
    lightbox,
    image,
    lastFocusedElement
) {

    lightbox.classList.remove(
        'is-open'
    );


    lightbox.setAttribute(
        'aria-hidden',
        'true'
    );


    document.body.classList.remove(
        'testimonials-lightbox-open'
    );


    window.setTimeout(
        () => {

            image.src =
                '';

        },
        250
    );


    lightbox.closest(PAGE_SELECTOR)?.dispatchEvent(
        new CustomEvent('testimonials:lightbox', { detail: { open: false } })
    );
    lastFocusedElement?.focus();

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

// Circular positions keep the original links and lightbox listeners intact.
function initGalleryCarousel(page) {
    const carousel = page.querySelector('[data-testimonials-carousel]');
    if (!carousel || carousel.dataset.initialized) return;
    const slides = [...carousel.querySelectorAll(GALLERY_ITEM_SELECTOR)];
    if (slides.length < 2) return;
    carousel.dataset.initialized = 'true';
    const viewport = carousel.querySelector('.testimonials-gallery__viewport');
    const dotsContainer = carousel.querySelector('[data-gallery-dots]');
    const pauseButton = carousel.querySelector('[data-gallery-pause]');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const interval = 5000;
    let currentIndex = 0;
    let autoplayTimer;
    let isHovering = carousel.matches(':hover');
    let isFocused = carousel.contains(document.activeElement);
    let isVisible = !('IntersectionObserver' in window);
    let isPaused = false;
    let lightboxOpen = false;
    let pointer = null;
    let suppressClick = false;
    let lastMove = 0;
    const slots = new Map();
    const modulo = value => (value + slides.length) % slides.length;
    const dots = slides.map((slide, index) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'testimonials-gallery__dot';
        dot.setAttribute('aria-label', `Ir al testimonio ${index + 1}`);
        dot.addEventListener('click', () => goToSlide(index));
        dotsContainer.append(dot);
        slide.querySelector('img').draggable = false;
        return dot;
    });

    function stopAutoplay() {
        window.clearTimeout(autoplayTimer);
        autoplayTimer = undefined;
    }

    function startAutoplay() {
        stopAutoplay();
        if (motion.matches || !isVisible || isHovering || isFocused || isPaused ||
            pointer || lightboxOpen || document.visibilityState !== 'visible') return;
        autoplayTimer = window.setTimeout(() => goToSlide(modulo(currentIndex + 1)), interval);
    }

    function updateCarousel() {
        slides.forEach((slide, index) => {
            let slot = modulo(index - currentIndex);
            if (slot > Math.floor(slides.length / 2)) slot -= slides.length;
            // Only teleport cards crossing the far, clipped edge of the ring.
            const wrapped = slots.has(slide) && Math.abs(slot - slots.get(slide)) > slides.length / 2;
            slide.style.transition = wrapped ? 'none' : '';
            slide.style.setProperty('--gallery-slot', slot);
            slide.classList.toggle('is-active', slot === 0);
            slide.tabIndex = slot === 0 ? 0 : -1;
            slide.setAttribute('aria-hidden', String(slot !== 0));
            slots.set(slide, slot);
            dots[index].setAttribute('aria-current', String(slot === 0));
        });
    }

    function goToSlide(index) {
        // Avoid interrupting a circular transition with rapid repeated input.
        if (!motion.matches && performance.now() - lastMove < 700) return;
        lastMove = performance.now();
        currentIndex = index;
        updateCarousel();
        startAutoplay();
    }

    carousel.querySelector('[data-gallery-prev]').addEventListener('click', () => goToSlide(modulo(currentIndex - 1)));
    carousel.querySelector('[data-gallery-next]').addEventListener('click', () => goToSlide(modulo(currentIndex + 1)));
    pauseButton.addEventListener('click', () => {
        isPaused = !isPaused;
        pauseButton.setAttribute('aria-pressed', String(isPaused));
        pauseButton.setAttribute('aria-label', isPaused ? 'Reanudar carrusel' : 'Pausar carrusel');
        pauseButton.textContent = isPaused ? '▶' : 'Ⅱ';
        startAutoplay();
    });
    carousel.addEventListener('mouseenter', () => { isHovering = true; stopAutoplay(); });
    carousel.addEventListener('mouseleave', () => { isHovering = false; startAutoplay(); });
    carousel.addEventListener('focusin', event => {
        isFocused = true;
        stopAutoplay();
        const index = slides.indexOf(event.target);
        if (index >= 0 && index !== currentIndex) goToSlide(index);
    });
    carousel.addEventListener('focusout', event => {
        isFocused = carousel.contains(event.relatedTarget);
        startAutoplay();
    });
    carousel.addEventListener('keydown', event => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const wasSlide = slides.includes(document.activeElement);
        goToSlide(modulo(currentIndex + (event.key === 'ArrowRight' ? 1 : -1)));
        if (wasSlide) slides[currentIndex].focus({ preventScroll: true });
    });
    viewport.addEventListener('dragstart', event => event.preventDefault());
    viewport.addEventListener('pointerdown', event => {
        if (!event.isPrimary || event.button !== 0) return;
        suppressClick = false;
        pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
        stopAutoplay();
    });
    window.addEventListener('pointerup', event => {
        if (!pointer || pointer.id !== event.pointerId) return;
        const dx = event.clientX - pointer.x;
        const dy = event.clientY - pointer.y;
        pointer = null;
        if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy)) {
            suppressClick = true;
            goToSlide(modulo(currentIndex + (dx < 0 ? 1 : -1)));
        }
        startAutoplay();
    });
    window.addEventListener('pointercancel', () => { pointer = null; startAutoplay(); });
    viewport.addEventListener('click', event => {
        if (suppressClick) {
            event.preventDefault();
            event.stopPropagation();
            suppressClick = false;
        }
    }, true);
    page.addEventListener('testimonials:lightbox', event => {
        lightboxOpen = event.detail.open;
        startAutoplay();
    });
    document.addEventListener('visibilitychange', () => {
        pointer = null;
        startAutoplay();
    });
    motion.addEventListener('change', () => {
        pauseButton.disabled = motion.matches;
        startAutoplay();
    });
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(([entry]) => {
            isVisible = entry.isIntersecting;
            startAutoplay();
        }, { threshold: 0 });
        observer.observe(viewport);
    }
    pauseButton.disabled = motion.matches;
    carousel.classList.add('is-ready');
    updateCarousel();
    startAutoplay();
}
