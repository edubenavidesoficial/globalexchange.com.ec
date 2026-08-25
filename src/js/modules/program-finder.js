// ====================================================
// PROGRAM FINDER
//
// Archivo:
// src/js/modules/program-finder.js
//
// Descripción:
// Valida los filtros iniciales del buscador.
// ====================================================


export function initProgramFinder() {

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


    const fields = {
        age: form.querySelector('#program-age'),
        city: form.querySelector('#program-city'),
        destination:
            form.querySelector('#program-destination')
    };


    /* ==========================================
       MOSTRAR ERROR
    ========================================== */

    function showError(field, message) {

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
            form.querySelector(
                `[data-error-for="${field.id}"]`
            );


        if (error) {
            error.textContent = message;
        }

    }


    /* ==========================================
       LIMPIAR ERROR
    ========================================== */

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
            form.querySelector(
                `[data-error-for="${field.id}"]`
            );


        if (error) {
            error.textContent = '';
        }

    }


    /* ==========================================
       VALIDAR
    ========================================== */

    function validateForm() {

        let isValid = true;


        Object.values(fields)
            .forEach(clearError);


        if (!fields.age.value) {

            showError(
                fields.age,
                'Selecciona tu edad.'
            );

            isValid = false;

        }


        if (!fields.city.value) {

            showError(
                fields.city,
                'Selecciona tu ciudad.'
            );

            isValid = false;

        }


        if (!fields.destination.value) {

            showError(
                fields.destination,
                'Selecciona el lugar que te interesa.'
            );

            isValid = false;

        }


        return isValid;

    }


    /* ==========================================
       LIMPIAR AL CAMBIAR
    ========================================== */

    Object.values(fields)
        .forEach((field) => {

            field.addEventListener(
                'change',
                () => {

                    clearError(field);

                    status.textContent = '';
                    status.className =
                        'program-finder__status';

                }
            );

        });


    /* ==========================================
       ENVÍO
    ========================================== */

    form.addEventListener(
        'submit',
        (event) => {

            event.preventDefault();


            status.textContent = '';

            status.className =
                'program-finder__status';


            if (!validateForm()) {

                status.textContent =
                    'Completa los tres campos para continuar.';

                status.classList.add(
                    'is-error'
                );


                form
                    .querySelector('.is-invalid')
                    ?.focus();


                return;

            }


            const age =
                fields.age.value;


            const city =
                fields.city.value;


            const destination =
                fields.destination.value;


            console.log(
                'Búsqueda de programa:',
                {
                    age,
                    city,
                    destination
                }
            );


            status.textContent =
                'Perfecto. Estamos preparando las opciones que mejor se adaptan a ti.';


            status.classList.add(
                'is-success'
            );

        }
    );

}