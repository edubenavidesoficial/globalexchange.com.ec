// ====================================================
// LANGUAGE SWITCHER
//
// Archivo:
// src/js/modules/language-switcher.js
//
// Responsabilidad:
// - Conectar ES / EN / DE con i18next.
// - Actualizar textos traducibles.
// - Actualizar atributos traducibles.
// - Mostrar el idioma actual.
//
// Las traducciones viven exclusivamente en:
// src/languages/locales/
// ====================================================

import i18next, {
    changeLanguage,
    getCurrentLanguage
} from '../../languages/i18n.js';


// ====================================================
// OBTENER CLAVE LIMPIA
// ====================================================

function getCleanKey(value) {

    if (!value) {
        return '';
    }

    return value.trim();
}


// ====================================================
// TRADUCIR TEXTO
// ====================================================

function translateTextElements() {

    const elements =
        document.querySelectorAll(
            '[data-i18n]'
        );

    elements.forEach((element) => {

        const key =
            getCleanKey(
                element.dataset.i18n
            );

        if (!key) {
            return;
        }

        element.textContent =
            i18next.t(key);

    });

}


// ====================================================
// TRADUCIR PLACEHOLDERS
// ====================================================

function translatePlaceholders() {

    const elements =
        document.querySelectorAll(
            '[data-i18n-placeholder]'
        );

    elements.forEach((element) => {

        const key =
            getCleanKey(
                element.dataset.i18nPlaceholder
            );

        if (!key) {
            return;
        }

        element.setAttribute(
            'placeholder',
            i18next.t(key)
        );

    });

}


// ====================================================
// TRADUCIR ARIA-LABEL
// ====================================================

function translateAriaLabels() {

    const elements =
        document.querySelectorAll(
            '[data-i18n-aria-label]'
        );

    elements.forEach((element) => {

        const key =
            getCleanKey(
                element.dataset.i18nAriaLabel
            );

        if (!key) {
            return;
        }

        element.setAttribute(
            'aria-label',
            i18next.t(key)
        );

    });

}


// ====================================================
// TRADUCIR ALT DE IMÁGENES
// ====================================================

function translateAltTexts() {

    const elements =
        document.querySelectorAll(
            '[data-i18n-alt]'
        );

    elements.forEach((element) => {

        const key =
            getCleanKey(
                element.dataset.i18nAlt
            );

        if (!key) {
            return;
        }

        element.setAttribute(
            'alt',
            i18next.t(key)
        );

    });

}


// ====================================================
// INDICADOR ES / EN / DE
// ====================================================

function updateCurrentLanguageIndicator() {

    const indicator =
        document.querySelector(
            '[data-current-language]'
        );

    if (!indicator) {
        return;
    }

    indicator.textContent =
        getCurrentLanguage()
            .toUpperCase();

}


// ====================================================
// MARCAR IDIOMA ACTIVO
// ====================================================

function updateActiveLanguage() {

    const currentLanguage =
        getCurrentLanguage();

    const buttons =
        document.querySelectorAll(
            '[data-language]'
        );

    buttons.forEach((button) => {

        const buttonLanguage =
            getCleanKey(
                button.dataset.language
            );

        const isActive =
            buttonLanguage ===
            currentLanguage;

        button.classList.toggle(
            'is-active',
            isActive
        );

        if (isActive) {

            button.setAttribute(
                'aria-current',
                'true'
            );

        } else {

            button.removeAttribute(
                'aria-current'
            );

        }

    });

}


// ====================================================
// ACTUALIZAR TODA LA INTERFAZ
// ====================================================

export function updateTranslations() {

    translateTextElements();

    translatePlaceholders();

    translateAriaLabels();

    translateAltTexts();

    updateCurrentLanguageIndicator();

    updateActiveLanguage();

}


// ====================================================
// CERRAR SELECTOR
// ====================================================

function closeLanguageMenu(container) {

    container.classList.remove(
        'is-open'
    );

    const toggle =
        container.querySelector(
            '.header__language-toggle'
        );

    toggle?.setAttribute(
        'aria-expanded',
        'false'
    );

}


// ====================================================
// INICIALIZAR
// ====================================================

export function initLanguageSwitcher() {

    const container =
        document.querySelector(
            '.header__language'
        );

    if (!container) {
        return;
    }

    const languageButtons =
        container.querySelectorAll(
            '[data-language]'
        );


    // ================================================
    // TRADUCCIÓN INICIAL
    // ================================================

    updateTranslations();


    // ================================================
    // CAMBIO DE IDIOMA
    // ================================================

    i18next.on(
        'languageChanged',
        () => {

            updateTranslations();

        }
    );


    // ================================================
    // SELECTOR ES / EN / DE
    // ================================================

    languageButtons.forEach((button) => {

        button.addEventListener(
            'click',
            async (event) => {

                event.stopPropagation();

                const language =
                    getCleanKey(
                        button.dataset.language
                    );

                if (!language) {
                    return;
                }

                await changeLanguage(
                    language
                );

                closeLanguageMenu(
                    container
                );

            }
        );

    });

}