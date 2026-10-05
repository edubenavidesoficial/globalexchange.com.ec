// ====================================================
// MAIN.JS
//
// Punto de entrada principal de JavaScript
//
// Proyecto:
// Global Exchange - Migración a Vite
//
// Responsabilidad:
// - Inicializar i18next.
// - Inicializar módulos globales.
// - Inicializar módulos específicos de cada página.
// - Mantener un único punto de entrada JavaScript.
// ====================================================


// ====================================================
// INTERNACIONALIZACIÓN
// ====================================================

import {
    initI18n
} from '../languages/i18n.js';


// ====================================================
// MÓDULOS GLOBALES
// ====================================================

import {
    initHeader
} from './modules/header.js';


import {
    initLanguageSwitcher
} from './modules/language-switcher.js';


import {
    initFloatingContact
} from './modules/floating-contact.js';


import {
    initFooter
} from './modules/footer.js';


// ====================================================
// HOME
// ====================================================

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
    initProgramFinder
} from './modules/program-finder.js';


import {
    initServices,
    initConsultationNavigation
} from './modules/services.js';


import {
    initDestinations
} from './modules/destinations.js';


import {
    initMapExperience
} from './modules/map-experience.js';


import {
    initClosingExperience
} from './modules/closing-experience.js';


// ====================================================
// PÁGINA NOSOTROS
// ====================================================

import {
    initAboutPage
} from './modules/about-page.js';


// ====================================================
// PREGUNTAS FRECUENTES
// ====================================================

import {
    initFaqAccordion
} from './modules/faq-accordion.js';


// ====================================================
// PROGRAMAS INTERNACIONALES
// ====================================================

import {
    initForeignCoursesTabs
} from './modules/foreign-courses-tabs.js';


import {
    initForeignFlagsCarousel
} from './modules/foreign-flags-carousel.js';

import {
    initProgramsPage
} from './modules/programs-page.js';

import {
    initProgramDetail
} from './modules/program-detail.js';

import {
    initTestimonialsPage
} from './modules/testimonials-page.js';


// ====================================================
// INICIALIZACIÓN GENERAL
// ====================================================

document.addEventListener(
    'DOMContentLoaded',
    async () => {

        // El login usa el mismo bootstrap, sin inicializar el sitio público.
        if (document.querySelector('[data-login]')) {
            const { initLogin } = await import('./modules/login.js');
            initLogin();
            return;
        }

        // ============================================
        // 1. INTERNACIONALIZACIÓN
        //
        // Debe ejecutarse primero porque diferentes
        // componentes dependen de los textos traducidos.
        // ============================================

        await initI18n();


        // ============================================
        // 2. COMPONENTES GLOBALES
        //
        // Estos componentes pueden existir en varias
        // páginas del sitio.
        // Cada módulo comprueba internamente si su
        // elemento existe antes de inicializarse.
        // ============================================

        initHeader();

        initLanguageSwitcher();

        initFloatingContact();

        initFooter();


        // ============================================
        // 3. HOME
        // ============================================

        initTyped();

        initCounters();

        initPortfolioCarousel();

        initProgramFinder();

        initServices();

        initDestinations();

        initMapExperience();

        initClosingExperience();



        // ============================================
        // 4. NOSOTROS / NUESTRA HISTORIA
        //
        // Este módulo reemplaza también la antigua
        // responsabilidad de:
        //
        // about-locations-progress.js
        // ============================================

        initAboutPage();


        // ============================================
        // 5. PREGUNTAS FRECUENTES
        // ============================================

        initFaqAccordion();


        // ============================================
        // 6. PROGRAMAS INTERNACIONALES
        // ============================================

        initForeignCoursesTabs();

        initForeignFlagsCarousel();

        initProgramsPage();

        initProgramDetail();

        initTestimonialsPage();

        initConsultationNavigation();

    }
);
