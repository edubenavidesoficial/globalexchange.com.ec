// ====================================================
// SERVICES
//
// Global Exchange
//
// Funciones:
// - Carrusel vertical.
// - Autoplay de arriba hacia abajo.
// - Al llegar al final invierte la dirección.
// - Navegación manual.
// - Swipe vertical.
// - Resumen sincronizado.
// - Programa de interés.
// - Modalidad de asesoría.
// - Solicitud por WhatsApp.
// ====================================================


const WHATSAPP_NUMBER =
    '593983511575';


const AUTOPLAY_DELAY =
    5000;


/* ====================================================
   INIT
==================================================== */

export function initServices() {

    initServicesCarousel();

    initServicesConsultation();

}


/* ====================================================
   CARRUSEL
==================================================== */

function initServicesCarousel() {

    const carousel =
        document.querySelector(
            '[data-services-carousel]'
        );


    if (!carousel) {
        return;
    }


    const track =
        carousel.querySelector(
            '[data-services-track]'
        );


    const cards =
        Array.from(
            carousel.querySelectorAll(
                '[data-service-card]'
            )
        );


    const previousButton =
        document.querySelector(
            '[data-services-prev]'
        );


    const nextButton =
        document.querySelector(
            '[data-services-next]'
        );


    const currentIndicator =
        document.querySelector(
            '[data-services-current]'
        );


    const selectedServiceText =
        document.querySelector(
            '[data-selected-service]'
        );


    const selectedServiceInput =
        document.querySelector(
            '[data-selected-service-input]'
        );


    const summary =
        document.querySelector(
            '[data-services-summary]'
        );


    const summaryCounter =
        document.querySelector(
            '[data-services-summary-counter]'
        );


    const summaryTitle =
        document.querySelector(
            '[data-services-summary-title]'
        );


    const summaryDescription =
        document.querySelector(
            '[data-services-summary-description]'
        );


    const summaryFeatures =
        document.querySelector(
            '[data-services-summary-features]'
        );


    const summaryProgress =
        document.querySelector(
            '[data-services-summary-progress]'
        );


    const summaryProgressLabel =
        document.querySelector(
            '[data-services-summary-progress-label]'
        );


    if (
        !track ||
        cards.length === 0 ||
        !previousButton ||
        !nextButton
    ) {
        return;
    }


    const reducedMotion =
        window.matchMedia(
            '(prefers-reduced-motion: reduce)'
        );


    let currentIndex =
        0;


    let autoplayDirection =
        1;


    let autoplayId =
        null;


    let summaryTimer =
        null;


    let selectionLocked =
        false;


    /* ==================================================
       POSICIÓN
    ================================================== */

    function getCardOffset(index) {

        const card =
            cards[index];


        if (!card) {
            return 0;
        }


        const desiredTop =
            (
                carousel.clientHeight -
                card.offsetHeight
            ) / 2;


        return Math.max(
            0,
            card.offsetTop -
            desiredTop
        );

    }


    /* ==================================================
       SUMMARY
    ================================================== */

    function updateSummary(
        card,
        index
    ) {

        if (
            !summary ||
            !card
        ) {
            return;
        }


        const title =
            card
                .querySelector(
                    '.services-program-card__title'
                )
                ?.textContent
                .trim() || '';


        const description =
            card
                .querySelector(
                    '.services-program-card__description'
                )
                ?.textContent
                .trim() || '';


        const features =
            Array.from(
                card.querySelectorAll(
                    '.services-program-card__features span'
                )
            )
                .map(
                    (element) =>
                        element.textContent.trim()
                );


        const position =
            index + 1;


        const percentage =
            Math.round(
                (
                    position /
                    cards.length
                ) * 100
            );


        summary.classList.add(
            'is-updating'
        );


        if (summaryTimer) {

            window.clearTimeout(
                summaryTimer
            );

        }


        summaryTimer =
            window.setTimeout(
                () => {

                    if (summaryTitle) {

                        summaryTitle.textContent =
                            title;

                    }


                    if (summaryDescription) {

                        summaryDescription.textContent =
                            description;

                    }


                    if (summaryCounter) {

                        summaryCounter.textContent =
                            `${String(position).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}`;

                    }


                    if (summaryFeatures) {

                        summaryFeatures.innerHTML =
                            '';


                        features.forEach(
                            (feature) => {

                                const span =
                                    document.createElement(
                                        'span'
                                    );


                                span.textContent =
                                    feature;


                                summaryFeatures.appendChild(
                                    span
                                );

                            }
                        );

                    }


                    if (summaryProgress) {

                        summaryProgress.style.width =
                            `${percentage}%`;

                    }


                    if (summaryProgressLabel) {

                        summaryProgressLabel.textContent =
                            `${percentage}%`;

                    }


                    summary.classList.remove(
                        'is-updating'
                    );

                },
                reducedMotion.matches
                    ? 0
                    : 130
            );

    }


    /* ==================================================
       PROGRAMA DE INTERÉS
    ================================================== */

    function updateSelectedProgram(
        card
    ) {

        if (!card) {
            return;
        }


        const name =
            card.dataset.serviceName;


        if (!name) {
            return;
        }


        if (selectedServiceText) {

            selectedServiceText.textContent =
                name;

        }


        if (selectedServiceInput) {

            selectedServiceInput.value =
                name;

        }

    }


    /* ==================================================
       UPDATE
    ================================================== */

    function updateCarousel() {

        const activeCard =
            cards[currentIndex];


        const offset =
            getCardOffset(
                currentIndex
            );


        track.style.transform =
            `translate3d(0, -${offset}px, 0)`;


        cards.forEach(
            (card, index) => {

                const active =
                    index === currentIndex;


                card.classList.toggle(
                    'is-active',
                    active
                );


                card.setAttribute(
                    'aria-current',
                    active
                        ? 'true'
                        : 'false'
                );

            }
        );


        if (currentIndicator) {

            currentIndicator.textContent =
                String(
                    currentIndex + 1
                ).padStart(
                    2,
                    '0'
                );

        }


        updateSummary(
            activeCard,
            currentIndex
        );


        if (!selectionLocked) {

            updateSelectedProgram(
                activeCard
            );

        }

    }


    /* ==================================================
       NEXT
    ================================================== */

    function showNext() {

        if (
            currentIndex <
            cards.length - 1
        ) {

            currentIndex += 1;

        }


        updateCarousel();

    }


    /* ==================================================
       PREVIOUS
    ================================================== */

    function showPrevious() {

        if (
            currentIndex > 0
        ) {

            currentIndex -= 1;

        }


        updateCarousel();

    }


    /* ==================================================
       AUTOPLAY
    ================================================== */

    function autoplayStep() {

        if (
            currentIndex ===
            cards.length - 1
        ) {

            autoplayDirection =
                -1;

        }


        if (
            currentIndex === 0
        ) {

            autoplayDirection =
                1;

        }


        currentIndex +=
            autoplayDirection;


        updateCarousel();

    }


    function stopAutoplay() {

        if (
            autoplayId === null
        ) {
            return;
        }


        window.clearInterval(
            autoplayId
        );


        autoplayId =
            null;

    }


    function startAutoplay() {

        stopAutoplay();


        if (
            reducedMotion.matches
        ) {
            return;
        }


        autoplayId =
            window.setInterval(
                autoplayStep,
                AUTOPLAY_DELAY
            );

    }


    function restartAutoplay() {

        stopAutoplay();

        startAutoplay();

    }


    /* ==================================================
       FLECHAS
    ================================================== */

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


    /* ==================================================
       PAUSA
    ================================================== */

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


    /* ==================================================
       ME INTERESA
    ================================================== */

    cards.forEach(
        (card, index) => {

            const button =
                card.querySelector(
                    '[data-service-select]'
                );


            if (!button) {
                return;
            }


            button.addEventListener(
                'click',
                () => {

                    currentIndex =
                        index;


                    selectionLocked =
                        true;


                    cards.forEach(
                        (item) => {

                            item.classList.toggle(
                                'is-selected',
                                item === card
                            );

                        }
                    );


                    updateSelectedProgram(
                        card
                    );


                    updateCarousel();


                    const consult =
                        document.querySelector(
                            '[data-services-consult]'
                        );


                    if (
                        consult &&
                        window.innerWidth <= 1100
                    ) {

                        consult.scrollIntoView({

                            behavior:
                                reducedMotion.matches
                                    ? 'auto'
                                    : 'smooth',

                            block: 'start'

                        });

                    }

                }
            );

        }
    );


    /* ==================================================
       SWIPE VERTICAL
    ================================================== */

    let pointerStartY =
        null;


    carousel.addEventListener(
        'pointerdown',
        (event) => {

            pointerStartY =
                event.clientY;


            stopAutoplay();

        }
    );


    carousel.addEventListener(
        'pointerup',
        (event) => {

            if (
                pointerStartY === null
            ) {
                return;
            }


            const difference =
                event.clientY -
                pointerStartY;


            if (
                Math.abs(
                    difference
                ) > 45
            ) {

                if (
                    difference < 0
                ) {

                    showNext();

                } else {

                    showPrevious();

                }

            }


            pointerStartY =
                null;


            restartAutoplay();

        }
    );


    carousel.addEventListener(
        'pointercancel',
        () => {

            pointerStartY =
                null;


            restartAutoplay();

        }
    );


    /* ==================================================
       TECLADO
    ================================================== */

    carousel.addEventListener(
        'keydown',
        (event) => {

            if (
                event.key ===
                'ArrowDown'
            ) {

                event.preventDefault();

                showNext();

                restartAutoplay();

            }


            if (
                event.key ===
                'ArrowUp'
            ) {

                event.preventDefault();

                showPrevious();

                restartAutoplay();

            }

        }
    );


    /* ==================================================
       RESIZE
    ================================================== */

    let resizeFrame =
        null;


    window.addEventListener(
        'resize',
        () => {

            if (resizeFrame) {

                window.cancelAnimationFrame(
                    resizeFrame
                );

            }


            resizeFrame =
                window.requestAnimationFrame(
                    updateCarousel
                );

        }
    );


    /* ==================================================
       INICIO
    ================================================== */

    updateSelectedProgram(
        cards[0]
    );


    updateCarousel();


    startAutoplay();

}


/* ====================================================
   CONSULTA
==================================================== */

function initServicesConsultation() {

    const options =
        Array.from(
            document.querySelectorAll(
                '[data-consult-mode]'
            )
        );


    const panels =
        Array.from(
            document.querySelectorAll(
                '[data-consult-panel]'
            )
        );


    const form =
        document.querySelector(
            '[data-services-consult-form]'
        );


    const modeInput =
        document.querySelector(
            '[data-consult-mode-input]'
        );


    const status =
        document.querySelector(
            '[data-services-consult-status]'
        );


    if (
        options.length === 0 ||
        panels.length === 0 ||
        !form
    ) {
        return;
    }


    /* ==================================================
       FECHA MÍNIMA
    ================================================== */

    const dateInput =
        form.querySelector(
            'input[name="date"]'
        );


    if (dateInput) {

        const now =
            new Date();


        const year =
            now.getFullYear();


        const month =
            String(
                now.getMonth() + 1
            ).padStart(
                2,
                '0'
            );


        const day =
            String(
                now.getDate()
            ).padStart(
                2,
                '0'
            );


        dateInput.min =
            `${year}-${month}-${day}`;

    }


    /* ==================================================
       MODALIDAD
    ================================================== */

    function activateMode(
        activeButton
    ) {

        const mode =
            activeButton.dataset.consultMode;


        const label =
            activeButton.dataset.consultLabel ||
            mode;


        options.forEach(
            (button) => {

                const active =
                    button ===
                    activeButton;


                button.classList.toggle(
                    'is-active',
                    active
                );


                button.setAttribute(
                    'aria-pressed',
                    active
                        ? 'true'
                        : 'false'
                );

            }
        );


        panels.forEach(
            (panel) => {

                const active =
                    panel.dataset.consultPanel ===
                    mode;


                panel.hidden =
                    !active;


                panel.classList.toggle(
                    'is-active',
                    active
                );

            }
        );


        if (modeInput) {

            modeInput.value =
                label;

        }

    }


    options.forEach(
        (button) => {

            button.addEventListener(
                'click',
                () => {

                    activateMode(
                        button
                    );

                }
            );

        }
    );


    /* ==================================================
       FORM
    ================================================== */

    form.addEventListener(
        'submit',
        (event) => {

            event.preventDefault();


            if (
                !form.checkValidity()
            ) {

                form.reportValidity();

                return;

            }


            const data =
                new FormData(
                    form
                );


            const program =
                data.get('program') ||
                'No especificado';


            const mode =
                data.get('consultMode') ||
                'No especificado';


            const name =
                data.get('name') || '';


            const phone =
                data.get('phone') || '';


            const email =
                data.get('email') ||
                'No especificado';


            const city =
                data.get('city') || '';


            const date =
                data.get('date') || '';


            const time =
                data.get('time') || '';


            const message =
                data.get('message') ||
                'Sin comentario adicional';


            const text =
                [
                    'Hola, quiero solicitar una asesoría con Global Exchange.',
                    '',
                    `Programa de interés: ${program}`,
                    `Modalidad: ${mode}`,
                    '',
                    `Nombre: ${name}`,
                    `Teléfono: ${phone}`,
                    `Correo: ${email}`,
                    `Ciudad: ${city}`,
                    `Fecha preferida: ${date}`,
                    `Hora preferida: ${time}`,
                    '',
                    `Comentario: ${message}`
                ].join('\n');


            const url =
                `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;


            if (status) {

                status.textContent =
                    'Abriremos WhatsApp para enviar tu solicitud. Nuestro equipo confirmará la disponibilidad contigo.';

            }


            window.open(
                url,
                '_blank',
                'noopener,noreferrer'
            );

        }
    );

}