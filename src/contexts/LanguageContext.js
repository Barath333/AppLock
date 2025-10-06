// src/contexts/LanguageContext.js
import React, {createContext, useState, useContext, useEffect} from 'react';
import {I18nManager} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n, {languages} from '../i18n';
import {getLocales} from 'react-native-localize';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({children}) => {
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [isRTL, setIsRTL] = useState(false);

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem('app_language');
      const deviceLanguage = getLocales()[0].languageCode;

      let languageToUse = savedLanguage || deviceLanguage || 'en';

      // Fallback to English if language not supported
      if (!languages.find(lang => lang.code === languageToUse)) {
        languageToUse = 'en';
      }

      setCurrentLanguage(languageToUse);
      i18n.changeLanguage(languageToUse);

      // Handle RTL languages
      const isRTLLanguage = ['ar', 'he'].includes(languageToUse);
      setIsRTL(isRTLLanguage);

      if (isRTLLanguage && !I18nManager.isRTL) {
        I18nManager.forceRTL(true);
      } else if (!isRTLLanguage && I18nManager.isRTL) {
        I18nManager.forceRTL(false);
      }
    } catch (error) {
      console.error('Error loading language:', error);
      setCurrentLanguage('en');
      i18n.changeLanguage('en');
    }
  };

  const changeLanguage = async languageCode => {
    try {
      setCurrentLanguage(languageCode);
      i18n.changeLanguage(languageCode);
      await AsyncStorage.setItem('app_language', languageCode);

      // Handle RTL languages
      const isRTLLanguage = ['ar', 'he'].includes(languageCode);
      setIsRTL(isRTLLanguage);

      if (isRTLLanguage && !I18nManager.isRTL) {
        I18nManager.forceRTL(true);
      } else if (!isRTLLanguage && I18nManager.isRTL) {
        I18nManager.forceRTL(false);
      }
    } catch (error) {
      console.error('Error changing language:', error);
    }
  };

  const value = {
    currentLanguage,
    changeLanguage,
    isRTL,
    languages,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};
