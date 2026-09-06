import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import commonDe from './locales/de/common.json';
import commonEn from './locales/en/common.json';
import authDe from './locales/de/auth.json';
import authEn from './locales/en/auth.json';
import usersDe from './locales/de/users.json';
import usersEn from './locales/en/users.json';
import settingsDe from './locales/de/settings.json';
import settingsEn from './locales/en/settings.json';
import testsuiteDe from './locales/de/testsuite.json';
import testsuiteEn from './locales/en/testsuite.json';
import monitorDe from './locales/de/monitor.json';
import monitorEn from './locales/en/monitor.json';
import opsDe from './locales/de/ops.json';
import opsEn from './locales/en/ops.json';
import stationsDe from './locales/de/stations.json';
import stationsEn from './locales/en/stations.json';

export const defaultNS = 'common';

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      de: {
        common: commonDe,
        auth: authDe,
        users: usersDe,
        settings: settingsDe,
        testsuite: testsuiteDe,
        monitor: monitorDe,
        ops: opsDe,
        stations: stationsDe,
      },
      en: {
        common: commonEn,
        auth: authEn,
        users: usersEn,
        settings: settingsEn,
        testsuite: testsuiteEn,
        monitor: monitorEn,
        ops: opsEn,
        stations: stationsEn,
      },
    },
    // German is the product default per docs/architecture-proposal.md §9 —
    // only actually used as *fallback* since the detector below picks the
    // browser's language first when it's one we support.
    fallbackLng: 'de',
    supportedLngs: ['de', 'en'],
    defaultNS,
    ns: ['common', 'auth', 'users', 'settings', 'testsuite', 'monitor', 'ops', 'stations'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'vibeocpp.language',
      caches: ['localStorage'],
    },
  });

export default i18n;
