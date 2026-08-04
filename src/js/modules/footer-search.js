// ====================================================
// FOOTER SEARCH
// Buscador desplegable del footer
// ====================================================

export function initFooterSearch() {
    const wrapper = document.querySelector('.footer__search-wrapper');

    if (!wrapper) {
        return;
    }

    const toggle = wrapper.querySelector('.footer__search-toggle');
    const panel = wrapper.querySelector('.footer__search-panel');
    const input = wrapper.querySelector('.footer__search-input');

    if (!toggle || !panel || !input) {
        return;
    }

    function openSearch() {
        wrapper.classList.add('is-open');

        toggle.setAttribute('aria-expanded', 'true');
        toggle.setAttribute('aria-label', 'Cerrar buscador');

        panel.setAttribute('aria-hidden', 'false');

        window.setTimeout(() => {
            input.focus();
        }, 250);
    }

    function closeSearch() {
        wrapper.classList.remove('is-open');

        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Abrir buscador');

        panel.setAttribute('aria-hidden', 'true');
    }

    toggle.addEventListener('click', () => {
        const isOpen = wrapper.classList.contains('is-open');

        if (isOpen) {
            closeSearch();
        } else {
            openSearch();
        }
    });

    document.addEventListener('click', (event) => {
        if (!wrapper.contains(event.target)) {
            closeSearch();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeSearch();
            toggle.focus();
        }
    });
}