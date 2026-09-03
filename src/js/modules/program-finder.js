// ====================================================
// PROGRAM FINDER
//
// Archivo:
// src/js/modules/program-finder.js
//
// Proyecto:
// Global Exchange - Migración a Vite
//
// Responsabilidades:
//
// HOME
// - Validar formulario.
// - Capturar edad, ciudad y destino.
// - Construir URL.
// - Redirigir a página de resultados.
//
// RESULTS
// - Leer parámetros de la URL.
// - Consultar motor de recomendaciones.
// - Renderizar resultados.
// - Mostrar coincidencias y descartados.
// - Efectos de entrada.
// - Efecto 3D sutil en escritorio.
// ====================================================


import {
    findProgramsForProfile,
    getDestinationLabel,
    getCityLabel,
    normalizeProgramFinderAge
} from '../data/program-finder-data.js';


// ====================================================
// CONFIGURACIÓN
// ====================================================

const PROGRAM_FINDER_RESULTS_URL =
    '/pages/program-finder/';


// ====================================================
// INICIALIZACIÓN PRINCIPAL
// ====================================================

export function initProgramFinder() {

    initProgramFinderForm();

    initProgramFinderResults();

}


// ====================================================
// FORMULARIO DE LA HOME
// ====================================================

function initProgramFinderForm() {

    const form =
        document.querySelector(
            '[data-program-finder-form]'
        );


    if (!form) {
        return;
    }


    // ================================================
    // ELEMENTOS
    // ================================================

    const status =
        form.querySelector(
            '[data-program-finder-status]'
        );


    const fields = {

        age:
            form.querySelector(
                '#program-age'
            ),

        city:
            form.querySelector(
                '#program-city'
            ),

        destination:
            form.querySelector(
                '#program-destination'
            )

    };


    // ================================================
    // MENSAJES
    // ================================================

    const messages = {

        age:
            'Selecciona tu edad.',

        city:
            'Selecciona tu ciudad.',

        destination:
            'Selecciona el destino que te interesa.',

        incomplete:
            'Completa los tres campos para continuar.'

    };


    // ================================================
    // OBTENER ELEMENTO DE ERROR
    // ================================================

    function getErrorElement(
        field
    ) {

        if (!field) {
            return null;
        }


        return form.querySelector(
            `[data-error-for="${field.id}"]`
        );

    }


    // ================================================
    // MOSTRAR ERROR
    // ================================================

    function showError(
        field,
        message
    ) {

        if (!field) {
            return;
        }


        field.classList.add(
            'is-invalid'
        );


        field.setAttribute(
            'aria-invalid',
            'true'
        );


        const error =
            getErrorElement(
                field
            );


        if (error) {

            error.textContent =
                message;

        }

    }


    // ================================================
    // LIMPIAR ERROR
    // ================================================

    function clearError(
        field
    ) {

        if (!field) {
            return;
        }


        field.classList.remove(
            'is-invalid'
        );


        field.setAttribute(
            'aria-invalid',
            'false'
        );


        const error =
            getErrorElement(
                field
            );


        if (error) {

            error.textContent =
                '';

        }

    }


    // ================================================
    // LIMPIAR ESTADO
    // ================================================

    function clearStatus() {

        if (!status) {
            return;
        }


        status.textContent =
            '';


        status.className =
            'program-finder__status';

    }


    // ================================================
    // MOSTRAR ESTADO
    // ================================================

    function showStatus(
        message,
        type
    ) {

        if (!status) {
            return;
        }


        status.textContent =
            message;


        status.className =
            'program-finder__status';


        if (type) {

            status.classList.add(
                `is-${type}`
            );

        }

    }


    // ================================================
    // VALIDAR
    // ================================================

    function validateForm() {

        let isValid =
            true;


        Object
            .values(fields)
            .filter(Boolean)
            .forEach(
                clearError
            );


        // --------------------------------------------
        // EDAD
        // --------------------------------------------

        if (!fields.age?.value) {

            showError(
                fields.age,
                messages.age
            );


            isValid =
                false;

        }


        // --------------------------------------------
        // CIUDAD
        // --------------------------------------------

        if (!fields.city?.value) {

            showError(
                fields.city,
                messages.city
            );


            isValid =
                false;

        }


        // --------------------------------------------
        // DESTINO
        // --------------------------------------------

        if (!fields.destination?.value) {

            showError(
                fields.destination,
                messages.destination
            );


            isValid =
                false;

        }


        return isValid;

    }


    // ================================================
    // CAMBIOS EN SELECT
    // ================================================

    Object
        .values(fields)
        .filter(Boolean)
        .forEach(
            (field) => {

                field.addEventListener(
                    'change',
                    () => {

                        clearError(
                            field
                        );


                        clearStatus();

                    }
                );

            }
        );


    // ================================================
    // SUBMIT
    // ================================================

    form.addEventListener(
        'submit',
        (event) => {

            event.preventDefault();


            clearStatus();


            if (!validateForm()) {

                showStatus(
                    messages.incomplete,
                    'error'
                );


                form
                    .querySelector(
                        '.is-invalid'
                    )
                    ?.focus();


                return;

            }


            // ========================================
            // CONSTRUIR PARÁMETROS
            // ========================================

            const parameters =
                new URLSearchParams({

                    age:
                        fields.age.value,

                    city:
                        fields.city.value,

                    destination:
                        fields.destination.value

                });


            // ========================================
            // REDIRECCIÓN
            // ========================================

            window.location.href =
                `${PROGRAM_FINDER_RESULTS_URL}?${parameters.toString()}`;

        }
    );

}


// ====================================================
// PÁGINA DE RESULTADOS
// ====================================================

function initProgramFinderResults() {

    const root =
        document.querySelector(
            '[data-program-finder-results]'
        );


    /*
     * Si estamos en Home, este elemento no existe.
     * Por lo tanto terminamos aquí.
     */

    if (!root) {
        return;
    }


    // ================================================
    // PARÁMETROS
    // ================================================

    const parameters =
        new URLSearchParams(
            window.location.search
        );


    const profile = {

        age:
            parameters.get(
                'age'
            ),

        city:
            parameters.get(
                'city'
            ),

        destination:
            parameters.get(
                'destination'
            )

    };


    const numericAge =
        normalizeProgramFinderAge(
            profile.age
        );


    // ================================================
    // ELEMENTOS DEL HERO
    // ================================================

    const ageElement =
        root.querySelector(
            '[data-results-age]'
        );


    const cityElement =
        root.querySelector(
            '[data-results-city]'
        );


    const destinationElement =
        root.querySelector(
            '[data-results-destination]'
        );


    const titleDestinationElement =
        root.querySelector(
            '[data-results-title-destination]'
        );


    // ================================================
    // RESULTADOS
    // ================================================

    const countElement =
        root.querySelector(
            '[data-results-count]'
        );


    const excludedElement =
        root.querySelector(
            '[data-results-excluded]'
        );


    const grid =
        root.querySelector(
            '[data-results-grid]'
        );


    const emptyState =
        root.querySelector(
            '[data-results-empty]'
        );


    // ================================================
    // VALIDAR PERFIL
    // ================================================

    if (
        numericAge === null ||
        !profile.city ||
        !profile.destination
    ) {

        showInvalidSearch(
            {
                grid,
                emptyState,
                countElement
            }
        );


        return;

    }


    // ================================================
    // LABELS
    // ================================================

    const destinationLabel =
        getDestinationLabel(
            profile.destination
        );


    const cityLabel =
        getCityLabel(
            profile.city
        );


    const ageLabel =
        profile.age ===
            '30-plus'
            ? '30 años o más'
            : `${numericAge} años`;


    // ================================================
    // PINTAR PERFIL
    // ================================================

    if (ageElement) {

        ageElement.textContent =
            ageLabel;

    }


    if (cityElement) {

        cityElement.textContent =
            cityLabel;

    }


    if (destinationElement) {

        destinationElement.textContent =
            destinationLabel;

    }


    if (titleDestinationElement) {

        titleDestinationElement.textContent =
            destinationLabel;

    }


    // ================================================
    // EJECUTAR MOTOR
    // ================================================

    const results =
        findProgramsForProfile({

            age:
                profile.age,

            destination:
                profile.destination

        });


    // ================================================
    // CONTADOR
    // ================================================

    if (countElement) {

        const total =
            results.matches.length;


        countElement.textContent =
            total === 1
                ? '1 programa encontrado'
                : `${total} programas encontrados`;

    }


    // ================================================
    // PROGRAMAS DESCARTADOS
    // ================================================

    updateExcludedInformation(
        excludedElement,
        results.excluded
    );


    // ================================================
    // SIN RESULTADOS
    // ================================================

    if (
        results.matches.length ===
        0
    ) {

        if (grid) {

            grid.hidden =
                true;

        }


        if (emptyState) {

            emptyState.hidden =
                false;

        }


        return;

    }


    // ================================================
    // MOSTRAR GRID
    // ================================================

    if (!grid) {
        return;
    }


    grid.hidden =
        false;


    if (emptyState) {

        emptyState.hidden =
            true;

    }


    // ================================================
    // RENDERIZAR
    // ================================================

    renderProgramResults({

        grid,

        programs:
            results.matches,

        destinationLabel

    });


    // ================================================
    // ANIMACIONES
    // ================================================

    initProgramResultReveal(
        grid
    );


    // ================================================
    // EFECTO 3D
    // ================================================

    initProgramResultTilt(
        grid
    );

}


// ====================================================
// BÚSQUEDA INVÁLIDA
// ====================================================

function showInvalidSearch({

    grid,
    emptyState,
    countElement

}) {

    if (grid) {

        grid.hidden =
            true;

    }


    if (emptyState) {

        emptyState.hidden =
            false;

    }


    if (countElement) {

        countElement.textContent =
            'Búsqueda incompleta';

    }

}


// ====================================================
// INFORMACIÓN DE DESCARTADOS
// ====================================================

function updateExcludedInformation(
    element,
    excludedPrograms
) {

    if (!element) {
        return;
    }


    if (
        !excludedPrograms ||
        excludedPrograms.length ===
        0
    ) {

        element.textContent =
            'Mostrando las opciones disponibles según la información actual.';


        return;

    }


    const ageExcluded =
        excludedPrograms.filter(
            (program) =>
                program.reason ===
                'age'
        );


    const destinationExcluded =
        excludedPrograms.filter(
            (program) =>
                program.reason ===
                'destination'
        );


    const fragments =
        [];


    if (
        ageExcluded.length >
        0
    ) {

        fragments.push(

            `${ageExcluded.length} ${ageExcluded.length === 1 ? 'programa no coincide' : 'programas no coinciden'} con la edad seleccionada`

        );

    }


    if (
        destinationExcluded.length >
        0
    ) {

        fragments.push(

            `${destinationExcluded.length} ${destinationExcluded.length === 1 ? 'programa no está disponible' : 'programas no están disponibles'} para el destino seleccionado`

        );

    }


    element.textContent =
        fragments.length > 0
            ? `${fragments.join(' · ')}.`
            : '';

}


// ====================================================
// RENDERIZAR RESULTADOS
// ====================================================

function renderProgramResults({

    grid,
    programs,
    destinationLabel

}) {

    grid.innerHTML =
        '';


    programs.forEach(
        (
            program,
            index
        ) => {

            const card =
                createProgramResultCard({

                    program,

                    destinationLabel,

                    index

                });


            grid.appendChild(
                card
            );

        }
    );

}


// ====================================================
// CREAR TARJETA
// ====================================================

function createProgramResultCard({

    program,
    destinationLabel,
    index

}) {

    const article =
        document.createElement(
            'article'
        );


    // ================================================
    // CLASES
    // ================================================

    article.className =
        [
            'program-result-card',

            `program-result-card--${program.color || 'blue'}`,

            `program-result-card--${program.id}`,

            program.compatibility ===
                'confirmed'
                ? 'is-confirmed'
                : 'is-review'
        ]
            .join(' ');


    article.dataset.resultCard =
        '';


    article.style.setProperty(
        '--result-delay',
        `${index * 80}ms`
    );


    // ================================================
    // COMPATIBILIDAD
    // ================================================

    const compatibility =
        getCompatibilityContent(
            program
        );


    // ================================================
    // FEATURES
    // ================================================

    const featuresHTML =
        Array
            .isArray(
                program.features
            )

            ? program
                .features
                .map(
                    (feature) => {

                        return `
                            <span>
                                ${escapeHTML(feature)}
                            </span>
                        `;

                    }
                )
                .join('')

            : '';


    // ================================================
    // ACTION PRINCIPAL
    // ================================================

    const primaryAction =
        program.url
            ? `
                <a
                    class="program-result-card__primary"
                    href="${escapeHTML(program.url)}"
                >
                    Explorar programa

                    <span aria-hidden="true">
                        →
                    </span>
                </a>
            `

            : `
                <a
                    class="program-result-card__primary"
                    href="/#servicios"
                >
                    Solicitar información

                    <span aria-hidden="true">
                        →
                    </span>
                </a>
            `;


    // ================================================
    // AVISO
    // ================================================

    const reviewNotice =
        program.compatibility ===
            'review'

            ? `
                <div class="program-result-card__notice">

                    <strong>
                        Validación recomendada
                    </strong>

                    <span>
                        Un asesor debe confirmar los requisitos
                        específicos antes de iniciar el proceso.
                    </span>

                </div>
            `

            : '';


    // ================================================
    // HTML
    // ================================================

    article.innerHTML = `

        <!-- ========================================
             REFLEJO 3D
        ========================================= -->

        <div
            class="program-result-card__glow"
            aria-hidden="true"
        ></div>


        <!-- ========================================
             IMAGEN
        ========================================= -->

        <div class="program-result-card__media">

            <img
                src="${escapeHTML(program.image)}"
                alt="${escapeHTML(program.name)}"
                loading="lazy"
            >


            <span class="program-result-card__category">
                ${escapeHTML(program.category)}
            </span>

        </div>


        <!-- ========================================
             CUERPO
        ========================================= -->

        <div class="program-result-card__body">


            <!-- COMPATIBILIDAD -->

            <div
                class="
                    program-result-card__compatibility
                    program-result-card__compatibility--${compatibility.type}
                "
            >

                <span
                    class="program-result-card__compatibility-icon"
                    aria-hidden="true"
                >
                    ${compatibility.icon}
                </span>

                <span>
                    ${compatibility.label}
                </span>

            </div>


            <!-- TÍTULO -->

            <h3 class="program-result-card__title">
                ${escapeHTML(program.name)}
            </h3>


            <!-- DESCRIPCIÓN -->

            <p class="program-result-card__description">
                ${escapeHTML(program.description)}
            </p>


            <!-- ====================================
                 VALIDACIONES
            ===================================== -->

            <div class="program-result-card__checks">


                <!-- DESTINO -->

                <div class="program-result-card__check">

                    <span
                        class="
                            program-result-card__check-icon
                            ${program.destinationVerified ? 'is-valid' : 'is-review'}
                        "
                        aria-hidden="true"
                    >
                        ${program.destinationVerified ? '✓' : '?'}
                    </span>


                    <div>

                        <small>
                            Destino
                        </small>


                        <strong>
                            ${escapeHTML(destinationLabel)}
                        </strong>


                        <span>
                            ${escapeHTML(program.destinationMessage)}
                        </span>

                    </div>

                </div>


                <!-- EDAD -->

                <div class="program-result-card__check">

                    <span
                        class="
                            program-result-card__check-icon
                            ${program.ageVerified ? 'is-valid' : 'is-review'}
                        "
                        aria-hidden="true"
                    >
                        ${program.ageVerified ? '✓' : '?'}
                    </span>


                    <div>

                        <small>
                            Edad
                        </small>


                        <strong>
                            ${escapeHTML(program.ageMessage)}
                        </strong>

                    </div>

                </div>

            </div>


            <!-- ====================================
                 CARACTERÍSTICAS
            ===================================== -->

            <div class="program-result-card__features">

                ${featuresHTML}

            </div>


            <!-- ====================================
                 AVISO
            ===================================== -->

            ${reviewNotice}


            <!-- ====================================
                 ACCIONES
            ===================================== -->

            <div class="program-result-card__actions">

                ${primaryAction}


                <a
                    class="program-result-card__secondary"
                    href="/#servicios"
                >
                    Hablar con un asesor
                </a>

            </div>

        </div>

    `;


    return article;

}


// ====================================================
// COMPATIBILIDAD
// ====================================================

function getCompatibilityContent(
    program
) {

    if (
        program.compatibility ===
        'confirmed'
    ) {

        return {

            type:
                'confirmed',

            icon:
                '✓',

            label:
                'Compatible con tu búsqueda'

        };

    }


    return {

        type:
            'review',

        icon:
            '?',

        label:
            'Requisitos por confirmar'

    };

}


// ====================================================
// ANIMACIÓN DE ENTRADA
// ====================================================

function initProgramResultReveal(
    container
) {

    const cards =
        Array.from(
            container.querySelectorAll(
                '[data-result-card]'
            )
        );


    if (
        cards.length ===
        0
    ) {
        return;
    }


    const reducedMotion =
        window.matchMedia(
            '(prefers-reduced-motion: reduce)'
        ).matches;


    // ================================================
    // SIN ANIMACIONES
    // ================================================

    if (
        reducedMotion ||
        !(
            'IntersectionObserver'
            in window
        )
    ) {

        cards.forEach(
            (card) => {

                card.classList.add(
                    'is-visible'
                );

            }
        );


        return;

    }


    // ================================================
    // OBSERVER
    // ================================================

    const observer =
        new IntersectionObserver(

            (entries) => {

                entries.forEach(
                    (entry) => {

                        if (
                            !entry.isIntersecting
                        ) {
                            return;
                        }


                        entry
                            .target
                            .classList
                            .add(
                                'is-visible'
                            );


                        observer.unobserve(
                            entry.target
                        );

                    }
                );

            },

            {
                threshold:
                    0.13,

                rootMargin:
                    '0px 0px -35px 0px'
            }

        );


    cards.forEach(
        (card) => {

            observer.observe(
                card
            );

        }
    );

}


// ====================================================
// EFECTO 3D
// ====================================================

function initProgramResultTilt(
    container
) {

    // ================================================
    // SOLO DISPOSITIVOS CON MOUSE
    // ================================================

    const supportsHover =
        window.matchMedia(
            '(hover: hover) and (pointer: fine)'
        ).matches;


    const reducedMotion =
        window.matchMedia(
            '(prefers-reduced-motion: reduce)'
        ).matches;


    if (
        !supportsHover ||
        reducedMotion
    ) {

        return;

    }


    const cards =
        container.querySelectorAll(
            '[data-result-card]'
        );


    cards.forEach(
        (card) => {


            // ========================================
            // MOVE
            // ========================================

            card.addEventListener(
                'pointermove',
                (event) => {

                    const rectangle =
                        card.getBoundingClientRect();


                    const pointerX =
                        event.clientX -
                        rectangle.left;


                    const pointerY =
                        event.clientY -
                        rectangle.top;


                    const normalizedX =
                        pointerX /
                        rectangle.width;


                    const normalizedY =
                        pointerY /
                        rectangle.height;


                    // --------------------------------
                    // ROTACIONES SUTILES
                    // --------------------------------

                    const rotateY =
                        (
                            normalizedX -
                            0.5
                        ) * 7;


                    const rotateX =
                        (
                            0.5 -
                            normalizedY
                        ) * 6;


                    card.style.setProperty(
                        '--rotate-x',
                        `${rotateX}deg`
                    );


                    card.style.setProperty(
                        '--rotate-y',
                        `${rotateY}deg`
                    );


                    // --------------------------------
                    // REFLEJO DINÁMICO
                    // --------------------------------

                    card.style.setProperty(
                        '--pointer-x',
                        `${normalizedX * 100}%`
                    );


                    card.style.setProperty(
                        '--pointer-y',
                        `${normalizedY * 100}%`
                    );

                }
            );


            // ========================================
            // RESET
            // ========================================

            card.addEventListener(
                'pointerleave',
                () => {

                    resetCardTilt(
                        card
                    );

                }
            );


            // ========================================
            // BLUR
            // ========================================

            card.addEventListener(
                'blur',
                () => {

                    resetCardTilt(
                        card
                    );

                },
                true
            );

        }
    );

}


// ====================================================
// RESET 3D
// ====================================================

function resetCardTilt(
    card
) {

    card.style.setProperty(
        '--rotate-x',
        '0deg'
    );


    card.style.setProperty(
        '--rotate-y',
        '0deg'
    );


    card.style.setProperty(
        '--pointer-x',
        '50%'
    );


    card.style.setProperty(
        '--pointer-y',
        '50%'
    );

}


// ====================================================
// ESCAPAR HTML
// ====================================================
//
// Las tarjetas se construyen mediante innerHTML.
// Escapamos todo texto proveniente del dataset para
// evitar que caracteres especiales alteren el HTML.
// ====================================================

function escapeHTML(
    value
) {

    return String(
        value ?? ''
    )
        .replaceAll(
            '&',
            '&amp;'
        )
        .replaceAll(
            '<',
            '&lt;'
        )
        .replaceAll(
            '>',
            '&gt;'
        )
        .replaceAll(
            '"',
            '&quot;'
        )
        .replaceAll(
            "'",
            '&#039;'
        );

}