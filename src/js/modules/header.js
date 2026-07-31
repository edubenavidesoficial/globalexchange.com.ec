// ====================================================
// HEADER.JS
// Interacciones del encabezado
// ====================================================

export function initHeader() {
    const header = document.querySelector('.header');

    if (!header) {
        return;
    }

    const navigation = header.querySelector('.header__nav');

    const mobileToggle = header.querySelector(
        '.header__mobile-toggle'
    );

    const dropdownToggles = header.querySelectorAll(
        '.header__dropdown-toggle'
    );

    const nestedToggles = header.querySelectorAll(
        '.header__nested-toggle'
    );

    const language = header.querySelector(
        '.header__language'
    );

    const languageToggle = header.querySelector(
        '.header__language-toggle'
    );

    const search = header.querySelector(
        '.header__search'
    );

    const searchToggle = header.querySelector(
        '.header__search-toggle'
    );

    const searchInput = header.querySelector(
        '.header__search-input'
    );

    /**
     * Cierra los submenús principales y anidados.
     */
    function closeDropdowns() {
        dropdownToggles.forEach((toggle) => {
            toggle.setAttribute(
                'aria-expanded',
                'false'
            );

            const menuItem = toggle.closest(
                '.header__menu-item'
            );

            menuItem?.classList.remove('is-open');
        });

        nestedToggles.forEach((toggle) => {
            toggle.setAttribute(
                'aria-expanded',
                'false'
            );

            const submenuItem = toggle.closest(
                '.header__submenu-item--nested'
            );

            submenuItem?.classList.remove('is-open');
        });
    }

    /**
     * Cierra el selector de idioma.
     */
    function closeLanguage() {
        if (!language || !languageToggle) {
            return;
        }

        language.classList.remove('is-open');

        languageToggle.setAttribute(
            'aria-expanded',
            'false'
        );
    }

    /**
     * Cierra el buscador.
     */
    function closeSearch() {
        if (!search || !searchToggle) {
            return;
        }

        search.classList.remove('is-open');

        searchToggle.setAttribute(
            'aria-expanded',
            'false'
        );
    }

    /**
     * Cierra la navegación móvil.
     */
    function closeMobileNavigation() {
        if (!navigation || !mobileToggle) {
            return;
        }

        navigation.classList.remove('is-open');
        mobileToggle.classList.remove('is-open');

        mobileToggle.setAttribute(
            'aria-expanded',
            'false'
        );

        mobileToggle.setAttribute(
            'aria-label',
            'Abrir menú'
        );
    }

    /**
     * Burger.
     *
     * En escritorio se conserva como elemento visual.
     * En tablet y móvil abre la navegación.
     */
    mobileToggle?.addEventListener('click', () => {
        if (window.innerWidth > 1024) {
            return;
        }

        const isOpen = navigation?.classList.toggle(
            'is-open'
        );

        mobileToggle.classList.toggle(
            'is-open',
            Boolean(isOpen)
        );

        mobileToggle.setAttribute(
            'aria-expanded',
            String(Boolean(isOpen))
        );

        mobileToggle.setAttribute(
            'aria-label',
            isOpen ? 'Cerrar menú' : 'Abrir menú'
        );

        closeLanguage();
        closeSearch();
    });

    /**
     * Desplegables principales.
     */
    dropdownToggles.forEach((toggle) => {
        toggle.addEventListener('click', (event) => {
            event.stopPropagation();

            const menuItem = toggle.closest(
                '.header__menu-item'
            );

            if (!menuItem) {
                return;
            }

            const willOpen = !menuItem.classList.contains(
                'is-open'
            );

            closeDropdowns();

            if (willOpen) {
                menuItem.classList.add('is-open');

                toggle.setAttribute(
                    'aria-expanded',
                    'true'
                );
            }
        });
    });

    /**
     * Submenús anidados.
     */
    nestedToggles.forEach((toggle) => {
        toggle.addEventListener('click', (event) => {
            event.stopPropagation();

            const submenuItem = toggle.closest(
                '.header__submenu-item--nested'
            );

            if (!submenuItem) {
                return;
            }

            const isOpen = submenuItem.classList.toggle(
                'is-open'
            );

            toggle.setAttribute(
                'aria-expanded',
                String(isOpen)
            );
        });
    });

    /**
     * Idiomas.
     */
    languageToggle?.addEventListener('click', (event) => {
        event.stopPropagation();

        const isOpen = language?.classList.toggle(
            'is-open'
        );

        languageToggle.setAttribute(
            'aria-expanded',
            String(Boolean(isOpen))
        );

        closeSearch();
        closeDropdowns();
    });

    /**
     * Buscador.
     */
    searchToggle?.addEventListener('click', (event) => {
        event.stopPropagation();

        const isOpen = search?.classList.toggle(
            'is-open'
        );

        searchToggle.setAttribute(
            'aria-expanded',
            String(Boolean(isOpen))
        );

        closeLanguage();
        closeDropdowns();

        if (isOpen) {
            window.setTimeout(() => {
                searchInput?.focus();
            }, 100);
        }
    });

    search?.addEventListener('click', (event) => {
        event.stopPropagation();
    });

    language?.addEventListener('click', (event) => {
        event.stopPropagation();
    });

    /**
     * Cierra paneles al hacer clic fuera.
     */
    document.addEventListener('click', () => {
        closeDropdowns();
        closeLanguage();
        closeSearch();
    });

    /**
     * Cierra con Escape.
     */
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') {
            return;
        }

        closeDropdowns();
        closeLanguage();
        closeSearch();
        closeMobileNavigation();
    });

    /**
     * Cierra el menú móvil al pulsar un enlace.
     */
    navigation?.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 1024) {
                closeMobileNavigation();
            }
        });
    });

    /**
     * Limpia estados al volver a escritorio.
     */
    window.addEventListener('resize', () => {
        if (window.innerWidth > 1024) {
            closeMobileNavigation();
            closeDropdowns();
        }
    });
}