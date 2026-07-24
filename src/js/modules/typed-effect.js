// ====================================================
// TYPED-EFFECT.JS - Texto animado del Hero
// ====================================================

import Typed from 'typed.js';

export function initTyped() {
    const typedElement = document.getElementById('typed_937c14f');
    const settingsElement = document.getElementById('settings--937c14f');

    if (!typedElement) {
        console.warn('Typed element not found');
        return;
    }

    // Intentar leer la configuración desde el JSON
    let config = {
        strings: ['¡Ama, vive, viaja!'], // fallback por si no hay JSON
        typeSpeed: 100,
        startDelay: 0,
        backSpeed: 50,
        smartBackspace: false,
        backDelay: 700,
        loop: true,
        loopCount: 0,
        showCursor: true,
        cursorChar: '&nbsp;',
        fadeOut: false,
        fadeOutDelay: 700,
    };

    if (settingsElement && settingsElement.textContent) {
        try {
            const settings = JSON.parse(settingsElement.textContent);
            config = { ...config, ...settings };
        } catch (e) {
            console.warn('Error parsing Typed settings, using fallback');
        }
    }

    // Iniciar Typed
    new Typed(typedElement, {
        strings: config.strings,
        typeSpeed: config.typeSpeed,
        startDelay: config.startDelay,
        backSpeed: config.backSpeed,
        smartBackspace: config.smartBackspace,
        backDelay: config.backDelay,
        loop: config.loop,
        loopCount: config.loopCount,
        showCursor: config.showCursor,
        cursorChar: config.cursorChar,
        fadeOut: config.fadeOut,
        fadeOutDelay: config.fadeOutDelay,
    });
}