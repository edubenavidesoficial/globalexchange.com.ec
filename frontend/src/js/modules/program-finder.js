// ====================================================
// PROGRAM FINDER
//
// Archivo:
// src/js/modules/program-finder.js
//
// Proyecto:
// Global Exchange - Migración a Vite
//
// HOME:
// - Validar edad.
// - Validar ciudad.
// - Validar área profesional.
// - Validar destino.
// - Construir URL.
// - Redirigir.
//
// RESULTS:
// - Leer parámetros.
// - Consultar motor.
// - Mostrar perfil.
// - Renderizar resultados.
// - Mostrar afinidad profesional.
// - Animación de entrada.
// - Efecto 3D.
// ====================================================


import {

    findProgramsForProfile,
    getDestinationLabel,
    getCityLabel,
    getProfessionLabel,
    normalizeProgramFinderAge

} from '../data/program-finder-data.js';


// ====================================================
// CONFIGURACIÓN
// ====================================================

const PROGRAM_FINDER_RESULTS_URL =
    '/pages/program-finder/';


// ====================================================
// INICIALIZACIÓN
// ====================================================

export function initProgramFinder() {

    initProgramFinderForm();

    initProgramFinderResults();

}


// ====================================================
// FORMULARIO HOME
// ====================================================

function initProgramFinderForm() {

    const form =
        document.querySelector(
            '[data-program-finder-form]'
        );


    if (!form) {
        return;
    }


    const status =
        form.querySelector(
            '[data-program-finder-status]'
        );


    // ================================================
    // CAMPOS
    // ================================================

    const fields = {

        age:
            form.querySelector(
                '#program-age'
            ),

        city:
            form.querySelector(
                '#program-city'
            ),

        profession:
            form.querySelector(
                '#program-profession'
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

        profession:
            'Selecciona una carrera o área de interés.',

        destination:
            'Selecciona el destino que te interesa.',

        incomplete:
            'Completa los cuatro campos para continuar.'

    };


    // ================================================
    // OBTENER ERROR
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


        if (!fields.age?.value) {

            showError(
                fields.age,
                messages.age
            );

            isValid =
                false;

        }


        if (!fields.city?.value) {

            showError(
                fields.city,
                messages.city
            );

            isValid =
                false;

        }


        if (!fields.profession?.value) {

            showError(
                fields.profession,
                messages.profession
            );

            isValid =
                false;

        }


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
    // CAMBIO DE SELECT
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
            // PARÁMETROS
            // ========================================

            const parameters =
                new URLSearchParams({

                    age:
                        fields.age.value,

                    city:
                        fields.city.value,

                    profession:
                        fields.profession.value,

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
// RESULTADOS
// ====================================================

function initProgramFinderResults() {

    const root =
        document.querySelector(
            '[data-program-finder-results]'
        );


    if (!root) {
        return;
    }


    // ================================================
    // URL
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


        /*
         * Compatibilidad con URLs antiguas:
         * si no existe profession utilizamos
         * "sin-definir".
         */

        profession:
            parameters.get(
                'profession'
            ) ||
            'sin-definir',

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
    // ELEMENTOS PERFIL
    // ================================================

    const ageElement =
        root.querySelector(
            '[data-results-age]'
        );


    const cityElement =
        root.querySelector(
            '[data-results-city]'
        );


    const professionElement =
        root.querySelector(
            '[data-results-profession]'
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
    // VALIDAR
    // ================================================

    if (
        numericAge === null ||
        !profile.city ||
        !profile.destination
    ) {

        showInvalidSearch({

            grid,
            emptyState,
            countElement

        });


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


    const professionLabel =
        getProfessionLabel(
            profile.profession
        );


    const ageLabel =
        profile.age ===
            '30-plus'
            ? '30 años o más'
            : `${numericAge} años`;


    // ================================================
    // MOSTRAR PERFIL
    // ================================================

    if (ageElement) {

        ageElement.textContent =
            ageLabel;

    }


    if (cityElement) {

        cityElement.textContent =
            cityLabel;

    }


    if (professionElement) {

        professionElement.textContent =
            professionLabel;

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
    // MOTOR
    // ================================================

    const results =
        findProgramsForProfile({

            age:
                profile.age,

            destination:
                profile.destination,

            profession:
                profile.profession

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
    // INFORMACIÓN SECUNDARIA
    // ================================================

    updateExcludedInformation(

        excludedElement,
        results.excluded,
        professionLabel

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
    // RENDER
    // ================================================

    renderProgramResults({

        grid,

        programs:
            results.matches,

        destinationLabel,

        professionLabel

    });


    initProgramResultReveal(
        grid
    );


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
    excludedPrograms,
    professionLabel

) {

    if (!element) {
        return;
    }


    const fragments =
        [];


    if (
        excludedPrograms &&
        excludedPrograms.length >
        0
    ) {

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


        if (
            ageExcluded.length >
            0
        ) {

            fragments.push(

                `${ageExcluded.length} ${ageExcluded.length === 1
                    ? 'programa no coincide'
                    : 'programas no coinciden'
                } con la edad seleccionada`

            );

        }


        if (
            destinationExcluded.length >
            0
        ) {

            fragments.push(

                `${destinationExcluded.length} ${destinationExcluded.length === 1
                    ? 'programa no está disponible'
                    : 'programas no están disponibles'
                } para el destino seleccionado`

            );

        }

    }


    if (
        professionLabel &&
        professionLabel !==
        'Aún no lo tengo claro'
    ) {

        fragments.push(
            `resultados ordenados por afinidad con ${professionLabel}`
        );

    }


    element.textContent =
        fragments.length >
            0
            ? `${fragments.join(' · ')}.`
            : 'Mostrando las opciones disponibles según la información actual.';

}


// ====================================================
// RENDERIZAR RESULTADOS
// ====================================================

function renderProgramResults({

    grid,
    programs,
    destinationLabel,
    professionLabel

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
                    professionLabel,
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
    professionLabel,
    index

}) {

    const article =
        document.createElement(
            'article'
        );


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
    // AFINIDAD PROFESIONAL
    // ================================================

    const professionAffinity =
        getProfessionAffinityContent(
            program
        );


    // ================================================
    // FEATURES
    // ================================================

    const featuresHTML =
        Array.isArray(
            program.features
        )
            ? program
                .features
                .map(
                    (feature) => `
                        <span>
                            ${escapeHTML(feature)}
                        </span>
                    `
                )
                .join('')

            : '';


    // ================================================
    // ACCIÓN PRINCIPAL
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

        <div
            class="program-result-card__glow"
            aria-hidden="true">
        </div>


        <!-- IMAGEN -->

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


        <!-- CUERPO -->

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
                    aria-hidden="true">
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


            <!-- VALIDACIONES -->

            <div class="program-result-card__checks">


                <!-- DESTINO -->

                <div class="program-result-card__check">

                    <span
                        class="
                            program-result-card__check-icon
                            ${program.destinationVerified ? 'is-valid' : 'is-review'}
                        "
                        aria-hidden="true">
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
                        aria-hidden="true">
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


                <!-- ÁREA PROFESIONAL -->

                <div class="program-result-card__check">

                    <span
                        class="
                            program-result-card__check-icon
                            ${professionAffinity.className}
                        "
                        aria-hidden="true">
                        ${professionAffinity.icon}
                    </span>

                    <div>

                        <small>
                            Área de interés
                        </small>

                        <strong>
                            ${escapeHTML(professionLabel)}
                        </strong>

                        <span>
                            ${escapeHTML(program.professionMessage)}
                        </span>

                    </div>

                </div>

            </div>


            <!-- AFINIDAD -->

            <div
                class="
                    program-result-card__career-affinity
                    program-result-card__career-affinity--${professionAffinity.type}
                "
            >

                <span aria-hidden="true">
                    ${professionAffinity.icon}
                </span>

                ${escapeHTML(program.professionLabel)}

            </div>


            <!-- CARACTERÍSTICAS -->

            <div class="program-result-card__features">

                ${featuresHTML}

            </div>


            <!-- AVISO -->

            ${reviewNotice}


            <!-- ACCIONES -->

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
// AFINIDAD PROFESIONAL
// ====================================================

function getProfessionAffinityContent(
    program
) {

    switch (
    program.professionLevel
    ) {

        case 'high':

            return {

                type:
                    'high',

                className:
                    'is-career-high',

                icon:
                    '★'

            };


        case 'medium':

            return {

                type:
                    'medium',

                className:
                    'is-career-medium',

                icon:
                    '↗'

            };


        case 'complementary':

            return {

                type:
                    'complementary',

                className:
                    'is-career-complementary',

                icon:
                    '+'

            };


        default:

            return {

                type:
                    'open',

                className:
                    'is-career-open',

                icon:
                    '○'

            };

    }

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


                    const rotateY =
                        (
                            normalizedX -
                            0.5
                        ) *
                        7;


                    const rotateX =
                        (
                            0.5 -
                            normalizedY
                        ) *
                        6;


                    card.style.setProperty(
                        '--rotate-x',
                        `${rotateX}deg`
                    );


                    card.style.setProperty(
                        '--rotate-y',
                        `${rotateY}deg`
                    );


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


            card.addEventListener(
                'pointerleave',
                () => {

                    resetCardTilt(
                        card
                    );

                }
            );


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

function escapeHTML(
    value
) {

    return String(
        value ??
        ''
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