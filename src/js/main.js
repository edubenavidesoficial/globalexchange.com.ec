// ====================================================
// MAIN.JS
// Punto de entrada principal de JavaScript
// ====================================================

import { initTyped } from './modules/typed-effect.js';
import { initHeader } from './modules/header.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ DOM cargado');

    initHeader();
    initTyped();
});