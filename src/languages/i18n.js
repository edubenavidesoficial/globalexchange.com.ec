// ====================================================
// I18N
//
// Archivo:
// src/languages/i18n.js
//
// Descripción:
// Configuración central del sistema de idiomas.
//
// Idiomas disponibles:
// - Español: es
// - Inglés: en
// - Alemán: de
// ====================================================

import i18next from 'i18next';

import { es } from './locales/es.js';
import { en } from './locales/en.js';
import { de } from './locales/de.js';


// ====================================================
// CONFIGURACIÓN
// ====================================================

const STORAGE_KEY = 'globalExchangeLanguage';

const SUPPORTED_LANGUAGES = [
    'es',
    'en',
    'de'
];


// ====================================================
// OBTENER IDIOMA GUARDADO
// ====================================================

function getSavedLanguage() {

    const savedLanguage =
        localStorage.getItem(STORAGE_KEY);

    if (
        savedLanguage &&
        SUPPORTED_LANGUAGES.includes(savedLanguage)
    ) {
        return savedLanguage;
    }

    return 'es';
}


// ====================================================
// INICIALIZAR I18NEXT
// ====================================================

export async function initI18n() {

    const initialLanguage =
        getSavedLanguage();

    await i18next.init({

        lng: initialLanguage,

        fallbackLng: 'es',

        resources: {
            es,
            en,
            de
        },

        interpolation: {
            escapeValue: false
        }

    });

    document.documentElement.lang =
        initialLanguage;

    return i18next;
}


// ====================================================
// CAMBIAR IDIOMA
// ====================================================

export async function changeLanguage(language) {

    if (
        !SUPPORTED_LANGUAGES.includes(language)
    ) {
        return;
    }

    await i18next.changeLanguage(language);

    localStorage.setItem(
        STORAGE_KEY,
        language
    );

    document.documentElement.lang =
        language;
}


// ====================================================
// OBTENER IDIOMA ACTUAL
// ====================================================

export function getCurrentLanguage() {

    return i18next.language || 'es';
}


// ====================================================
// EXPORTAR I18NEXT
// ====================================================

export default i18next;