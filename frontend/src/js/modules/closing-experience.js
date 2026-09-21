// ====================================================
// EXPERIENCIA FINAL
//
// Archivo:
// src/js/modules/closing-experience.js
//
// Responsabilidades:
//
// - Detectar la página actual.
// - Cargar un mensaje contextual.
// - Configurar el CTA correspondiente.
// - Detectar cuándo entra la sección.
// - Fijar el escenario a la pantalla.
// - Liberarlo exactamente al terminar.
// - Calcular el progreso del scroll.
// - Revelar los textos.
// - Aplicar parallax.
// - Dibujar la ruta.
// - Mover el avión.
// - Actualizar la barra lateral.
// - Evitar espacios vacíos al final.
//
// NOTA:
// Internacionalización pendiente.
// Por ahora los contenidos se gestionan en español.
// ====================================================


// ====================================================
// CONTENIDOS POR PÁGINA
// ====================================================

const CLOSING_CONTEXTS = {
    '/pages/ausbildung/': {
        id: 'ausbildung',
        eyebrow: 'Formación para tu desarrollo profesional',
        lines: ['Aprende,', 'pon en práctica', 'tus conocimientos', 'y construye', 'tu camino profesional.'],
        description: 'Conoce cómo la formación y la experiencia en una empresa pueden acompañar el desarrollo de tu carrera.',
        button: 'Consultar sobre Ausbildung',
        href: '/pages/contactos/'
    },
    '/pages/educacion-dual/': {
        id: 'educacion-dual',
        eyebrow: 'Estudio y experiencia práctica',
        lines: ['Estudia,', 'lleva la teoría', 'a la práctica', 'y sigue', 'aprendiendo.'],
        description: 'Explora una formación que combina estudios académicos y experiencia práctica en una empresa.',
        button: 'Consultar sobre Educación Dual',
        href: '/pages/contactos/'
    },

    // ================================================
    // HOME
    // ================================================

    '/': {

        id:
            'home',

        eyebrow:
            'Tu futuro puede comenzar aquí',

        lines: [
            'El mundo',
            'no solo se conoce.',
            'Se descubre,',
            'se aprende',
            'y se vive.'
        ],

        description:
            'Cada destino puede convertirse en una nueva experiencia, una oportunidad y una historia que recordarás para siempre.',

        button:
            'Comienza tu experiencia',

        href:
            '/pages/program-finder/'

    },


    // ================================================
    // PROGRAMAS
    // ================================================

    '/pages/programas/': {

        id:
            'programs',

        eyebrow:
            'Encuentra tu próxima experiencia',

        lines: [
            'Cada programa',
            'puede abrir una puerta.',
            'Elige,',
            'prepárate',
            'y avanza.'
        ],

        description:
            'Compara posibilidades, descubre nuevas oportunidades y encuentra la experiencia que mejor se adapta a tus objetivos.',

        button:
            'Encontrar mi programa ideal',

        href:
            '/pages/program-finder/'

    },


    // ================================================
    // PROGRAM FINDER
    // ================================================

    '/pages/program-finder/': {

        id:
            'finder',

        eyebrow:
            'Tu camino empieza con una elección',

        lines: [
            'Tus metas',
            'marcan el rumbo.',
            'Compara,',
            'descubre',
            'y elige.'
        ],

        description:
            'Cada persona tiene objetivos diferentes. Nuestro equipo puede ayudarte a convertir tus intereses en un próximo paso concreto.',

        button:
            'Hablar con un asesor',

        href:
            '/pages/contactos/'

    },


    // ================================================
    // TESTIMONIOS
    // ================================================

    '/pages/testimonios/': {

        id:
            'testimonials',

        eyebrow:
            'Tu historia puede ser la siguiente',

        lines: [
            'Hay experiencias',
            'que no solo se cuentan.',
            'Se viven,',
            'se recuerdan',
            'y se comparten.'
        ],

        description:
            'Cada testimonio representa una experiencia real, nuevos aprendizajes y una historia que comenzó con una decisión.',

        button:
            'Empieza tu historia',

        href:
            '/pages/program-finder/'

    },


    // ================================================
    // NUESTRA HISTORIA
    // ================================================

    '/pages/nuestra-historia/': {

        id:
            'about',

        eyebrow:
            'Una historia que sigue creciendo',

        lines: [
            'Cada historia',
            'comienza con una idea.',
            'La nuestra',
            'sigue creciendo',
            'contigo.'
        ],

        description:
            'Global Exchange continúa conectando personas, destinos y oportunidades para convertir nuevos objetivos en experiencias reales.',

        button:
            'Explorar nuestros programas',

        href:
            '/pages/programas/'

    },


    // ================================================
    // PREGUNTAS
    // ================================================

    '/pages/preguntas/': {

        id:
            'faq',

        eyebrow:
            'Cada duda merece una respuesta',

        lines: [
            'Las respuestas',
            'también abren caminos.',
            'Infórmate,',
            'decide',
            'y avanza.'
        ],

        description:
            'Resolver tus preguntas es parte del camino. Nuestro equipo está listo para orientarte antes de tomar tu próxima decisión.',

        button:
            'Hablar con nosotros',

        href:
            '/pages/contactos/'

    },


    // ================================================
    // CONTACTOS
    // ================================================

    '/pages/contactos/': {

        id:
            'contact',

        eyebrow:
            'Estamos listos para escucharte',

        lines: [
            'Tu experiencia',
            'puede comenzar',
            'con una conversación.',
            'Conoce tus opciones',
            'y da el siguiente paso.'
        ],

        description:
            'Nuestro equipo puede orientarte y ayudarte a identificar el programa que mejor se adapta a tus objetivos.',

        button:
            'Explorar programas',

        href:
            '/pages/programas/'

    },


    // ================================================
    // CURSOS DE IDIOMA LOCAL
    // ================================================

    '/pages/cursos-idioma-local/': {

        id:
            'local-language',

        eyebrow:
            'Aprende hoy, conecta mañana',

        lines: [
            'Un nuevo idioma',
            'abre nuevas puertas.',
            'Aprende,',
            'practica',
            'y conecta.'
        ],

        description:
            'Fortalece tus habilidades lingüísticas y prepárate para comunicarte con mayor seguridad en nuevos contextos.',

        button:
            'Solicitar información',

        href:
            '/pages/contactos/'

    },


    // ================================================
    // ESPAÑOL PARA EXTRANJEROS + ECOTURISMO
    // ================================================

    '/pages/espanol-para-extranjeros-ecoturismo/': {

        id:
            'spanish-ecotourism',

        eyebrow:
            'Descubre Ecuador en cada palabra',

        lines: [
            'El idioma',
            'también se vive.',
            'Aprende,',
            'explora',
            'y conecta.'
        ],

        description:
            'Practica español mientras descubres la cultura, los paisajes y la diversidad que hacen de Ecuador una experiencia única.',

        button:
            'Solicitar información',

        href:
            '/pages/contactos/'

    },


    // ================================================
    // IDIOMAS EN EL EXTRANJERO
    // ================================================

    '/pages/cursos-de-idiomas-en-el-extranjero-2/': {

        id:
            'foreign-languages',

        eyebrow:
            'Aprende el idioma donde se vive',

        lines: [
            'Una lengua',
            'cobra otra dimensión',
            'cuando la escuchas,',
            'la compartes',
            'y la vives.'
        ],

        description:
            'Aprender en otro país te permite practicar cada día, conocer nuevas culturas y transformar el idioma en una experiencia real.',

        button:
            'Encontrar mi experiencia',

        href:
            '/pages/program-finder/'

    },


    // ================================================
    // PROGRAMA ESCOLAR
    // ================================================

    '/pages/programa-escolar/': {

        id:
            'school',

        eyebrow:
            'Estudia, descubre y crece',

        lines: [
            'Estudiar afuera',
            'cambia tu perspectiva.',
            'Aprende,',
            'descubre',
            'y crece.'
        ],

        description:
            'Vivir una etapa escolar en otro país puede ampliar tu visión del mundo, fortalecer tu autonomía y crear recuerdos para toda la vida.',

        button:
            'Solicitar información',

        href:
            '/pages/contactos/'

    },


    // ================================================
    // PASANTÍAS PROFESIONALES
    // ================================================

    '/pages/pasantias-profesionales/': {

        id:
            'internships',

        eyebrow:
            'Impulsa tu experiencia profesional',

        lines: [
            'Tu carrera',
            'también cruza fronteras.',
            'Aprende,',
            'aporta',
            'y evoluciona.'
        ],

        description:
            'Una experiencia profesional internacional puede ayudarte a desarrollar habilidades, ampliar tu perspectiva y fortalecer tu perfil.',

        button:
            'Solicitar información',

        href:
            '/pages/contactos/'

    },


    // ================================================
    // PROGRAMA NANNY
    // ================================================

    '/pages/programa-nanny/': {

        id:
            'nanny',

        eyebrow:
            'Vive una cultura desde adentro',

        lines: [
            'Un nuevo hogar',
            'puede enseñarte mucho.',
            'Comparte,',
            'aprende',
            'y crea vínculos.'
        ],

        description:
            'Convivir con una familia anfitriona convierte el intercambio cultural en una experiencia cercana, cotidiana y profundamente humana.',

        button:
            'Solicitar información',

        href:
            '/pages/contactos/'

    },


    // ================================================
    // SUMMER CAMPS
    // ================================================

    '/pages/summer-camps/': {

        id:
            'summer-camps',

        eyebrow:
            'Haz del verano una experiencia',

        lines: [
            'Aprender también',
            'puede ser una aventura.',
            'Explora,',
            'comparte',
            'y disfruta.'
        ],

        description:
            'Nuevas actividades, amistades y aprendizajes pueden convertir tus vacaciones en una experiencia que recordarás durante años.',

        button:
            'Solicitar información',

        href:
            '/pages/contactos/'

    },


    // ================================================
    // EDUCACIÓN EN EL EXTERIOR
    // ================================================

    '/pages/educacion-en-el-exterior/': {

        id:
            'education-abroad',

        eyebrow:
            'Lleva tu formación más lejos',

        lines: [
            'Tu formación',
            'puede llegar más lejos.',
            'Prepárate,',
            'avanza',
            'y transforma tu futuro.'
        ],

        description:
            'Explora nuevas posibilidades académicas y encuentra una experiencia educativa alineada con tus metas personales y profesionales.',

        button:
            'Encontrar mi opción',

        href:
            '/pages/program-finder/'

    }

};


// ====================================================
// INICIALIZACIÓN
// ====================================================

export function initClosingExperience() {

    const section =
        document.querySelector(
            '[data-closing-experience]'
        );


    if (!section) {
        return;
    }


    const stage =
        section.querySelector(
            '[data-closing-stage]'
        );


    if (!stage) {
        return;
    }


    // ================================================
    // APLICAR CONTENIDO SEGÚN LA PÁGINA
    // ================================================

    applyPageContext(
        section
    );


    // ================================================
    // MOVIMIENTO REDUCIDO
    // ================================================

    const reducedMotion =
        window.matchMedia(
            '(prefers-reduced-motion: reduce)'
        );


    if (reducedMotion.matches) {

        showCompleteExperience(
            section
        );

        return;

    }


    // ================================================
    // ESTADO DEL COMPONENTE
    // ================================================

    const state = {

        section,

        stage,


        /*
         * Incluye automáticamente:
         *
         * - Etiqueta.
         * - Líneas del título.
         * - Descripción.
         * - CTA.
         * - Tarjetas de ubicaciones.
         */

        reveals:
            Array.from(
                section.querySelectorAll(
                    '[data-closing-reveal]'
                )
            ),


        routePath:
            section.querySelector(
                '[data-closing-route-path]'
            ),


        plane:
            section.querySelector(
                '[data-closing-plane]'
            ),


        progressBar:
            section.querySelector(
                '[data-closing-progress-bar]'
            ),


        scrollIndicator:
            section.querySelector(
                '[data-closing-scroll-indicator]'
            ),


        frame:
            null

    };


    // ================================================
    // PREPARAR ELEMENTOS
    // ================================================

    prepareRoute(
        state
    );


    // ================================================
    // ACTUALIZACIÓN INICIAL
    // ================================================

    updateExperience(
        state
    );


    // ================================================
    // SCROLL
    // ================================================

    window.addEventListener(
        'scroll',
        () => {

            requestExperienceUpdate(
                state
            );

        },
        {
            passive: true
        }
    );


    // ================================================
    // CAMBIO DE TAMAÑO
    // ================================================

    window.addEventListener(
        'resize',
        () => {

            requestExperienceUpdate(
                state
            );

        },
        {
            passive: true
        }
    );

}


// ====================================================
// APLICAR CONTEXTO DE LA PÁGINA
// ====================================================

function applyPageContext(
    section
) {

    const pathname =
        normalizePathname(
            window.location.pathname
        );


    const context =
        CLOSING_CONTEXTS[pathname] ||
        CLOSING_CONTEXTS['/'];


    // ================================================
    // GUARDAR CONTEXTO EN EL DOM
    //
    // Puede servir más adelante para estilos
    // específicos sin cambiar la arquitectura.
    // ================================================

    section.dataset.closingContext =
        context.id;


    // ================================================
    // EYEBROW
    // ================================================

    const eyebrow =
        section.querySelector(
            '[data-closing-eyebrow]'
        );


    replaceDirectText(
        eyebrow,
        context.eyebrow
    );


    // ================================================
    // LÍNEAS DEL TÍTULO
    // ================================================

    context.lines.forEach(
        (
            text,
            index
        ) => {

            const line =
                section.querySelector(
                    `[data-closing-line="${index + 1}"]`
                );


            if (!line) {
                return;
            }


            line.textContent =
                text;

        }
    );


    // ================================================
    // DESCRIPCIÓN
    // ================================================

    const description =
        section.querySelector(
            '[data-closing-description]'
        );


    if (description) {

        description.textContent =
            context.description;

    }


    // ================================================
    // CTA
    // ================================================

    const button =
        section.querySelector(
            '[data-closing-button]'
        );


    if (button) {

        button.setAttribute(
            'href',
            context.href
        );


        replaceDirectText(
            button,
            context.button
        );

    }

}


// ====================================================
// NORMALIZAR PATHNAME
//
// Convierte:
//
// /pages/nanny
// /pages/nanny/
// /pages/nanny/index.html
//
// en una misma estructura de ruta.
// ====================================================

function normalizePathname(
    pathname
) {

    let normalized =
        pathname
            .trim()
            .replace(
                /\/index\.html$/i,
                '/'
            )
            .replace(
                /\/+/g,
                '/'
            );


    if (
        normalized === ''
    ) {

        return '/';

    }


    if (
        normalized === '/'
    ) {

        return normalized;

    }


    if (
        !normalized.endsWith('/')
    ) {

        normalized += '/';

    }


    return normalized;

}


// ====================================================
// REEMPLAZAR TEXTO DIRECTO
//
// Algunos elementos contienen además elementos hijos:
//
// EYEBROW:
// <span línea></span>
// texto
//
// CTA:
// texto
// <span>→</span>
//
// Esta función cambia solamente el texto principal
// sin eliminar los elementos decorativos.
// ====================================================

function replaceDirectText(
    element,
    text
) {

    if (!element) {
        return;
    }


    const textNode =
        Array.from(
            element.childNodes
        ).find(
            (node) => {

                return (
                    node.nodeType ===
                    Node.TEXT_NODE
                ) &&
                    (
                        node.textContent
                            .trim()
                            .length >
                        0
                    );

            }
        );


    if (!textNode) {
        return;
    }


    textNode.textContent =
        ` ${text} `;

}


// ====================================================
// SOLICITAR ACTUALIZACIÓN
// ====================================================

function requestExperienceUpdate(
    state
) {

    if (state.frame) {
        return;
    }


    state.frame =
        window.requestAnimationFrame(
            () => {

                state.frame =
                    null;


                updateExperience(
                    state
                );

            }
        );

}


// ====================================================
// ACTUALIZACIÓN GENERAL
// ====================================================

function updateExperience(
    state
) {

    // ================================================
    // POSICIÓN DEL ESCENARIO
    // ================================================

    updateStagePosition(
        state
    );


    // ================================================
    // PROGRESO GENERAL
    // ================================================

    const progress =
        getSectionProgress(
            state.section
        );


    // ================================================
    // TEXTOS Y CTA
    // ================================================

    updateReveals(
        state.reveals,
        progress
    );


    // ================================================
    // PARALLAX
    // ================================================

    updateBackgroundParallax(
        state.section,
        progress
    );


    // ================================================
    // RUTA Y AVIÓN
    // ================================================

    updateRoute(
        state,
        progress
    );


    // ================================================
    // BARRA DE PROGRESO
    // ================================================

    updateProgressBar(
        state.progressBar,
        progress
    );


    // ================================================
    // INDICADOR
    // ================================================

    updateScrollIndicator(
        state.scrollIndicator,
        progress
    );

}


// ====================================================
// CONTROLAR POSICIÓN DEL ESCENARIO
//
// ESTADOS:
//
// 1. Antes de entrar:
//    escenario al inicio.
//
// 2. Durante la experiencia:
//    escenario fixed.
//
// 3. Al finalizar:
//    escenario pegado al fondo.
// ====================================================

function updateStagePosition(
    state
) {

    const section =
        state.section;


    const rectangle =
        section.getBoundingClientRect();


    const viewportHeight =
        window.innerHeight;


    // ================================================
    // ANTES DE ENTRAR
    // ================================================

    if (
        rectangle.top >
        0
    ) {

        section.classList.remove(
            'is-active'
        );


        section.classList.remove(
            'is-complete'
        );


        return;

    }


    // ================================================
    // EXPERIENCIA COMPLETA
    // ================================================

    if (
        rectangle.bottom <=
        viewportHeight
    ) {

        section.classList.remove(
            'is-active'
        );


        section.classList.add(
            'is-complete'
        );


        return;

    }


    // ================================================
    // EXPERIENCIA ACTIVA
    // ================================================

    section.classList.remove(
        'is-complete'
    );


    section.classList.add(
        'is-active'
    );

}


// ====================================================
// CALCULAR PROGRESO
//
// 0 = inicio
// 1 = final
// ====================================================

function getSectionProgress(
    section
) {

    const rectangle =
        section.getBoundingClientRect();


    const viewportHeight =
        window.innerHeight;


    const travelDistance =
        Math.max(
            section.offsetHeight -
            viewportHeight,
            1
        );


    const traveled =
        -rectangle.top;


    return clamp(
        traveled /
        travelDistance,
        0,
        1
    );

}


// ====================================================
// REVELAR ELEMENTOS
// ====================================================

function updateReveals(
    elements,
    progress
) {

    elements.forEach(
        (element) => {

            const start =
                Number.parseFloat(
                    element.dataset.start ||
                    '0'
                );


            const end =
                Number.parseFloat(
                    element.dataset.end ||
                    '1'
                );


            const localProgress =
                normalizeRange(
                    progress,
                    start,
                    end
                );


            const eased =
                easeOutCubic(
                    localProgress
                );


            // ========================================
            // MOVIMIENTO
            // ========================================

            const translateY =
                (
                    1 -
                    eased
                ) *
                26;


            // ========================================
            // ESCALA
            // ========================================

            const scale =
                0.98 +
                (
                    eased *
                    0.02
                );


            // ========================================
            // OPACIDAD
            // ========================================

            element.style.opacity =
                `${eased}`;


            // ========================================
            // TRANSFORMACIÓN
            // ========================================

            element.style.transform =
                `
                    translate3d(
                        0,
                        ${translateY}px,
                        0
                    )
                    scale(
                        ${scale}
                    )
                `;


            // ========================================
            // INTERACCIÓN
            // ========================================

            element.style.pointerEvents =
                localProgress >
                    0.78
                    ? 'auto'
                    : 'none';

        }
    );

}


// ====================================================
// PARALLAX DE LAS FORMAS
// ====================================================

function updateBackgroundParallax(
    section,
    progress
) {

    // ================================================
    // AZUL
    // ================================================

    section.style.setProperty(
        '--closing-shape-blue-x',
        `${progress * 52}px`
    );


    section.style.setProperty(
        '--closing-shape-blue-y',
        `${progress * 34}px`
    );


    // ================================================
    // TURQUESA
    // ================================================

    section.style.setProperty(
        '--closing-shape-teal-x',
        `${progress * -48}px`
    );


    section.style.setProperty(
        '--closing-shape-teal-y',
        `${progress * 34}px`
    );


    // ================================================
    // NARANJA
    // ================================================

    section.style.setProperty(
        '--closing-shape-orange-x',
        `${progress * 46}px`
    );


    section.style.setProperty(
        '--closing-shape-orange-y',
        `${progress * -36}px`
    );


    // ================================================
    // LAVANDA
    // ================================================

    section.style.setProperty(
        '--closing-shape-lavender-x',
        `${progress * -44}px`
    );


    section.style.setProperty(
        '--closing-shape-lavender-y',
        `${progress * -38}px`
    );

}


// ====================================================
// PREPARAR RUTA
// ====================================================

function prepareRoute(
    state
) {

    if (!state.routePath) {
        return;
    }


    state.routePath.style.strokeDasharray =
        '1';


    state.routePath.style.strokeDashoffset =
        '1';


    if (state.plane) {

        state.plane.style.opacity =
            '0';

    }

}


// ====================================================
// ACTUALIZAR RUTA
// ====================================================

function updateRoute(
    state,
    progress
) {

    if (!state.routePath) {
        return;
    }


    const routeProgress =
        normalizeRange(
            progress,
            0.16,
            0.90
        );


    // ================================================
    // DIBUJAR RUTA
    // ================================================

    state.routePath.style.strokeDashoffset =
        `${1 -
        routeProgress
        }`;


    // ================================================
    // MOVER AVIÓN
    // ================================================

    updatePlanePosition(
        state.routePath,
        state.plane,
        routeProgress
    );

}


// ====================================================
// MOVER AVIÓN POR LA RUTA
// ====================================================

function updatePlanePosition(
    path,
    plane,
    progress
) {

    if (
        !path ||
        !plane
    ) {
        return;
    }


    // ================================================
    // LONGITUD TOTAL
    // ================================================

    const totalLength =
        path.getTotalLength();


    const currentLength =
        totalLength *
        progress;


    // ================================================
    // PUNTO ACTUAL
    // ================================================

    const point =
        path.getPointAtLength(
            currentLength
        );


    // ================================================
    // PUNTO SIGUIENTE
    // ================================================

    const nextLength =
        Math.min(
            currentLength + 2,
            totalLength
        );


    const nextPoint =
        path.getPointAtLength(
            nextLength
        );


    // ================================================
    // ÁNGULO
    // ================================================

    const angle =
        Math.atan2(
            nextPoint.y -
            point.y,

            nextPoint.x -
            point.x
        ) *
        (
            180 /
            Math.PI
        );


    // ================================================
    // ACTUALIZAR SVG
    // ================================================

    plane.setAttribute(
        'transform',

        `
            translate(
                ${point.x}
                ${point.y}
            )
            rotate(
                ${angle}
            )
        `
    );


    // ================================================
    // APARICIÓN
    // ================================================

    plane.style.opacity =
        `${normalizeRange(
            progress,
            0.01,
            0.08
        )
        }`;

}


// ====================================================
// BARRA DE PROGRESO
// ====================================================

function updateProgressBar(
    progressBar,
    progress
) {

    if (!progressBar) {
        return;
    }


    progressBar.style.height =
        `${progress *
        100
        }%`;

}


// ====================================================
// INDICADOR "SIGUE EXPLORANDO"
// ====================================================

function updateScrollIndicator(
    indicator,
    progress
) {

    if (!indicator) {
        return;
    }


    const visibility =
        1 -
        normalizeRange(
            progress,
            0,
            0.18
        );


    indicator.style.opacity =
        `${visibility}`;


    indicator.style.transform =
        `
            translateX(-50%)
            translateY(
                ${progress * 7}px
            )
        `;

}


// ====================================================
// MOVIMIENTO REDUCIDO
// ====================================================

function showCompleteExperience(
    section
) {

    section.classList.remove(
        'is-active'
    );


    section.classList.remove(
        'is-complete'
    );


    // ================================================
    // MOSTRAR ELEMENTOS
    // ================================================

    section
        .querySelectorAll(
            '[data-closing-reveal]'
        )
        .forEach(
            (element) => {

                element.style.opacity =
                    '1';


                element.style.transform =
                    'none';


                element.style.pointerEvents =
                    'auto';

            }
        );


    // ================================================
    // COMPLETAR RUTA
    // ================================================

    const route =
        section.querySelector(
            '[data-closing-route-path]'
        );


    const plane =
        section.querySelector(
            '[data-closing-plane]'
        );


    if (route) {

        route.style.strokeDasharray =
            '1';


        route.style.strokeDashoffset =
            '0';


        updatePlanePosition(
            route,
            plane,
            1
        );

    }


    // ================================================
    // COMPLETAR PROGRESO
    // ================================================

    const progressBar =
        section.querySelector(
            '[data-closing-progress-bar]'
        );


    if (progressBar) {

        progressBar.style.height =
            '100%';

    }


    // ================================================
    // OCULTAR INDICADOR
    // ================================================

    const scrollIndicator =
        section.querySelector(
            '[data-closing-scroll-indicator]'
        );


    if (scrollIndicator) {

        scrollIndicator.style.display =
            'none';

    }

}


// ====================================================
// NORMALIZAR RANGO
// ====================================================

function normalizeRange(
    value,
    start,
    end
) {

    if (
        end <=
        start
    ) {

        return (
            value >= end
                ? 1
                : 0
        );

    }


    return clamp(
        (
            value -
            start
        ) /
        (
            end -
            start
        ),
        0,
        1
    );

}


// ====================================================
// SUAVIZADO
// ====================================================

function easeOutCubic(
    value
) {

    return (
        1 -
        Math.pow(
            1 -
            value,
            3
        )
    );

}


// ====================================================
// LIMITAR VALORES
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