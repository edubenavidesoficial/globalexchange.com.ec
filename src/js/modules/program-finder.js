// ====================================================
// PROGRAM FINDER
//
// Archivo:
// src/js/modules/program-finder.js
//
// Descripción:
// Gestiona la validación inicial del buscador de
// programas de Global Exchange.
//
// Fase actual:
// - Validación de edad.
// - Validación de ciudad.
// - Validación de destino.
// - Preparado para conectar posteriormente
//   un motor de recomendaciones.
// ====================================================


export function initProgramFinder() {

    // ================================================
    // FORMULARIO
    // ================================================

    const form =
        document.querySelector(
            '[data-program-finder-form]'
        );


    if (!form) {
        return;
    }


    // ================================================
    // ESTADO
    // ================================================

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

        destination:
            form.querySelector(
                '#program-destination'
            )

    };


    // ================================================
    // MENSAJES
    // ================================================

    const validationMessages = {

        age:
            'Selecciona tu edad.',

        city:
            'Selecciona tu ciudad.',

        destination:
            'Selecciona el lugar que te interesa.',

        incomplete:
            'Completa los tres campos para continuar.',

        success:
            'Perfecto. Estamos preparando las opciones que mejor se adaptan a ti.'

    };


    // ================================================
    // OBTENER MENSAJE DE ERROR
    // ================================================

    function getErrorElement(field) {

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
            getErrorElement(field);


        if (error) {
            error.textContent = message;
        }

    }


    // ================================================
    // LIMPIAR ERROR
    // ================================================

    function clearError(field) {

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
            getErrorElement(field);


        if (error) {
            error.textContent = '';
        }

    }


    // ================================================
    // LIMPIAR ESTADO
    // ================================================

    function clearStatus() {

        if (!status) {
            return;
        }


        status.textContent = '';

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


        status.textContent = message;

        status.className =
            'program-finder__status';


        if (type) {

            status.classList.add(
                `is-${type}`
            );

        }

    }


    // ================================================
    // VALIDAR FORMULARIO
    // ================================================

    function validateForm() {

        let isValid = true;


        Object
            .values(fields)
            .forEach(clearError);


        if (!fields.age?.value) {

            showError(
                fields.age,
                validationMessages.age
            );

            isValid = false;

        }


        if (!fields.city?.value) {

            showError(
                fields.city,
                validationMessages.city
            );

            isValid = false;

        }


        if (!fields.destination?.value) {

            showError(
                fields.destination,
                validationMessages.destination
            );

            isValid = false;

        }


        return isValid;

    }


    // ================================================
    // ESCUCHAR CAMBIOS
    // ================================================

    Object
        .values(fields)
        .filter(Boolean)
        .forEach((field) => {

            field.addEventListener(
                'change',
                () => {

                    clearError(field);

                    clearStatus();

                }
            );

        });


    // ================================================
    // ENVÍO
    // ================================================

    form.addEventListener(
        'submit',
        (event) => {

            event.preventDefault();


            clearStatus();


            if (!validateForm()) {

                showStatus(
                    validationMessages.incomplete,
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
            // DATOS SELECCIONADOS
            // ========================================

            const filters = {

                age:
                    fields.age.value,

                city:
                    fields.city.value,

                destination:
                    fields.destination.value

            };


            console.log(
                'Program Finder:',
                filters
            );


            // ========================================
            // RESPUESTA TEMPORAL
            //
            // En una siguiente etapa este punto
            // conectará con la lógica real para
            // recomendar programas.
            // ========================================

            showStatus(
                validationMessages.success,
                'success'
            );

        }
    );

}