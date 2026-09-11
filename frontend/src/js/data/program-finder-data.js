// ====================================================
// PROGRAM FINDER DATA
//
// Archivo:
// src/js/data/program-finder-data.js
//
// Proyecto:
// Global Exchange - Migración a Vite
//
// Responsabilidades:
// - Información de programas.
// - Destinos.
// - Ciudades.
// - Áreas profesionales.
// - Reglas de edad.
// - Reglas de destino.
// - Afinidad profesional.
// - Motor de recomendaciones.
//
// IMPORTANTE:
//
// EDAD + DESTINO
// determinan si el programa puede mostrarse.
//
// ÁREA PROFESIONAL
// no elimina programas.
//
// Se utiliza como criterio de afinidad para ordenar
// los resultados.
//
// La afinidad profesional es orientativa y no
// representa una garantía de disponibilidad de una
// carrera específica.
// ====================================================


// ====================================================
// EDAD SIN LÍMITE SUPERIOR
// ====================================================

const NO_MAX_AGE =
    Number.POSITIVE_INFINITY;


// ====================================================
// DESTINOS
// ====================================================

export const PROGRAM_FINDER_DESTINATIONS = {

    alemania:
        'Alemania',

    australia:
        'Australia',

    austria:
        'Austria',

    belgica:
        'Bélgica',

    canada:
        'Canadá',

    china:
        'China',

    espana:
        'España',

    'estados-unidos':
        'Estados Unidos',

    francia:
        'Francia',

    holanda:
        'Holanda',

    italia:
        'Italia',

    liechtenstein:
        'Liechtenstein',

    noruega:
        'Noruega',

    'reino-unido':
        'Reino Unido',

    suiza:
        'Suiza'

};


// ====================================================
// CIUDADES
// ====================================================

export const PROGRAM_FINDER_CITIES = {

    quito:
        'Quito',

    guayaquil:
        'Guayaquil',

    cuenca:
        'Cuenca',

    otra:
        'Otra ciudad'

};


// ====================================================
// ÁREAS PROFESIONALES
// ====================================================

export const PROGRAM_FINDER_PROFESSIONS = {

    'sin-definir':
        'Aún no lo tengo claro',

    'administracion-negocios':
        'Administración y Negocios',

    'arquitectura-diseno':
        'Arquitectura y Diseño',

    ciencias:
        'Ciencias',

    'comunicacion-marketing':
        'Comunicación y Marketing',

    'derecho-sociales':
        'Derecho y Ciencias Sociales',

    educacion:
        'Educación',

    ingenieria:
        'Ingeniería',

    'informatica-tecnologia':
        'Informática y Tecnología',

    'medicina-salud':
        'Medicina y Salud',

    'turismo-hoteleria':
        'Turismo y Hotelería',

    artes:
        'Artes',

    idiomas:
        'Idiomas',

    otra:
        'Otra área'

};


// ====================================================
// PROGRAMAS
// ====================================================

export const PROGRAM_FINDER_PROGRAMS = [


    // =================================================
    // 01 · PROGRAMA IDIOMÁTICO
    // =================================================

    {

        id:
            'programa-idiomatico',

        name:
            'Programa idiomático',

        category:
            'Idiomas',

        description:
            'Aprende o perfecciona un idioma mientras vives una experiencia internacional y descubres una nueva cultura.',

        image:
            '/images/pages/cursos-de-idiomas-en-el-extranjero-2/clases-local.jpg',

        url:
            '/pages/cursos-de-idiomas-en-el-extranjero-2/',

        color:
            'blue',

        destinationMode:
            'review',

        destinations:
            [],

        ageMode:
            'operational',

        age: {

            min:
                12,

            max:
                NO_MAX_AGE

        },

        ageVerified:
            false,


        /*
         * El idioma puede complementar cualquier
         * trayectoria profesional.
         *
         * Si el interés principal es Idiomas,
         * su afinidad aumenta.
         */

        professionMode:
            'language',

        features: [

            '4 a 48 semanas',

            'Cursos generales e intensivos',

            'Cursos especializados'

        ],

        priority:
            100

    },


    // =================================================
    // 02 · ESCOLARIDAD
    // =================================================

    {

        id:
            'escolaridad',

        name:
            'Escolaridad',

        category:
            'Intercambio estudiantil',

        description:
            'Vive una experiencia escolar en el exterior mientras te sumerges en la cultura y el idioma del país de destino.',

        image:
            '/images/pages/summer-camps/summer-camp-2.jpg',

        url:
            '/pages/programa-escolar/',

        color:
            'pink',

        destinationMode:
            'known',

        destinations: [

            'alemania',
            'australia',
            'austria',
            'belgica',
            'canada',
            'china',
            'estados-unidos',
            'francia',
            'holanda',
            'italia',
            'liechtenstein',
            'reino-unido',
            'suiza'

        ],

        ageMode:
            'operational',

        age: {

            min:
                14,

            max:
                18

        },

        ageVerified:
            false,

        professionMode:
            'exploratory',

        features: [

            '1 trimestre',
            '1 quimestre',
            '1 año escolar'

        ],

        priority:
            95

    },


    // =================================================
    // 03 · SUMMER CAMP
    // =================================================

    {

        id:
            'summer-camp',

        name:
            'Summer Camp',

        category:
            'Aventura & cultura',

        description:
            'Descubre una experiencia internacional diseñada para combinar aprendizaje, cultura y nuevas experiencias.',

        image:
            '/images/pages/summer-camps/summer-camp-destinations.jpg',

        url:
            '/pages/summer-camps/',

        color:
            'orange',

        destinationMode:
            'known',

        destinations: [

            'estados-unidos',
            'canada',
            'reino-unido',
            'alemania',
            'francia',
            'italia',
            'holanda',
            'austria'

        ],

        ageMode:
            'operational',

        age: {

            min:
                12,

            max:
                18

        },

        ageVerified:
            false,

        professionMode:
            'exploratory',

        features: [

            'Experiencia internacional',
            'Actividades',
            'Cultura'

        ],

        priority:
            90

    },


    // =================================================
    // 04 · UNIVERSIDADES EN EL EXTERIOR
    // =================================================

    {

        id:
            'universidades',

        name:
            'Universidades en el exterior',

        category:
            'Educación superior',

        description:
            'Explora oportunidades de educación superior en el exterior con acompañamiento durante tu proceso.',

        image:
            '/images/program-finder/program-finder-universidad-exterior.jpg',

        url:
            '/pages/educacion-en-el-exterior/',

        color:
            'purple',

        destinationMode:
            'known',

        destinations: [

            'alemania',
            'australia',
            'austria',
            'belgica',
            'francia',
            'holanda',
            'italia',
            'suiza'

        ],

        ageMode:
            'operational',

        age: {

            min:
                17,

            max:
                NO_MAX_AGE

        },

        ageVerified:
            false,

        professionMode:
            'academic',

        features: [

            'Educación superior',
            'Aplicación',
            'Asesoría'

        ],

        priority:
            80

    },


    // =================================================
    // 05 · PASANTÍAS UNIVERSITARIAS
    // =================================================

    {

        id:
            'pasantias',

        name:
            'Pasantías universitarias',

        category:
            'Experiencia profesional',

        description:
            'Fortalece tu perfil profesional mediante una experiencia internacional vinculada con tu formación.',

        image:
            '/images/program-finder/program-finder-pasantias.jpg',

        url:
            '/pages/pasantias-profesionales/',

        color:
            'teal',

        destinationMode:
            'known',

        destinations: [

            'estados-unidos',
            'canada',
            'reino-unido',
            'alemania',
            'belgica',
            'francia',
            'italia',
            'holanda',
            'austria',
            'suiza'

        ],

        ageMode:
            'operational',

        age: {

            min:
                18,

            max:
                NO_MAX_AGE

        },

        ageVerified:
            false,

        professionMode:
            'professional',

        features: [

            'Experiencia profesional',
            'Nivel B2',
            'Bachillerato terminado'

        ],

        priority:
            75

    },


    // =================================================
    // 06 · AUSBILDUNG
    // =================================================

    {

        id:
            'ausbildung',

        name:
            'Ausbildung',

        category:
            'Formación profesional',

        description:
            'Formación orientada al desarrollo de conocimientos y habilidades profesionales mediante aprendizaje y experiencia práctica.',

        image:
            '/images/program-finder/program-finder-ashbuilding.jpg',

        url:
            null,

        color:
            'blue',

        destinationMode:
            'review',

        destinations:
            [],

        ageMode:
            'operational',

        age: {

            min:
                18,

            max:
                NO_MAX_AGE

        },

        ageVerified:
            false,

        professionMode:
            'professional',

        features: [

            'Formación profesional',
            'Experiencia práctica',
            'Formación técnica'

        ],

        priority:
            72

    },


    // =================================================
    // 07 · EDUCACIÓN DUAL
    // =================================================

    {

        id:
            'educacion-dual',

        name:
            'Educación dual',

        category:
            'Estudio + experiencia práctica',

        description:
            'Combina trabajo práctico en una empresa con clases teóricas en una universidad o centro de formación.',

        image:
            '/images/program-finder/program-finder-educacion-dual.jpg',

        url:
            null,

        color:
            'orange',

        destinationMode:
            'known',

        destinations: [

            'alemania',
            'belgica',
            'francia',
            'holanda',
            'austria',
            'china',
            'suiza',
            'australia',
            'liechtenstein',
            'noruega',
            'italia'

        ],

        ageMode:
            'operational',

        age: {

            min:
                18,

            max:
                NO_MAX_AGE

        },

        ageVerified:
            false,

        professionMode:
            'professional',

        features: [

            'Empresa',
            'Formación académica',
            'Teoría + práctica'

        ],

        priority:
            85

    },


    // =================================================
    // 08 · PROGRAMA NANNY
    // =================================================

    {

        id:
            'nanny',

        name:
            'Programa Nanny',

        category:
            'Intercambio cultural',

        description:
            'Vive con una familia anfitriona, desarrolla tu independencia y perfecciona un idioma durante una experiencia cultural.',

        image:
            '/images/pages/programa-nanny/program-finder-nanny.jpg',

        url:
            '/pages/programa-nanny/',

        color:
            'pink',

        destinationMode:
            'known',

        destinations: [

            'alemania',
            'belgica',
            'estados-unidos',
            'francia',
            'holanda',
            'austria',
            'suiza',
            'china',
            'australia',
            'liechtenstein',
            'noruega'

        ],

        ageMode:
            'destination',

        ageByDestination: {

            alemania: {

                min:
                    18,

                max:
                    26,

                verified:
                    true

            },

            belgica: {

                min:
                    18,

                max:
                    26,

                verified:
                    true

            },

            'estados-unidos': {

                min:
                    18,

                max:
                    25,

                verified:
                    true

            },

            francia: {

                min:
                    18,

                max:
                    28,

                verified:
                    true

            },

            holanda: {

                min:
                    18,

                max:
                    28,

                verified:
                    true

            }

        },

        fallbackAge: {

            min:
                18,

            max:
                29,

            verified:
                false

        },

        professionMode:
            'exploratory',

        features: [

            'Familia anfitriona',
            'Alojamiento',
            'Acompañamiento'

        ],

        priority:
            92

    },


    // =================================================
    // 09 · CURSO DE LENGUA LOCAL
    // =================================================

    {

        id:
            'lengua-local',

        name:
            'Curso de lengua local',

        includeInFinder:
            false

    },


    // =================================================
    // 10 · CURSOS ESPECIALES
    // =================================================

    {

        id:
            'cursos-especiales',

        name:
            'Cursos especiales',

        category:
            'Formación especializada',

        description:
            'Programas de formación e idiomas orientados a objetivos académicos y profesionales específicos.',

        image:
            '/images/program-finder/program-finder-cursos-especiales.jpg',

        url:
            null,

        color:
            'purple',

        destinationMode:
            'review',

        destinations:
            [],

        ageMode:
            'operational',

        age: {

            min:
                18,

            max:
                NO_MAX_AGE

        },

        ageVerified:
            false,


        /*
         * Estas áreas proceden de los propios
         * contenidos actuales de Cursos especiales:
         *
         * - Negocios
         * - Diseño
         * - Medicina
         * - Ingeniería
         */

        professionMode:
            'specific',

        professionAreas: [

            'administracion-negocios',
            'arquitectura-diseno',
            'medicina-salud',
            'ingenieria'

        ],

        features: [

            'Negocios',
            'Diseño',
            'Medicina e ingeniería'

        ],

        priority:
            65

    }

];


// ====================================================
// NORMALIZAR EDAD
// ====================================================

export function normalizeProgramFinderAge(
    value
) {

    if (
        value ===
        '30-plus'
    ) {

        return 30;

    }


    const age =
        Number.parseInt(
            value,
            10
        );


    return Number.isFinite(
        age
    )
        ? age
        : null;

}


// ====================================================
// LABEL DESTINO
// ====================================================

export function getDestinationLabel(
    destination
) {

    return (

        PROGRAM_FINDER_DESTINATIONS[
        destination
        ] ||

        destination ||

        'Destino'

    );

}


// ====================================================
// LABEL CIUDAD
// ====================================================

export function getCityLabel(
    city
) {

    return (

        PROGRAM_FINDER_CITIES[
        city
        ] ||

        city ||

        'Ciudad'

    );

}


// ====================================================
// LABEL PROFESIÓN
// ====================================================

export function getProfessionLabel(
    profession
) {

    return (

        PROGRAM_FINDER_PROFESSIONS[
        profession
        ] ||

        profession ||

        'Área profesional'

    );

}


// ====================================================
// FORMATEAR REGLA DE EDAD
// ====================================================

function formatAgeRule(
    rule
) {

    if (!rule) {

        return (
            'Edad por confirmar'
        );

    }


    if (
        !Number.isFinite(
            rule.max
        )
    ) {

        return (
            `${rule.min} años en adelante`
        );

    }


    if (
        rule.min ===
        rule.max
    ) {

        return (
            `${rule.min} años`
        );

    }


    return (
        `${rule.min} a ${rule.max} años`
    );

}


// ====================================================
// COMPROBAR EDAD
// ====================================================

function isAgeInsideRule(
    age,
    rule
) {

    if (
        !Number.isFinite(age) ||
        !rule
    ) {

        return false;

    }


    return (

        age >= rule.min &&
        age <= rule.max

    );

}


// ====================================================
// EVALUAR DESTINO
// ====================================================

function evaluateDestination(
    program,
    destination
) {

    if (
        program.destinationMode ===
        'review'
    ) {

        return {

            matches:
                true,

            verified:
                false,

            message:
                'Disponibilidad del destino por confirmar'

        };

    }


    if (
        program.destinationMode ===
        'known'
    ) {

        const matches =
            program
                .destinations
                .includes(
                    destination
                );


        return {

            matches,

            verified:
                true,

            message:
                matches
                    ? 'Destino disponible'
                    : 'Destino no disponible para este programa'

        };

    }


    return {

        matches:
            false,

        verified:
            false,

        message:
            'Destino por confirmar'

    };

}


// ====================================================
// EVALUAR EDAD
// ====================================================

function evaluateAge(
    program,
    age,
    destination
) {

    if (
        program.ageMode ===
        'destination'
    ) {

        const exactRule =
            program
                .ageByDestination?.[
            destination
            ];


        const rule =
            exactRule ||
            program.fallbackAge;


        if (!rule) {

            return {

                matches:
                    false,

                verified:
                    false,

                message:
                    'Edad para este destino por confirmar'

            };

        }


        const matches =
            isAgeInsideRule(
                age,
                rule
            );


        const verified =
            rule.verified ===
            true;


        const label =
            formatAgeRule(
                rule
            );


        return {

            matches,

            verified,

            message:
                matches
                    ? (
                        verified
                            ? label
                            : `Orientativo: ${label}`
                    )
                    : `Disponible de ${label}`

        };

    }


    if (
        (
            program.ageMode ===
            'known' ||

            program.ageMode ===
            'operational'
        ) &&

        program.age
    ) {

        const matches =
            isAgeInsideRule(
                age,
                program.age
            );


        const verified =
            program.ageMode ===
            'known' ||
            program.ageVerified ===
            true;


        const label =
            formatAgeRule(
                program.age
            );


        return {

            matches,

            verified,

            message:
                matches
                    ? (
                        verified
                            ? label
                            : `Orientativo: ${label}`
                    )
                    : `Disponible de ${label}`

        };

    }


    return {

        matches:
            false,

        verified:
            false,

        message:
            'Edad por confirmar'

    };

}


// ====================================================
// EVALUAR AFINIDAD PROFESIONAL
//
// IMPORTANTE:
//
// Nunca devuelve matches = false.
//
// La profesión NO descarta programas.
//
// El score se utiliza únicamente para ordenar:
//
// 3 = afinidad alta
// 2 = afinidad buena
// 1 = complementario
// 0 = exploración abierta
// ====================================================

function evaluateProfession(
    program,
    profession
) {

    const professionLabel =
        getProfessionLabel(
            profession
        );


    // ================================================
    // USUARIO INDECISO
    // ================================================

    if (
        !profession ||
        profession ===
        'sin-definir' ||
        profession ===
        'otra'
    ) {

        return {

            score:
                0,

            level:
                'open',

            label:
                'Exploración abierta',

            message:
                'No depende de una carrera específica'

        };

    }


    // ================================================
    // IDIOMAS
    // ================================================

    if (
        program.professionMode ===
        'language'
    ) {

        if (
            profession ===
            'idiomas'
        ) {

            return {

                score:
                    3,

                level:
                    'high',

                label:
                    'Alta afinidad',

                message:
                    'Relacionado directamente con tu interés en idiomas'

            };

        }


        return {

            score:
                1,

            level:
                'complementary',

            label:
                'Complementario',

            message:
                'Un idioma puede complementar tu perfil profesional'

        };

    }


    // ================================================
    // UNIVERSIDAD
    // ================================================

    if (
        program.professionMode ===
        'academic'
    ) {

        return {

            score:
                3,

            level:
                'high',

            label:
                'Alta afinidad',

            message:
                `Orientado a continuar estudios en ${professionLabel}`

        };

    }


    // ================================================
    // EXPERIENCIA / FORMACIÓN PROFESIONAL
    // ================================================

    if (
        program.professionMode ===
        'professional'
    ) {

        return {

            score:
                2,

            level:
                'medium',

            label:
                'Buena afinidad',

            message:
                `Puede complementar tu desarrollo en ${professionLabel}`

        };

    }


    // ================================================
    // ÁREAS ESPECÍFICAS
    // ================================================

    if (
        program.professionMode ===
        'specific'
    ) {

        const matches =
            program
                .professionAreas
                ?.includes(
                    profession
                ) ===
            true;


        if (matches) {

            return {

                score:
                    3,

                level:
                    'high',

                label:
                    'Alta afinidad',

                message:
                    `El programa menciona formación relacionada con ${professionLabel}`

            };

        }


        return {

            score:
                1,

            level:
                'complementary',

            label:
                'Afinidad por confirmar',

            message:
                'Consulta las especialidades disponibles con un asesor'

        };

    }


    // ================================================
    // PROGRAMAS EXPLORATORIOS
    // ================================================

    return {

        score:
            0,

        level:
            'open',

        label:
            'Experiencia complementaria',

        message:
            'Este programa no depende de una carrera específica'

    };

}


// ====================================================
// MOTOR PRINCIPAL
// ====================================================

export function findProgramsForProfile({

    age,
    destination,
    profession

}) {

    const numericAge =
        normalizeProgramFinderAge(
            age
        );


    if (
        numericAge === null ||
        !destination
    ) {

        return {

            matches:
                [],

            excluded:
                []

        };

    }


    const matches =
        [];


    const excluded =
        [];


    PROGRAM_FINDER_PROGRAMS

        .filter(
            (program) =>

                program.includeInFinder !==
                false
        )

        .forEach(
            (program) => {


                // ====================================
                // DESTINO
                // ====================================

                const destinationResult =
                    evaluateDestination(
                        program,
                        destination
                    );


                if (
                    !destinationResult.matches
                ) {

                    excluded.push({

                        ...program,

                        reason:
                            'destination',

                        destinationMessage:
                            destinationResult.message

                    });


                    return;

                }


                // ====================================
                // EDAD
                // ====================================

                const ageResult =
                    evaluateAge(
                        program,
                        numericAge,
                        destination
                    );


                if (
                    !ageResult.matches
                ) {

                    excluded.push({

                        ...program,

                        reason:
                            'age',

                        ageMessage:
                            ageResult.message

                    });


                    return;

                }


                // ====================================
                // AFINIDAD PROFESIONAL
                // ====================================

                const professionResult =
                    evaluateProfession(
                        program,
                        profession
                    );


                // ====================================
                // COMPATIBILIDAD
                // ====================================

                const confirmed =
                    destinationResult.verified &&
                    ageResult.verified;


                matches.push({

                    ...program,

                    compatibility:
                        confirmed
                            ? 'confirmed'
                            : 'review',

                    destinationVerified:
                        destinationResult.verified,

                    destinationMessage:
                        destinationResult.message,

                    ageVerified:
                        ageResult.verified,

                    ageMessage:
                        ageResult.message,

                    professionScore:
                        professionResult.score,

                    professionLevel:
                        professionResult.level,

                    professionLabel:
                        professionResult.label,

                    professionMessage:
                        professionResult.message

                });

            }
        );


    // =================================================
    // ORDEN DE RESULTADOS
    // =================================================

    matches.sort(
        (
            first,
            second
        ) => {


            // ----------------------------------------
            // 1. AFINIDAD PROFESIONAL
            // ----------------------------------------

            if (
                first.professionScore !==
                second.professionScore
            ) {

                return (

                    second.professionScore -
                    first.professionScore

                );

            }


            // ----------------------------------------
            // 2. COMPATIBILIDAD CONFIRMADA
            // ----------------------------------------

            if (
                first.compatibility !==
                second.compatibility
            ) {

                return (

                    first.compatibility ===
                        'confirmed'
                        ? -1
                        : 1

                );

            }


            // ----------------------------------------
            // 3. PRIORIDAD EDITORIAL
            // ----------------------------------------

            return (

                (
                    second.priority ||
                    0
                ) -

                (
                    first.priority ||
                    0
                )

            );

        }
    );


    return {

        matches,

        excluded

    };

}