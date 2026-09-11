// ====================================================
// TYPED EFFECT
//
// Archivo:
// src/js/modules/typed-effect.js
//
// Responsabilidad:
// - Inicializar Typed.js en el Hero.
// - Obtener el texto desde i18next.
// - Reiniciar la animación cuando cambia el idioma.
// ====================================================

import Typed from 'typed.js';

import i18next from '../../languages/i18n.js';


// ====================================================
// CONFIGURACIÓN
// ====================================================

const TYPED_CONFIG = {

    typeSpeed: 100,

    startDelay: 0,

    backSpeed: 50,

    smartBackspace: false,

    backDelay: 700,

    loop: true,

    showCursor: true,

    cursorChar: '|',

    fadeOut: false,

    fadeOutDelay: 700

};


// ====================================================
// INSTANCIA
// ====================================================

let typedInstance = null;


// ====================================================
// CREAR ANIMACIÓN
// ====================================================

function createTyped(element) {

    if (!element) {
        return;
    }


    // Destruir instancia anterior
    if (typedInstance) {

        typedInstance.destroy();

        typedInstance = null;
    }


    // Obtener el texto desde i18next
    const translatedText =
        i18next.t('hero.typed');


    typedInstance = new Typed(
        element,
        {
            ...TYPED_CONFIG,

            strings: [
                translatedText
            ]
        }
    );
}


// ====================================================
// INICIALIZACIÓN
// ====================================================

export function initTyped() {

    const typedElement =
        document.querySelector(
            '[data-hero-typed]'
        );


    if (!typedElement) {
        return;
    }


    // ================================================
    // IDIOMA INICIAL
    // ================================================

    createTyped(
        typedElement
    );


    // ================================================
    // CAMBIO DE IDIOMA
    // ================================================

    i18next.on(
        'languageChanged',
        () => {

            createTyped(
                typedElement
            );

        }
    );

}