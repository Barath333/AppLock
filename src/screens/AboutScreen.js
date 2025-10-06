import React from 'react';
import {View, Text, StyleSheet, ScrollView, Linking} from 'react-native';
import {List, Divider, Card} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

const AboutScreen = () => {
  const navigation = useNavigation();
  const {t} = useTranslation();

  const handleContactSupport = () => {
    Linking.openURL('mailto:support@applock.com?subject=App%20Lock%20Support');
  };

  const handlePrivacyPolicy = () => {
    Linking.openURL('https://yourapp.com/privacy');
  };

  const handleTermsOfService = () => {
    Linking.openURL('https://yourapp.com/terms');
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.title}>{t('about.title')}</Text>
          <Text style={styles.version}>{t('about.version')}</Text>
          <Text style={styles.description}>{t('about.description')}</Text>
        </Card.Content>
      </Card>

      <List.Section>
        <List.Subheader style={styles.sectionHeader}>
          {t('about.information')}
        </List.Subheader>
        <List.Item
          title={t('about.contact_support')}
          description={t('about.contact_support_desc')}
          left={props => (
            <List.Icon {...props} icon="headset" color="#1E88E5" />
          )}
          onPress={handleContactSupport}
        />
        <List.Item
          title={t('about.privacy_policy')}
          description={t('about.privacy_policy_desc')}
          left={props => (
            <List.Icon {...props} icon="shield-account" color="#1E88E5" />
          )}
          onPress={handlePrivacyPolicy}
        />
        <List.Item
          title={t('about.terms_service')}
          description={t('about.terms_service_desc')}
          left={props => (
            <List.Icon {...props} icon="file-document" color="#1E88E5" />
          )}
          onPress={handleTermsOfService}
        />
      </List.Section>

      <Divider style={styles.divider} />

      <List.Section>
        <List.Subheader style={styles.sectionHeader}>
          {t('about.features')}
        </List.Subheader>
        <List.Item
          title={t('about.app_locking')}
          description={t('about.app_locking_desc')}
          left={props => <List.Icon {...props} icon="lock" color="#4CAF50" />}
        />
        <List.Item
          title={t('about.biometric_auth')}
          description={t('about.biometric_auth_desc')}
          left={props => (
            <List.Icon {...props} icon="fingerprint" color="#4CAF50" />
          )}
        />
        <List.Item
          title={t('about.security_question_feature')}
          description={t('about.security_question_desc')}
          left={props => (
            <List.Icon {...props} icon="help-circle" color="#4CAF50" />
          )}
        />
        <List.Item
          title={t('about.master_pin_change')}
          description={t('about.master_pin_change_desc')}
          left={props => (
            <List.Icon {...props} icon="key-change" color="#4CAF50" />
          )}
        />
      </List.Section>

      <View style={styles.footer}>
        <Text style={styles.footerText}>{t('about.footer')}</Text>
        <Text style={styles.footerSubtext}>{t('about.footer_subtext')}</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  card: {
    margin: 16,
    borderRadius: 12,
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1E88E5',
    marginBottom: 8,
  },
  version: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666',
    lineHeight: 20,
  },
  sectionHeader: {
    color: '#1E88E5',
    fontWeight: '600',
    fontSize: 16,
  },
  divider: {
    marginVertical: 10,
    marginHorizontal: 16,
    backgroundColor: '#E0E0E0',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    color: '#666',
    fontSize: 14,
    marginBottom: 4,
  },
  footerSubtext: {
    color: '#999',
    fontSize: 12,
  },
});

export default AboutScreen;
