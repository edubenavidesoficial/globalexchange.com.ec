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

    const language = header.querySelector('.header__language');
    const languageToggle = header.querySelector(
        '.header__language-toggle'
    );

    const search = header.querySelector('.header__search');
    const searchToggle = header.querySelector(
        '.header__search-toggle'
    );
    const searchInput = header.querySelector(
        '.header__search-input'
    );

    const drawer = document.querySelector(
        '[data-header-drawer]'
    );
    const drawerBackdrop = document.querySelector(
        '[data-header-drawer-backdrop]'
    );
    const drawerClose = document.querySelector(
        '[data-header-drawer-close]'
    );

    function closeDropdowns() {
        dropdownToggles.forEach((toggle) => {
            toggle.setAttribute('aria-expanded', 'false');

            toggle
                .closest('.header__menu-item')
                ?.classList.remove('is-open');
        });

        nestedToggles.forEach((toggle) => {
            toggle.setAttribute('aria-expanded', 'false');

            toggle
                .closest('.header__submenu-item--nested')
                ?.classList.remove('is-open');
        });
    }

    function closeLanguage() {
        language?.classList.remove('is-open');
        languageToggle?.setAttribute(
            'aria-expanded',
            'false'
        );
    }

    function closeSearch() {
        search?.classList.remove('is-open');
        searchToggle?.setAttribute(
            'aria-expanded',
            'false'
        );
    }

    function closeMobileNavigation() {
        navigation?.classList.remove('is-open');

        if (window.innerWidth <= 1024) {
            mobileToggle?.classList.remove('is-open');
            mobileToggle?.setAttribute(
                'aria-expanded',
                'false'
            );
            mobileToggle?.setAttribute(
                'aria-label',
                'Abrir menú'
            );
        }
    }

    function openDrawer() {
        if (!drawer || !drawerBackdrop || !mobileToggle) {
            return;
        }

        drawer.classList.add('is-open');
        drawerBackdrop.classList.add('is-open');
        document.body.classList.add('header-drawer-open');

        drawer.setAttribute('aria-hidden', 'false');
        drawerBackdrop.setAttribute('aria-hidden', 'false');

        mobileToggle.classList.add('is-open');
        mobileToggle.setAttribute('aria-expanded', 'true');
        mobileToggle.setAttribute(
            'aria-label',
            'Cerrar panel informativo'
        );

        window.setTimeout(() => {
            drawerClose?.focus();
        }, 300);
    }

    function closeDrawer({ returnFocus = false } = {}) {
        if (!drawer || !drawerBackdrop || !mobileToggle) {
            return;
        }

        drawer.classList.remove('is-open');
        drawerBackdrop.classList.remove('is-open');
        document.body.classList.remove('header-drawer-open');

        drawer.setAttribute('aria-hidden', 'true');
        drawerBackdrop.setAttribute('aria-hidden', 'true');

        mobileToggle.classList.remove('is-open');
        mobileToggle.setAttribute('aria-expanded', 'false');
        mobileToggle.setAttribute(
            'aria-label',
            'Abrir panel informativo'
        );

        if (returnFocus) {
            mobileToggle.focus();
        }
    }

    mobileToggle?.addEventListener('click', () => {
        closeLanguage();
        closeSearch();
        closeDropdowns();

        /*
         * En escritorio abre el panel lateral.
         */
        if (window.innerWidth > 1024) {
            const isOpen = drawer?.classList.contains(
                'is-open'
            );

            if (isOpen) {
                closeDrawer();
            } else {
                openDrawer();
            }

            return;
        }

        /*
         * En tablet y móvil abre la navegación.
         */
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
    });

    drawerClose?.addEventListener('click', () => {
        closeDrawer({ returnFocus: true });
    });

    drawerBackdrop?.addEventListener('click', () => {
        closeDrawer();
    });

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

    nestedToggles.forEach((toggle) => {
        toggle.addEventListener('click', (event) => {
            event.stopPropagation();

            const item = toggle.closest(
                '.header__submenu-item--nested'
            );

            if (!item) {
                return;
            }

            const isOpen = item.classList.toggle(
                'is-open'
            );

            toggle.setAttribute(
                'aria-expanded',
                String(isOpen)
            );
        });
    });

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

    document.addEventListener('click', () => {
        closeDropdowns();
        closeLanguage();
        closeSearch();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') {
            return;
        }

        closeDropdowns();
        closeLanguage();
        closeSearch();
        closeMobileNavigation();
        closeDrawer({ returnFocus: true });
    });

    navigation?.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 1024) {
                closeMobileNavigation();
            }
        });
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 1024) {
            closeMobileNavigation();
            closeDropdowns();
        } else {
            closeDrawer();
        }
    });
}