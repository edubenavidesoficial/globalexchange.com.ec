// ====================================================
// FLOATING CONTACT
// ====================================================

export function initFloatingContact() {
    const widget = document.querySelector(
        '[data-floating-contact]'
    );

    if (!widget) {
        return;
    }

    const toggle = widget.querySelector(
        '.floating-contact__toggle'
    );

    const menu = widget.querySelector(
        '.floating-contact__menu'
    );

    if (!toggle || !menu) {
        return;
    }

    function openWidget() {
        widget.classList.add('is-open');

        toggle.setAttribute('aria-expanded', 'true');
        toggle.setAttribute(
            'aria-label',
            'Cerrar opciones de contacto'
        );

        menu.setAttribute('aria-hidden', 'false');
    }

    function closeWidget() {
        widget.classList.remove('is-open');

        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute(
            'aria-label',
            'Abrir opciones de contacto'
        );

        menu.setAttribute('aria-hidden', 'true');
    }

    toggle.addEventListener('click', () => {
        if (widget.classList.contains('is-open')) {
            closeWidget();
        } else {
            openWidget();
        }
    });

    document.addEventListener('click', (event) => {
        if (!widget.contains(event.target)) {
            closeWidget();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeWidget();
            toggle.focus();
        }
    });
}