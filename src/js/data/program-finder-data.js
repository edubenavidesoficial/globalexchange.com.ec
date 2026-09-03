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
// - Reglas de edad.
// - Reglas de destino.
// - Motor de compatibilidad.
//
// IMPORTANTE:
//
// El Finder diferencia:
//
// 1. REGLAS CONFIRMADAS
//    Datos explícitos existentes en las páginas.
//
// 2. REGLAS OPERATIVAS
//    Se utilizan para filtrar y evitar mostrar
//    programas evidentemente inadecuados.
//
//    Estas reglas siguen apareciendo como
//    "Requisitos por confirmar" en la interfaz.
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
// PROGRAMAS
// ====================================================
//
// destinationMode:
//
// known
//     Tenemos una lista concreta de destinos.
//
// review
//     El programa dispone de más destinos o todavía
//     no tenemos una matriz exhaustiva.
//
// ageMode:
//
// known
//     Edad documentada.
//
// operational
//     Edad utilizada por el Finder como filtro,
//     pero pendiente de confirmación oficial.
//
// destination
//     La edad depende del país.
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


        /*
         * Global Exchange comunica 76 destinos.
         *
         * Por esa razón no usamos la lista corta
         * de algunos componentes como una lista
         * exhaustiva.
         */

        destinationMode:
            'review',

        destinations:
            [],


        /*
         * Regla operativa amplia.
         *
         * Los contenidos actuales son contradictorios:
         * aparece "No hay límite de edad" y también
         * "18 años en adelante".
         *
         * No bloqueamos a menores automáticamente.
         */

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


        /*
         * Países presentes actualmente en la
         * página Programa de Escolaridad.
         */

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


        /*
         * Regla operativa.
         *
         * La página habla de primero, segundo
         * y tercero de bachillerato, pero no
         * proporciona una edad numérica oficial.
         */

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


        /*
         * Destinos presentes en la página
         * actual de Summer Camps.
         */

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


        /*
         * Regla operativa.
         *
         * La página establece expresamente que
         * los requisitos dependen del país,
         * edad y duración.
         */

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


        /*
         * Países mencionados actualmente en
         * los contenidos de Universidad.
         */

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


        /*
         * Regla operativa para ingreso
         * a estudios superiores.
         */

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


        /*
         * Destinos presentes en la página
         * actual de Pasantías.
         */

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


        /*
         * La página exige bachillerato terminado,
         * B2 y experiencia laboral.
         *
         * El mínimo de 18 se utiliza únicamente
         * como regla operativa del Finder.
         */

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


        /*
         * Todavía no tenemos una lista exhaustiva
         * de destinos dentro de la página propia.
         */

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


        /*
         * En estos cinco países sí disponemos
         * de edades explícitas.
         */

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


        /*
         * Para los demás países del programa
         * mantenemos una regla operativa.
         */

        fallbackAge: {

            min:
                18,

            max:
                29,

            verified:
                false

        },


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
    //
    // No participa en el Finder internacional.
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
//
// Tu select actual envía:
// "12"
// "13"
// "14"
// ...
// "29"
//
// También dejamos compatibilidad con:
// "30-plus"
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

        age >=
        rule.min &&

        age <=
        rule.max

    );

}


// ====================================================
// EVALUAR DESTINO
// ====================================================

function evaluateDestination(
    program,
    destination
) {

    // ================================================
    // DESTINO POR CONFIRMAR
    // ================================================

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


    // ================================================
    // LISTA CONOCIDA
    // ================================================

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

    // ================================================
    // EDAD SEGÚN DESTINO
    // ================================================

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


    // ================================================
    // EDAD GENERAL
    // ================================================

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


    /*
     * Si no existe ninguna regla de edad,
     * el programa no entra automáticamente
     * en los resultados.
     */

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
// MOTOR PRINCIPAL
// ====================================================

export function findProgramsForProfile({
    age,
    destination
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
                        ageResult.message

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
            // CONFIRMADOS PRIMERO
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
            // PRIORIDAD EDITORIAL
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