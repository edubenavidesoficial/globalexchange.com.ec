// ====================================================
// MAIN.JS
// Punto de entrada principal
// ====================================================

import { initHeader } from './modules/header.js';
import { initTyped } from './modules/typed-effect.js';
import { initCounters } from './modules/counters.js';
import { initPortfolioCarousel } from './modules/portfolio-carousel.js';
import { initContactForm } from './modules/contact-form.js';
import { initFooterSearch } from './modules/footer-search.js';
import { initFloatingContact } from './modules/floating-contact.js';
import { initAboutLocationsProgress } from './modules/about-locations-progress.js';
import { initFaqAccordion } from './modules/faq-accordion.js';

document.addEventListener('DOMContentLoaded', () => {
    initHeader();
    initTyped();
    initCounters();
    initPortfolioCarousel();
    initContactForm();
    initFooterSearch();
    initFloatingContact();
    initAboutLocationsProgress();
    initFaqAccordion();
});