// ====================================================
// CONTACT FORM
// Validación propia para Vite
// ====================================================

export function initContactForm() {
    const form = document.querySelector('[data-contact-form]');

    if (!form) {
        return;
    }

    const status = form.querySelector('[data-contact-status]');
    const submitButton = form.querySelector('.contact__submit');

    const fields = {
        name: form.querySelector('#contact-name'),
        email: form.querySelector('#contact-email'),
        phone: form.querySelector('#contact-phone'),
        website: form.querySelector('#contact-website'),
        message: form.querySelector('#contact-message')
    };

    function showError(field, message) {
        if (!field) {
            return;
        }

        field.classList.add('is-invalid');
        field.setAttribute('aria-invalid', 'true');

        const error = form.querySelector(
            `[data-error-for="${field.id}"]`
        );

        if (error) {
            error.textContent = message;
        }
    }

    function clearError(field) {
        if (!field) {
            return;
        }

        field.classList.remove('is-invalid');
        field.setAttribute('aria-invalid', 'false');

        const error = form.querySelector(
            `[data-error-for="${field.id}"]`
        );

        if (error) {
            error.textContent = '';
        }
    }

    function isValidEmail(value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }

    function isValidUrl(value) {
        if (!value) {
            return true;
        }

        try {
            new URL(value);
            return true;
        } catch {
            return false;
        }
    }

    function validateForm() {
        let isValid = true;

        Object.values(fields).forEach(clearError);

        if (!fields.name.value.trim()) {
            showError(
                fields.name,
                'Escribe tu nombre.'
            );

            isValid = false;
        }

        if (!fields.email.value.trim()) {
            showError(
                fields.email,
                'Escribe tu correo electrónico.'
            );

            isValid = false;
        } else if (!isValidEmail(fields.email.value.trim())) {
            showError(
                fields.email,
                'Escribe un correo electrónico válido.'
            );

            isValid = false;
        }

        if (
            fields.website.value.trim() &&
            !isValidUrl(fields.website.value.trim())
        ) {
            showError(
                fields.website,
                'Incluye una dirección completa, por ejemplo https://sitio.com.'
            );

            isValid = false;
        }

        if (!fields.message.value.trim()) {
            showError(
                fields.message,
                'Escribe un mensaje.'
            );

            isValid = false;
        }

        return isValid;
    }

    Object.values(fields).forEach((field) => {
        if (!field) {
            return;
        }

        field.addEventListener('input', () => {
            clearError(field);
        });
    });

    form.addEventListener('submit', (event) => {
        event.preventDefault();

        status.textContent = '';
        status.className = 'contact__status';

        if (!validateForm()) {
            status.textContent =
                'Revisa los campos marcados antes de continuar.';

            status.classList.add('is-error');

            form.querySelector('.is-invalid')?.focus();

            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = 'Enviando…';

        /*
         * Simulación temporal.
         *
         * Aquí se conectará después el formulario
         * con un backend, API o servicio de correo.
         */

        window.setTimeout(() => {
            status.textContent =
                'Formulario validado correctamente. El envío real se conectará en la fase de integración.';

            status.classList.add('is-success');

            form.reset();

            submitButton.disabled = false;
            submitButton.textContent = 'Enviar mensaje';
        }, 600);
    });
}