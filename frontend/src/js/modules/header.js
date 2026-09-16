// ====================================================
// HEADER.JS
// Interacciones del encabezado
//
// Responsabilidades:
// - Dropdown Global.
// - Mega menú Programas.
// - Selector de idiomas.
// - Buscador.
// - Navegación móvil.
// - Drawer lateral.
// - Estado compacto del header al hacer scroll.
// ====================================================


export function initHeader() {

    const header =
        document.querySelector(
            '.header'
        );


    if (!header) {
        return;
    }


    // =================================================
    // NAVEGACIÓN
    // =================================================

    const navigation =
        header.querySelector(
            '.header__nav'
        );


    const mobileToggle =
        header.querySelector(
            '.header__mobile-toggle'
        );


    const dropdownToggles =
        header.querySelectorAll(
            '.header__dropdown-toggle'
        );


    const programsMenu =
        header.querySelector(
            '#programs-menu'
        );


    const nestedToggles =
        header.querySelectorAll(
            '.header__nested-toggle'
        );


    // =================================================
    // IDIOMAS
    // =================================================

    const language =
        header.querySelector(
            '.header__language'
        );


    const languageToggle =
        header.querySelector(
            '.header__language-toggle'
        );


    // =================================================
    // BUSCADOR
    // =================================================

    const search =
        header.querySelector(
            '.header__search'
        );


    const searchToggle =
        header.querySelector(
            '.header__search-toggle'
        );


    const searchInput =
        header.querySelector(
            '.header__search-input'
        );


    // =================================================
    // DRAWER
    // =================================================

    const drawer =
        document.querySelector(
            '[data-header-drawer]'
        );


    const drawerBackdrop =
        document.querySelector(
            '[data-header-drawer-backdrop]'
        );


    const drawerClose =
        document.querySelector(
            '[data-header-drawer-close]'
        );


    // Section state follows the existing navigation URLs, including program details.
    const normalizePath = pathname => pathname.replace(/\/index\.html$/, '/').replace(/\/+$/, '') || '/';
    const currentPath = normalizePath(window.location.pathname);
    navigation?.querySelectorAll('.header__menu > .header__menu-item').forEach(item => {
        const links = [...item.querySelectorAll(':scope > a[href], .global-menu__list a[href], .programs-menu__columns a[href], .programs-menu__footer a[href="/pages/programas/"]')];
        const active = links.some(link => {
            const url = new URL(link.href);
            return url.origin === window.location.origin && !url.hash && normalizePath(url.pathname) === currentPath;
        }) || (item.classList.contains('header__programs') && currentPath === '/pages/program-finder');
        item.classList.toggle('header__menu-item--active', active);
        const control = item.querySelector(':scope > a, :scope > button');
        if (active) control?.setAttribute('aria-current', control.tagName === 'A' ? 'page' : 'true');
        else control?.removeAttribute('aria-current');
    });

    let desktopMode = window.innerWidth > 1024;
    const modalBackground = new Map();

    function syncBurgerTarget() {
        mobileToggle?.setAttribute('aria-controls', desktopMode ? 'header-drawer' : 'header-navigation');
    }

    // Save existing inert values; do not disable a wrapper containing the dialog.
    function isolateDrawer() {
        let branch = drawer;
        while (branch?.parentElement) {
            for (const sibling of branch.parentElement.children) {
                if (sibling === branch || sibling === drawerBackdrop || /^(SCRIPT|STYLE|LINK)$/.test(sibling.tagName)) continue;
                modalBackground.set(sibling, sibling.inert);
                sibling.inert = true;
            }
            branch = branch.parentElement;
            if (branch === document.body) break;
        }
    }

    function restoreBackground() {
        modalBackground.forEach((wasInert, element) => { element.inert = wasInert; });
        modalBackground.clear();
    }

    document.addEventListener('keydown', event => {
        if (event.key !== 'Tab' || !drawer?.classList.contains('is-open')) return;
        const focusable = [...drawer.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')]
            .filter(element => !element.closest('[inert]') && element.getClientRects().length > 0);
        const first = focusable[0];
        const last = focusable.at(-1);
        if (!first) { event.preventDefault(); drawer.focus(); return; }
        if (event.shiftKey && (document.activeElement === first || !drawer.contains(document.activeElement))) {
            event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !drawer.contains(document.activeElement))) {
            event.preventDefault(); first.focus();
        }
    });

    // =================================================
    // ESTADO DE ANIMACIÓN DEL HEADER
    // =================================================

    let scrollFrame =
        null;


    // =================================================
    // HEADER COMPACTO AL HACER SCROLL
    // =================================================

    function updateHeaderScrollState() {

        /*
         * En tablet y móvil mantenemos las alturas
         * responsive actuales.
         *
         * La compactación se aplica únicamente
         * en escritorio.
         */

        if (
            window.innerWidth <=
            1024
        ) {

            header.classList.remove(
                'is-scrolled'
            );


            return;

        }


        const shouldCompact =
            window.scrollY >
            64;


        header.classList.toggle(
            'is-scrolled',
            shouldCompact
        );

    }


    // =================================================
    // ACTUALIZACIÓN OPTIMIZADA CON RAF
    // =================================================

    function requestHeaderScrollUpdate() {

        if (scrollFrame) {
            return;
        }


        scrollFrame =
            window.requestAnimationFrame(
                () => {

                    scrollFrame =
                        null;


                    updateHeaderScrollState();

                }
            );

    }


    // =================================================
    // CERRAR DROPDOWNS
    // =================================================

    function closeDropdowns() {
        header.querySelector('#global-menu')?.setAttribute('inert', '');

        dropdownToggles.forEach(
            (toggle) => {

                toggle.setAttribute(
                    'aria-expanded',
                    'false'
                );


                toggle
                    .closest(
                        '.header__menu-item'
                    )
                    ?.classList.remove(
                        'is-open'
                    );

            }
        );


        programsMenu?.setAttribute(
            'inert',
            ''
        );


        nestedToggles.forEach(
            (toggle) => {

                toggle.setAttribute(
                    'aria-expanded',
                    'false'
                );


                toggle
                    .closest(
                        '.header__submenu-item--nested'
                    )
                    ?.classList.remove(
                        'is-open'
                    );

            }
        );

    }


    // =================================================
    // CERRAR IDIOMAS
    // =================================================

    function closeLanguage() {

        language?.classList.remove(
            'is-open'
        );


        languageToggle?.setAttribute(
            'aria-expanded',
            'false'
        );

    }


    // =================================================
    // CERRAR BUSCADOR
    // =================================================

    function closeSearch() {

        search?.classList.remove(
            'is-open'
        );


        searchToggle?.setAttribute(
            'aria-expanded',
            'false'
        );

    }


    // =================================================
    // CERRAR NAVEGACIÓN MÓVIL
    // =================================================

    function closeMobileNavigation() {

        navigation?.classList.remove(
            'is-open'
        );


        if (
            window.innerWidth <=
            1024
        ) {

            mobileToggle?.classList.remove(
                'is-open'
            );


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


    // =================================================
    // ABRIR DRAWER
    // =================================================

    function openDrawer() {

        if (
            !drawer ||
            !drawerBackdrop ||
            !mobileToggle
        ) {
            return;
        }


        drawer.inert = false;
        drawer.classList.add(
            'is-open'
        );


        drawerBackdrop.classList.add(
            'is-open'
        );


        document.body.classList.add(
            'header-drawer-open'
        );


        drawer.setAttribute(
            'aria-hidden',
            'false'
        );


        drawerBackdrop.setAttribute(
            'aria-hidden',
            'false'
        );


        mobileToggle.classList.add(
            'is-open'
        );


        mobileToggle.setAttribute(
            'aria-expanded',
            'true'
        );


        mobileToggle.setAttribute(
            'aria-label',
            'Cerrar panel informativo'
        );


        isolateDrawer();
        window.requestAnimationFrame(() => {
            if (drawer.classList.contains('is-open')) drawerClose?.focus({ preventScroll: true });
        });

    }


    // =================================================
    // CERRAR DRAWER
    // =================================================

    function closeDrawer(
        {
            returnFocus = true
        } = {}
    ) {

        if (
            !drawer ||
            !drawerBackdrop ||
            !mobileToggle
        ) {
            return;
        }


        if (!drawer.classList.contains('is-open')) return;
        restoreBackground();
        if (returnFocus) mobileToggle.focus({ preventScroll: true });
        drawer.inert = true;
        drawer.classList.remove(
            'is-open'
        );


        drawerBackdrop.classList.remove(
            'is-open'
        );


        document.body.classList.remove(
            'header-drawer-open'
        );


        drawer.setAttribute(
            'aria-hidden',
            'true'
        );


        drawerBackdrop.setAttribute(
            'aria-hidden',
            'true'
        );


        mobileToggle.classList.remove(
            'is-open'
        );


        mobileToggle.setAttribute(
            'aria-expanded',
            'false'
        );


        mobileToggle.setAttribute(
            'aria-label',
            'Abrir panel informativo'
        );




    }


    // =================================================
    // BURGER
    // =================================================

    mobileToggle?.addEventListener(
        'click',
        () => {

            closeLanguage();
            closeSearch();
            closeDropdowns();


            /*
             * En escritorio:
             * abre el panel lateral.
             */

            if (
                window.innerWidth >
                1024
            ) {

                const isOpen =
                    drawer?.classList.contains(
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
             * En tablet y móvil:
             * abre la navegación principal.
             */

            const isOpen =
                navigation?.classList.toggle(
                    'is-open'
                );


            mobileToggle.classList.toggle(
                'is-open',
                Boolean(
                    isOpen
                )
            );


            mobileToggle.setAttribute(
                'aria-expanded',
                String(
                    Boolean(
                        isOpen
                    )
                )
            );


            mobileToggle.setAttribute(
                'aria-label',
                isOpen
                    ? 'Cerrar menú'
                    : 'Abrir menú'
            );

        }
    );


    // =================================================
    // BOTÓN CERRAR DRAWER
    // =================================================

    drawerClose?.addEventListener(
        'click',
        () => {

            closeDrawer({
                returnFocus: true
            });

        }
    );


    // =================================================
    // BACKDROP DRAWER
    // =================================================

    drawerBackdrop?.addEventListener(
        'click',
        () => {

            closeDrawer();

        }
    );


    // =================================================
    // DROPDOWNS PRINCIPALES
    // =================================================

    dropdownToggles.forEach(
        (toggle) => {

            toggle.addEventListener(
                'click',
                (event) => {

                    event.stopPropagation();


                    const menuItem =
                        toggle.closest(
                            '.header__menu-item'
                        );


                    if (!menuItem) {
                        return;
                    }


                    const willOpen =
                        !menuItem.classList.contains(
                            'is-open'
                        );


                    closeDropdowns();
                    closeLanguage();
                    closeSearch();

                    if (willOpen) {
                        const panel = document.getElementById(toggle.getAttribute('aria-controls'));
                        if (panel) panel.inert = false;

                        menuItem.classList.add(
                            'is-open'
                        );


                        toggle.setAttribute(
                            'aria-expanded',
                            'true'
                        );


                        if (
                            programsMenu &&
                            menuItem.classList.contains(
                                'header__programs'
                            )
                        ) {

                            programsMenu.removeAttribute(
                                'inert'
                            );

                        }

                    }

                }
            );

        }
    );


    // =================================================
    // SUBMENÚS ANIDADOS
    // =================================================

    nestedToggles.forEach(
        (toggle) => {

            toggle.addEventListener(
                'click',
                (event) => {

                    event.stopPropagation();


                    const item =
                        toggle.closest(
                            '.header__submenu-item--nested'
                        );


                    if (!item) {
                        return;
                    }


                    const isOpen =
                        item.classList.toggle(
                            'is-open'
                        );


                    toggle.setAttribute(
                        'aria-expanded',
                        String(
                            isOpen
                        )
                    );

                }
            );

        }
    );


    // =================================================
    // IDIOMAS
    // =================================================

    languageToggle?.addEventListener(
        'click',
        (event) => {

            event.stopPropagation();


            const isOpen =
                language?.classList.toggle(
                    'is-open'
                );


            languageToggle.setAttribute(
                'aria-expanded',
                String(
                    Boolean(
                        isOpen
                    )
                )
            );


            closeSearch();
            closeDropdowns();

        }
    );


    // =================================================
    // BUSCADOR
    // =================================================

    searchToggle?.addEventListener(
        'click',
        (event) => {

            event.stopPropagation();


            const isOpen =
                search?.classList.toggle(
                    'is-open'
                );


            searchToggle.setAttribute(
                'aria-expanded',
                String(
                    Boolean(
                        isOpen
                    )
                )
            );


            closeLanguage();
            closeDropdowns();


            if (isOpen) {

                window.setTimeout(
                    () => {

                        if (search?.classList.contains('is-open')) searchInput?.focus();

                    },
                    100
                );

            }

        }
    );


    // =================================================
    // EVITAR CIERRE POR CLICK INTERNO
    // =================================================

    search?.addEventListener(
        'click',
        (event) => {

            event.stopPropagation();

        }
    );


    language?.addEventListener(
        'click',
        (event) => {

            event.stopPropagation();

        }
    );


    // =================================================
    // CLICK FUERA
    // =================================================

    document.addEventListener(
        'click',
        (event) => {
            if (navigation?.contains(event.target)) return;
            if (!header.contains(event.target)) closeMobileNavigation();

            closeDropdowns();
            closeLanguage();
            closeSearch();

        }
    );


    // =================================================
    // ESCAPE
    // =================================================

    document.addEventListener(
        'keydown',
        (event) => {

            if (
                event.key !==
                'Escape'
            ) {
                return;
            }


            const ownsEscape = drawer?.classList.contains('is-open') || header.querySelector('button[aria-expanded="true"]');
            if (!ownsEscape) return;
            event.preventDefault();
            // Other global widgets also listen for Escape and may move focus.
            event.stopImmediatePropagation();
            if (!drawer?.classList.contains('is-open')) {
                const expanded = header.querySelector('button[aria-expanded="true"]');
                expanded?.focus({ preventScroll: true });
            }
            closeDropdowns();
            closeLanguage();
            closeSearch();
            closeMobileNavigation();


            closeDrawer({
                returnFocus: true
            });

        }
    );


    // =================================================
    // LINKS DE NAVEGACIÓN MÓVIL
    // =================================================

    navigation
        ?.querySelectorAll(
            'a'
        )
        .forEach(
            (link) => {

                link.addEventListener(
                    'click',
                    () => {

                        if (
                            window.innerWidth <=
                            1024
                        ) {

                            closeMobileNavigation();

                        }

                    }
                );

            }
        );


    // =================================================
    // SCROLL
    // =================================================

    window.addEventListener(
        'scroll',
        requestHeaderScrollUpdate,
        {
            passive: true
        }
    );


    // =================================================
    // RESIZE
    // =================================================

    window.addEventListener('resize', () => {
        const nextDesktopMode = window.innerWidth > 1024;
        if (nextDesktopMode !== desktopMode) {
            closeDrawer();
            closeMobileNavigation();
            closeDropdowns();
            closeLanguage();
            closeSearch();
            mobileToggle?.classList.remove('is-open');
            mobileToggle?.setAttribute('aria-expanded', 'false');
            mobileToggle?.setAttribute('aria-label', nextDesktopMode ? 'Abrir panel informativo' : 'Abrir menú');
            desktopMode = nextDesktopMode;
            syncBurgerTarget();
        }
        requestHeaderScrollUpdate();
    }, { passive: true });


    // =================================================
    // ESTADO INICIAL
    // =================================================

    syncBurgerTarget();
    updateHeaderScrollState();

}