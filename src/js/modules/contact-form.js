// ====================================================
// CONTACT FORM
//
// Archivo:
// src/js/modules/contact-form.js
//
// Proyecto:
// Global Exchange - Migración a Vite
//
// Responsabilidad:
// - Validar el formulario de contacto.
// - Mostrar errores por campo.
// - Internacionalizar mensajes dinámicos.
// - Simular temporalmente el envío.
// - Preparar la integración futura con backend.
// ====================================================

import i18next from '../../languages/i18n.js';


export function initContactForm() {

    const form =
        document.querySelector(
            '[data-contact-form]'
        );


    if (!form) {
        return;
    }


    const status =
        form.querySelector(
            '[data-contact-status]'
        );


    const submitButton =
        form.querySelector(
            '.contact__submit'
        );


    // =================================================
    // CAMPOS
    // =================================================

    const fields = {

        firstName:
            form.querySelector(
                '#contact-name'
            ),

        lastName:
            form.querySelector(
                '#contact-last-name'
            ),

        email:
            form.querySelector(
                '#contact-email'
            ),

        phone:
            form.querySelector(
                '#contact-phone'
            ),

        message:
            form.querySelector(
                '#contact-message'
            )

    };


    // =================================================
    // MOSTRAR ERROR
    // =================================================

    function showError(
        field,
        translationKey
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
            form.querySelector(
                `[data-error-for="${field.id}"]`
            );


        if (!error) {
            return;
        }


        error.dataset.i18nErrorKey =
            translationKey;


        error.textContent =
            i18next.t(
                translationKey
            );

    }


    // =================================================
    // LIMPIAR ERROR
    // =================================================

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


        if (!error) {
            return;
        }


        error.textContent = '';

        delete error.dataset.i18nErrorKey;

    }


    // =================================================
    // ESTADO DEL FORMULARIO
    // =================================================

    function setStatus(
        translationKey,
        type = ''
    ) {

        if (!status) {
            return;
        }


        status.textContent =
            translationKey
                ? i18next.t(translationKey)
                : '';


        status.className =
            'contact__status';


        if (type) {

            status.classList.add(
                type
            );

        }


        if (translationKey) {

            status.dataset.i18nStatusKey =
                translationKey;

        } else {

            delete status.dataset.i18nStatusKey;

        }

    }


    // =================================================
    // VALIDAR CORREO
    // =================================================

    function isValidEmail(value) {

        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            .test(value);

    }


    // =================================================
    // VALIDAR FORMULARIO
    // =================================================

    function validateForm() {

        let isValid = true;


        Object
            .values(fields)
            .forEach(clearError);


        // =============================================
        // NOMBRE
        // =============================================

        if (
            !fields.firstName
                .value
                .trim()
        ) {

            showError(
                fields.firstName,
                'contact.validation.firstNameRequired'
            );

            isValid = false;

        }


        // =============================================
        // APELLIDO
        // =============================================

        if (
            !fields.lastName
                .value
                .trim()
        ) {

            showError(
                fields.lastName,
                'contact.validation.lastNameRequired'
            );

            isValid = false;

        }


        // =============================================
        // CORREO
        // =============================================

        const email =
            fields.email
                .value
                .trim();


        if (!email) {

            showError(
                fields.email,
                'contact.validation.emailRequired'
            );

            isValid = false;

        } else if (
            !isValidEmail(email)
        ) {

            showError(
                fields.email,
                'contact.validation.emailInvalid'
            );

            isValid = false;

        }


        // =============================================
        // MENSAJE
        // =============================================

        if (
            !fields.message
                .value
                .trim()
        ) {

            showError(
                fields.message,
                'contact.validation.messageRequired'
            );

            isValid = false;

        }


        return isValid;
    }


    // =================================================
    // ACTUALIZAR MENSAJES DINÁMICOS AL CAMBIAR IDIOMA
    // =================================================

    function updateDynamicMessages() {

        form
            .querySelectorAll(
                '[data-i18n-error-key]'
            )
            .forEach((error) => {

                const key =
                    error.dataset.i18nErrorKey;


                if (!key) {
                    return;
                }


                error.textContent =
                    i18next.t(key);

            });


        if (
            status &&
            status.dataset.i18nStatusKey
        ) {

            status.textContent =
                i18next.t(
                    status.dataset.i18nStatusKey
                );

        }


        if (submitButton) {

            submitButton.textContent =
                submitButton.disabled
                    ? i18next.t(
                        'contact.form.sending'
                    )
                    : i18next.t(
                        'contact.form.submit'
                    );

        }

    }


    // =================================================
    // LIMPIAR ERROR AL ESCRIBIR
    // =================================================

    Object
        .values(fields)
        .forEach((field) => {

            if (!field) {
                return;
            }


            field.addEventListener(
                'input',
                () => {

                    clearError(field);

                }
            );

        });


    // =================================================
    // CAMBIO DE IDIOMA
    // =================================================

    i18next.on(
        'languageChanged',
        updateDynamicMessages
    );


    // =================================================
    // ENVÍO
    // =================================================

    form.addEventListener(
        'submit',
        (event) => {

            event.preventDefault();


            setStatus('');


            // =========================================
            // VALIDACIÓN
            // =========================================

            if (!validateForm()) {

                setStatus(
                    'contact.status.invalid',
                    'is-error'
                );


                form
                    .querySelector(
                        '.is-invalid'
                    )
                    ?.focus();


                return;
            }


            // =========================================
            // ESTADO ENVIANDO
            // =========================================

            if (submitButton) {

                submitButton.disabled =
                    true;


                submitButton.textContent =
                    i18next.t(
                        'contact.form.sending'
                    );

            }


            /*
             * Simulación temporal.
             *
             * Aquí se conectará posteriormente
             * el formulario con un backend,
             * API o servicio de correo.
             */

            window.setTimeout(
                () => {

                    setStatus(
                        'contact.status.success',
                        'is-success'
                    );


                    form.reset();


                    Object
                        .values(fields)
                        .forEach(clearError);


                    if (submitButton) {

                        submitButton.disabled =
                            false;


                        submitButton.textContent =
                            i18next.t(
                                'contact.form.submit'
                            );

                    }

                },
                600
            );

        }
    );

}