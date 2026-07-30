// ====================================================
// MAIN.JS
// Punto de entrada principal de JavaScript
// ====================================================

import { initTyped } from './modules/typed-effect.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ DOM cargado');

    initTyped();
});