// ====================================================
// MAIN.JS
// Punto de entrada principal de JavaScript
// ====================================================

import { initHeader } from './modules/header.js';
import { initTyped } from './modules/typed-effect.js';
import { initCounters } from './modules/counters.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ DOM cargado');

    initHeader();
    initTyped();
    initCounters();
});