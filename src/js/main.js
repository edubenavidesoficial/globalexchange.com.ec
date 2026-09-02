// ====================================================
// MAIN.JS
//
// Punto de entrada principal de JavaScript
// Global Exchange - Vite
// ====================================================


// ====================================================
// INTERNACIONALIZACIÓN
// ====================================================

import {
    initI18n
} from '../languages/i18n.js';


// ====================================================
// MÓDULOS
// ====================================================

import {
    initHeader
} from './modules/header.js';

import {
    initLanguageSwitcher
} from './modules/language-switcher.js';

import {
    initTyped
} from './modules/typed-effect.js';

import {
    initCounters
} from './modules/counters.js';

import {
    initPortfolioCarousel
} from './modules/portfolio-carousel.js';

import {
    initContactForm
} from './modules/contact-form.js';

import {
    initFooterSearch
} from './modules/footer-search.js';

import {
    initFloatingContact
} from './modules/floating-contact.js';

import {
    initAboutLocationsProgress
} from './modules/about-locations-progress.js';

import {
    initFaqAccordion
} from './modules/faq-accordion.js';

import {
    initForeignCoursesTabs
} from './modules/foreign-courses-tabs.js';

import {
    initForeignFlagsCarousel
} from './modules/foreign-flags-carousel.js';

import {
    initProgramFinder
} from './modules/program-finder.js';

import {
    initServices
} from './modules/services.js';


// ====================================================
// INICIALIZACIÓN
// ====================================================

document.addEventListener(
    'DOMContentLoaded',
    async () => {

        // ============================================
        // 1. INTERNACIONALIZACIÓN
        // ============================================

        await initI18n();


        // ============================================
        // 2. HEADER
        // ============================================

        initHeader();
        initLanguageSwitcher();


        // ============================================
        // 3. HOME
        // ============================================

        initTyped();

        initCounters();

        initPortfolioCarousel();

        initProgramFinder();

        initServices();

        initContactForm();

        initFloatingContact();


        // ============================================
        // 4. COMPONENTES COMPARTIDOS
        // ============================================

        initFooterSearch();

        initAboutLocationsProgress();

        initFaqAccordion();

        initForeignCoursesTabs();

        initForeignFlagsCarousel();

    }
);