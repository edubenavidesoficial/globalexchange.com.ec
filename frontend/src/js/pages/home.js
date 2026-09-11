import { initTyped } from '../modules/typed-effect.js';
import { initCounters } from '../modules/counters.js';
import { initPortfolioCarousel } from '../modules/portfolio-carousel.js';
import { initServices } from '../modules/services.js';
import { initDestinations } from '../modules/destinations.js';
import { initMapExperience } from '../modules/map-experience.js';
import { initClosingExperience } from '../modules/closing-experience.js';

export function initHome() {
  for (const init of [initTyped, initCounters, initPortfolioCarousel, initServices, initDestinations, initMapExperience, initClosingExperience]) {
    try { init(); } catch (error) { console.error(`No se pudo iniciar ${init.name}`, error); }
  }
}
