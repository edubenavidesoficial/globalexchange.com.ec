// ====================================================
// TESTIMONIALS PAGE
//
// Responsabilidades:
// - Reveal al hacer scroll.
// - Parallax del hero.
// - Tilt 3D suave en videos.
// - Lightbox de la galería.
// - Accesibilidad.
// - Movimiento reducido.
// ====================================================


const PAGE_SELECTOR =
    '.testimonials-page';


const HERO_SELECTOR =
    '[data-testimonials-hero]';


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


    initHeroParallax(
        page
    );


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

                    frame = null;


                    const rectangle =
                        hero.getBoundingClientRect();


                    const height =
                        Math.max(
                            hero.offsetHeight,
                            1
                        );


                    const progress =
                        clamp(
                            -rectangle.top /
                            height,
                            0,
                            1
                        );


                    hero.style.setProperty(
                        '--testimonials-hero-parallax',
                        `${progress * 40}px`
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