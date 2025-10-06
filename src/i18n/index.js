import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import {getLocales} from 'react-native-localize';

// Import all language files
import en from './en.json';
import es from './es.json';
import fr from './fr.json';
import hi from './hi.json';
import ar from './ar.json';
import zh from './zh.json';
import ru from './ru.json';
import pt from './pt.json';
import de from './de.json';
import ja from './ja.json';
import ko from './ko.json';

const resources = {
  en: {translation: en},
  es: {translation: es},
  fr: {translation: fr},
  hi: {translation: hi},
  ar: {translation: ar},
  zh: {translation: zh},
  ru: {translation: ru},
  pt: {translation: pt},
  de: {translation: de},
  ja: {translation: ja},
  ko: {translation: ko},
};

// Get device language
const deviceLanguage = getLocales()[0]?.languageCode || 'en';
const supportedLanguages = Object.keys(resources);
const fallbackLanguage = 'en';

// Check if device language is supported
const initialLanguage = supportedLanguages.includes(deviceLanguage)
  ? deviceLanguage
  : fallbackLanguage;

i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: fallbackLanguage,
  compatibilityJSON: 'v3',
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false, // Important for React Native
  },
});

export const languages = [
  {code: 'en', name: 'English', nativeName: 'English'},
  {code: 'es', name: 'Spanish', nativeName: 'Español'},
  {code: 'fr', name: 'French', nativeName: 'Français'},
  {code: 'hi', name: 'Hindi', nativeName: 'हिन्दी'},
  {code: 'ar', name: 'Arabic', nativeName: 'العربية'},
  {code: 'zh', name: 'Chinese', nativeName: '中文'},
  {code: 'ru', name: 'Russian', nativeName: 'Русский'},
  {code: 'pt', name: 'Portuguese', nativeName: 'Português'},
  {code: 'de', name: 'German', nativeName: 'Deutsch'},
  {code: 'ja', name: 'Japanese', nativeName: '日本語'},
  {code: 'ko', name: 'Korean', nativeName: '한국어'},
];

export default i18n;
