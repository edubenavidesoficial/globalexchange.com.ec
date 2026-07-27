// ====================================================
// TYPED-EFFECT.JS
// Inicialización del texto animado del Hero
// ====================================================

import Typed from 'typed.js';

export function initTyped() {

    console.log('==============================');
    console.log('🚀 initTyped() iniciado');
    console.log('==============================');

    // Buscar elementos
    const typedElement = document.getElementById('typed_937c14f');
    const settingsElement = document.getElementById('settings--937c14f');

    console.log('Elemento Typed:', typedElement);
    console.log('Elemento JSON:', settingsElement);

    if (!typedElement) {
        console.error('❌ No existe #typed_937c14f');
        return;
    }

    // Configuración por defecto
    let config = {
        strings: ['Hola', 'Mundo'],
        typeSpeed: 60,
        startDelay: 0,
        backSpeed: 40,
        smartBackspace: false,
        backDelay: 700,
        loop: true,
        loopCount: 0,
        showCursor: true,
        cursorChar: '|',
        fadeOut: false,
        fadeOutDelay: 700,
    };

    // Leer JSON del Hero
    if (settingsElement && settingsElement.textContent.trim() !== '') {

        try {

            const json = JSON.parse(settingsElement.textContent);

            console.log('✅ JSON leído correctamente');
            console.log(json);

            config = {
                ...config,
                ...json,
                cursorChar: '|'
            };

        } catch (error) {

            console.error('❌ Error leyendo JSON');
            console.error(error);

        }

    } else {

        console.warn('⚠️ No existe JSON o está vacío');

    }

    console.log('==============================');
    console.log('Configuración final');
    console.log(config);
    console.log('==============================');

    try {

        const typed = new Typed(
            typedElement,
            config
        );

        console.log('✅ Typed creado correctamente');
        console.log(typed);

        // Guardar para depuración
        window.__typed = typed;

    } catch (error) {

        console.error('❌ Error creando Typed');
        console.error(error);

    }

}