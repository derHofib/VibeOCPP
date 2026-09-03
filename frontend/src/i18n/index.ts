import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import commonDe from './locales/de/common.json';
import commonEn from './locales/en/common.json';
import authDe from './locales/de/auth.json';
import authEn from './locales/en/auth.json';

export const defaultNS = 'common';

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      de: { common: commonDe, auth: authDe },
      en: { common: commonEn, auth: authEn },
    },
    // German is the product default per docs/architecture-proposal.md §9 —
    // only actually used as *fallback* since the detector below picks the
    // browser's language first when it's one we support.
    fallbackLng: 'de',
    supportedLngs: ['de', 'en'],
    defaultNS,
    ns: ['common', 'auth'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'vibeocpp.language',
      caches: ['localStorage'],
    },
  });

export default i18n;
