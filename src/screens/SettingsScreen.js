import React, {useState, useEffect} from 'react';
import {View, Text, StyleSheet, ScrollView, Alert, Switch} from 'react-native';
import {List, Button, Divider, Card} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {useLanguage} from '../contexts/LanguageContext';
import * as Keychain from 'react-native-keychain';
import * as Biometrics from 'react-native-biometrics';
import {checkDeviceSecurity, checkAppTampering} from '../utils/securityUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SettingsScreen = () => {
  const navigation = useNavigation();
  const {t} = useTranslation();
  const {currentLanguage, languages} = useLanguage();

  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [securityStatus, setSecurityStatus] = useState({
    deviceSecure: true,
    appSecure: true,
    warnings: [],
  });

  React.useEffect(() => {
    checkBiometricsAvailability();
    checkSecurityStatus();
  }, []);

  const checkSecurityStatus = async () => {
    try {
      const deviceSecurity = await checkDeviceSecurity();
      const appTampering = await checkAppTampering();

      const warnings = [];
      if (deviceSecurity.isRooted) warnings.push('Rooted device');
      if (deviceSecurity.isJailBroken) warnings.push('Jailbroken device');
      if (appTampering.isEmulator) warnings.push('Running in emulator');

      setSecurityStatus({
        deviceSecure: !deviceSecurity.isRooted && !deviceSecurity.isJailBroken,
        appSecure: !appTampering.isTampered,
        warnings,
      });
    } catch (error) {
      console.error('Error checking security status:', error);
    }
  };

  const checkBiometricsAvailability = async () => {
    try {
      const {available} = await Biometrics.isSensorAvailable();
      setBiometricsEnabled(available);
    } catch (error) {
      console.error('Error checking biometrics:', error);
    }
  };

  const handleChangePassword = () => {
    navigation.navigate('ChangePassword');
  };

  const handleToggleBiometrics = async value => {
    if (value) {
      try {
        const {available} = await Biometrics.isSensorAvailable();

        if (!available) {
          Alert.alert(
            t('alerts.error'),
            'Biometric authentication is not available on this device',
          );
          return;
        }

        const {success} = await Biometrics.simplePrompt({
          promptMessage: 'Authenticate to enable biometrics',
        });

        if (success) {
          await AsyncStorage.setItem('biometrics_enabled', 'true');
          setBiometricsEnabled(true);
          Alert.alert(t('alerts.success'), 'Biometric authentication enabled');
        } else {
          Alert.alert(t('alerts.error'), 'Biometric authentication failed');
        }
      } catch (error) {
        console.error('Error enabling biometrics:', error);
        Alert.alert(
          t('alerts.error'),
          'Failed to enable biometric authentication',
        );
      }
    } else {
      await AsyncStorage.setItem('biometrics_enabled', 'false');
      setBiometricsEnabled(false);
      Alert.alert(
        'Biometrics Disabled',
        'Biometric authentication has been disabled',
      );
    }
  };

  const handleSecurityQuestion = () => {
    navigation.navigate('SecurityQuestion');
  };

  const handleLanguage = () => {
    navigation.navigate('Language');
  };

  const handleUpgradeToPremium = () => {
    navigation.navigate('Premium');
  };

  const handleContactSupport = () => {
    Alert.alert(
      t('settings.contact_support'),
      'Support email: support@applock.com',
    );
  };

  const handleAbout = () => {
    navigation.navigate('About');
  };

  const getCurrentLanguageName = () => {
    const language = languages.find(lang => lang.code === currentLanguage);
    return language ? language.nativeName : 'English';
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{t('settings.title')}</Text>

      {/* Security Status Card */}
      <Card style={styles.securityCard}>
        <Card.Content>
          <View style={styles.securityHeader}>
            <Text style={styles.securityTitle}>
              {t('settings.security_status')}
            </Text>
            <View
              style={[
                styles.statusIndicator,
                securityStatus.deviceSecure && securityStatus.appSecure
                  ? styles.statusSecure
                  : styles.statusWarning,
              ]}>
              <Text style={styles.statusText}>
                {securityStatus.deviceSecure && securityStatus.appSecure
                  ? t('settings.secure')
                  : t('settings.warning')}
              </Text>
            </View>
          </View>

          {securityStatus.warnings.length > 0 ? (
            <View style={styles.warningsContainer}>
              <Text style={styles.warningsTitle}>Security Warnings:</Text>
              {securityStatus.warnings.map((warning, index) => (
                <Text key={index} style={styles.warningItem}>
                  • {warning}
                </Text>
              ))}
            </View>
          ) : (
            <Text style={styles.secureText}>
              Your device and app are secure
            </Text>
          )}
        </Card.Content>
      </Card>

      <List.Section>
        <List.Subheader style={styles.sectionHeader}>
          {t('settings.security')}
        </List.Subheader>
        <List.Item
          title={t('settings.change_password')}
          description="Update your security PIN"
          left={props => <List.Icon {...props} icon="lock" color="#1E88E5" />}
          onPress={handleChangePassword}
        />
        <List.Item
          title={t('settings.biometric')}
          description="Use fingerprint to unlock apps"
          left={props => (
            <List.Icon {...props} icon="fingerprint" color="#1E88E5" />
          )}
          right={() => (
            <Switch
              value={biometricsEnabled}
              onValueChange={handleToggleBiometrics}
              thumbColor={biometricsEnabled ? '#1E88E5' : '#f4f3f4'}
              trackColor={{false: '#767577', true: '#BBDEFB'}}
            />
          )}
        />
        <List.Item
          title={t('settings.security_question')}
          description="Set up PIN recovery question"
          left={props => (
            <List.Icon {...props} icon="help-circle" color="#1E88E5" />
          )}
          onPress={handleSecurityQuestion}
        />
        <List.Item
          title={t('settings.language')}
          description={`${t(
            'settings.current_language',
          )}: ${getCurrentLanguageName()}`}
          left={props => (
            <List.Icon {...props} icon="translate" color="#1E88E5" />
          )}
          onPress={handleLanguage}
        />
      </List.Section>

      <Divider style={styles.divider} />

      <List.Section>
        <List.Subheader style={styles.sectionHeader}>
          {t('settings.premium')}
        </List.Subheader>
        <List.Item
          title={isPremium ? 'Premium Activated' : 'Upgrade to Premium'}
          description={
            isPremium
              ? 'Thank you for your support!'
              : 'Remove ads and get extra features'
          }
          left={props => (
            <List.Icon
              {...props}
              icon="crown"
              color={isPremium ? '#FFD700' : '#1E88E5'}
            />
          )}
          onPress={handleUpgradeToPremium}
        />
      </List.Section>

      <Divider style={styles.divider} />

      <List.Section>
        <List.Subheader style={styles.sectionHeader}>
          {t('settings.support')}
        </List.Subheader>
        <List.Item
          title={t('settings.contact_support')}
          description="Get help with the app"
          left={props => (
            <List.Icon {...props} icon="headset" color="#1E88E5" />
          )}
          onPress={handleContactSupport}
        />
        <List.Item
          title={t('settings.about')}
          description="App version and information"
          left={props => (
            <List.Icon {...props} icon="information" color="#1E88E5" />
          )}
          onPress={handleAbout}
        />
      </List.Section>

      <View style={styles.footer}>
        <Text style={styles.version}>{t('common.app_name')} v1.0.0</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 20,
    color: '#1E88E5',
  },
  securityCard: {
    margin: 16,
    borderRadius: 12,
    elevation: 4,
  },
  securityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  securityTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  statusIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusSecure: {
    backgroundColor: '#E8F5E9',
  },
  statusWarning: {
    backgroundColor: '#FFF3E0',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  warningsContainer: {
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
  },
  warningsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E65100',
    marginBottom: 4,
  },
  warningItem: {
    fontSize: 12,
    color: '#E65100',
    marginLeft: 8,
  },
  secureText: {
    fontSize: 14,
    color: '#4CAF50',
    textAlign: 'center',
  },
  sectionHeader: {
    color: '#1E88E5',
    fontWeight: '600',
  },
  divider: {
    marginVertical: 10,
    marginHorizontal: 16,
    backgroundColor: '#E0E0E0',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  version: {
    color: '#666',
    fontSize: 14,
  },
});

export default SettingsScreen;
