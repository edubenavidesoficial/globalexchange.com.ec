// ====================================================
// MAIN.JS
// ====================================================

import { initTyped } from './modules/typed-effect.js';

document.addEventListener('DOMContentLoaded', () => {

    console.log('✅ DOM cargado');

    initTyped();

    // Mostrar elementos que Elementor ocultaba
    document.querySelectorAll('.elementor-invisible')
        .forEach(el => {
            el.classList.remove('elementor-invisible');
        });

});