// src/screens/LanguageScreen.js
import React from 'react';
import {View, Text, StyleSheet, ScrollView, I18nManager} from 'react-native';
import {List, RadioButton, Card} from 'react-native-paper';
import {useLanguage} from '../contexts/LanguageContext';
import {useTranslation} from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialIcons';

const LanguageScreen = () => {
  const {currentLanguage, changeLanguage, languages, isRTL} = useLanguage();
  const {t} = useTranslation();

  const handleLanguageChange = languageCode => {
    changeLanguage(languageCode);
  };

  return (
    <ScrollView style={[styles.container, isRTL && styles.rtlContainer]}>
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.title}>{t('language.title')}</Text>
          <Text style={styles.subtitle}>{t('language.subtitle')}</Text>

          <List.Section>
            {languages.map(language => (
              <List.Item
                key={language.code}
                title={language.nativeName}
                description={language.name}
                titleStyle={[styles.languageText, isRTL && styles.rtlText]}
                descriptionStyle={[
                  styles.languageDescription,
                  isRTL && styles.rtlText,
                ]}
                style={[
                  styles.listItem,
                  currentLanguage === language.code && styles.selectedItem,
                ]}
                onPress={() => handleLanguageChange(language.code)}
                left={props => (
                  <View style={styles.flagContainer}>
                    <Text style={styles.flag}>
                      {getFlagEmoji(language.code)}
                    </Text>
                  </View>
                )}
                right={props => (
                  <RadioButton.Android
                    value={language.code}
                    status={
                      currentLanguage === language.code
                        ? 'checked'
                        : 'unchecked'
                    }
                    onPress={() => handleLanguageChange(language.code)}
                    color="#1E88E5"
                  />
                )}
              />
            ))}
          </List.Section>

          <View style={styles.currentLanguageContainer}>
            <Icon name="language" size={20} color="#1E88E5" />
            <Text style={styles.currentLanguageText}>
              {t('language.current')}:{' '}
              {
                languages.find(lang => lang.code === currentLanguage)
                  ?.nativeName
              }
            </Text>
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const getFlagEmoji = languageCode => {
  const flagEmojis = {
    en: '🇺🇸',
    es: '🇪🇸',
    fr: '🇫🇷',
    hi: '🇮🇳',
    ar: '🇸🇦',
    zh: '🇨🇳',
    ru: '🇷🇺',
    pt: '🇧🇷',
    de: '🇩🇪',
    ja: '🇯🇵',
    ko: '🇰🇷',
  };
  return flagEmojis[languageCode] || '🌐';
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  rtlContainer: {
    direction: 'rtl',
  },
  card: {
    margin: 16,
    borderRadius: 12,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#1E88E5',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    color: '#666',
    lineHeight: 20,
  },
  listItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  selectedItem: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
  },
  languageText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  languageDescription: {
    fontSize: 14,
    color: '#666',
  },
  rtlText: {
    textAlign: 'right',
  },
  flagContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  flag: {
    fontSize: 24,
  },
  currentLanguageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    padding: 16,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
  },
  currentLanguageText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#1E88E5',
  },
});

export default LanguageScreen;
