// SettingsScreen.js - UPDATED VERSION
import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Linking,
  Alert,
  Platform,
} from 'react-native';
import {List, Button, Divider, Card, useTheme} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {useLanguage} from '../contexts/LanguageContext';
import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useAlert} from '../contexts/AlertContext';
import {NativeModules} from 'react-native';
import { 
  initializeBiometrics, 
  isBiometricsAvailable, 
  authenticateWithBiometrics, 
  isBiometricsEnabled as checkBiometricsEnabled, 
  setBiometricsEnabled 
} from '../utils/biometrics';

const {AppLockModule, PermissionModule} = NativeModules;

// Import DeviceInfo properly
let DeviceInfo;
try {
  DeviceInfo = require('react-native-device-info');
  console.log('DeviceInfo module loaded:', DeviceInfo);
} catch (error) {
  console.warn('DeviceInfo module not available:', error);
  DeviceInfo = null;
}

const SettingsScreen = () => {
  const navigation = useNavigation();
  const {t} = useTranslation();
  const {currentLanguage, languages} = useLanguage();
  const {showAlert} = useAlert();
  const theme = useTheme();

  const [biometricsEnabled, setBiometricsEnabledState] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [securityStatus, setSecurityStatus] = useState({
    deviceSecure: true,
    appSecure: true,
    warnings: [],
  });
  const [autoLockNewApps, setAutoLockNewApps] = useState(true);
  const [permissions, setPermissions] = useState({
    accessibility: false,
    overlay: false,
    usageAccess: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricsType, setBiometricsType] = useState('');
  const [isCheckingBiometrics, setIsCheckingBiometrics] = useState(false);

  useEffect(() => {
    console.log('⚙️ SettingsScreen mounted');
    loadSettings();
    checkBiometrics();
    checkSecurityStatus();
    loadPermissions();
  }, []);

  const loadSettings = async () => {
    try {
      if (AppLockModule && AppLockModule.getAutoLockNewApps) {
        const autoLock = await AppLockModule.getAutoLockNewApps();
        setAutoLockNewApps(autoLock);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const loadPermissions = async () => {
    try {
      if (PermissionModule) {
        const accessibility = PermissionModule.getAccessibilityServiceStatus
          ? await PermissionModule.getAccessibilityServiceStatus()
          : false;

        const overlay = PermissionModule.isOverlayPermissionGranted
          ? await PermissionModule.isOverlayPermissionGranted()
          : false;

        const usageAccess = PermissionModule.isUsageAccessGranted
          ? await PermissionModule.isUsageAccessGranted()
          : false;

        setPermissions({
          accessibility,
          overlay,
          usageAccess,
        });
      }
    } catch (error) {
      console.error('Error loading permissions:', error);
    }
  };

  const checkSecurityStatus = async () => {
    try {
      let deviceSecurity = {isRooted: false, isJailBroken: false};
      let appTampering = {isEmulator: false, isTampered: false};

      // Use the local DeviceInfo
      if (DeviceInfo) {
        if (typeof DeviceInfo.isRooted === 'function') {
          deviceSecurity.isRooted = await DeviceInfo.isRooted();
        }
        if (typeof DeviceInfo.isJailBroken === 'function') {
          deviceSecurity.isJailBroken = await DeviceInfo.isJailBroken();
        }
        if (typeof DeviceInfo.isEmulator === 'function') {
          appTampering.isEmulator = await DeviceInfo.isEmulator();
        }
      }

      const warnings = [];
      if (deviceSecurity.isRooted)
        warnings.push(t('settings.warnings.rooted_device'));
      if (deviceSecurity.isJailBroken)
        warnings.push(t('settings.warnings.jailbroken_device'));
      if (appTampering.isEmulator)
        warnings.push(t('settings.warnings.emulator'));

      // Add permission warnings
      if (!permissions.accessibility)
        warnings.push(t('settings.warnings.accessibility_disabled'));
      if (!permissions.overlay)
        warnings.push(t('settings.warnings.overlay_disabled'));
      if (!permissions.usageAccess)
        warnings.push(t('settings.warnings.usage_access_disabled'));

      setSecurityStatus({
        deviceSecure: !deviceSecurity.isRooted && !deviceSecurity.isJailBroken,
        appSecure: !appTampering.isTampered,
        warnings,
      });
    } catch (error) {
      console.error('Error checking security status:', error);
      setSecurityStatus({
        deviceSecure: true,
        appSecure: true,
        warnings: [],
      });
    }
  };

  const checkBiometrics = async () => {
    try {
      console.log('🔍 Checking biometrics status...');
      setIsCheckingBiometrics(true);
      
      // Initialize biometrics first
      const initialized = await initializeBiometrics();
      console.log('🔧 Biometrics initialized:', initialized);
      
      if (initialized) {
        // Check availability
        const {available, biometryType} = await isBiometricsAvailable();
        console.log('📋 Biometrics availability:', available, 'Type:', biometryType);
        
        setBiometricsAvailable(available);
        setBiometricsType(biometryType || '');
        
        // Check if enabled in AsyncStorage
        try {
          const enabledValue = await AsyncStorage.getItem('biometrics_enabled');
          console.log('📂 Reading from AsyncStorage - biometrics_enabled:', enabledValue);
          
          const enabled = enabledValue === 'true';
          setBiometricsEnabledState(enabled && available);
          console.log('✅ Biometrics enabled state:', enabled && available);
        } catch (storageError) {
          console.error('❌ Error reading from AsyncStorage:', storageError);
          setBiometricsEnabledState(false);
        }
      } else {
        console.log('❌ Biometrics not initialized');
        setBiometricsAvailable(false);
        setBiometricsEnabledState(false);
      }
    } catch (error) {
      console.error('❌ Error checking biometrics:', error);
      setBiometricsAvailable(false);
      setBiometricsEnabledState(false);
    } finally {
      setIsCheckingBiometrics(false);
    }
  };

  const handleToggleAutoLock = async value => {
    try {
      if (AppLockModule && AppLockModule.setAutoLockNewApps) {
        await AppLockModule.setAutoLockNewApps(value);
      }
      setAutoLockNewApps(value);
      showAlert(
        t('alerts.success'),
        value
          ? t('settings.auto_lock_enabled')
          : t('settings.auto_lock_disabled'),
        'success',
      );
    } catch (error) {
      console.error('Error toggling auto-lock:', error);
      showAlert(t('alerts.error'), t('errors.setting_update_failed'), 'error');
    }
  };

  const handleToggleBiometrics = async value => {
    if (value) {
      // Enable biometrics
      try {
        console.log('🔐 Attempting to enable biometrics...');
        
        // First verify biometrics are available
        const {available} = await isBiometricsAvailable();
        if (!available) {
          showAlert(
            t('alerts.error'),
            t('settings.biometric_not_supported'),
            'error',
          );
          return;
        }

        // Show biometrics prompt
      const promptMessage =
  Platform.OS === 'ios'
    ? t('settings.enable_face_id_prompt')
    : t('settings.enable_biometrics_prompt');
        
        const {success, error: authError} = await authenticateWithBiometrics(promptMessage);

        if (success) {
          console.log('✅ Biometric authentication successful');
          
          // Save to AsyncStorage
          try {
            await AsyncStorage.setItem('biometrics_enabled', 'true');
            console.log('💾 Saved biometrics_enabled=true to AsyncStorage');
            
            // Update state
            setBiometricsEnabledState(true);
            
            showAlert(
              t('alerts.success'),
              t('settings.biometrics_enabled'),
              'success',
            );
          } catch (storageError) {
            console.error('❌ Error saving to AsyncStorage:', storageError);
            showAlert(t('alerts.error'), t('errors.setting_save_failed'), 'error');
          }
        } else {
          console.log('❌ Biometric authentication failed:', authError);
          showAlert(
            t('alerts.error'),
            authError || t('settings.biometrics_failed'),
            'error',
          );
        }
      } catch (error) {
        console.error('❌ Error enabling biometrics:', error);
        showAlert(t('alerts.error'), t('settings.biometrics_error'), 'error');
      }
    } else {
      // Disable biometrics
      try {
        console.log('❌ Disabling biometrics...');
        await AsyncStorage.setItem('biometrics_enabled', 'false');
        console.log('💾 Saved biometrics_enabled=false to AsyncStorage');
        
        setBiometricsEnabledState(false);
        
        showAlert(
          t('settings.biometrics_disabled'),
          t('settings.biometrics_disabled_message'),
          'info',
        );
      } catch (error) {
        console.error('❌ Error disabling biometrics:', error);
        showAlert(t('alerts.error'), t('errors.setting_save_failed'), 'error');
      }
    }
  };

  const handleChangePassword = () => {
    navigation.navigate('ChangePassword');
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
    Linking.openURL('mailto:support@applock.com?subject=AppLock Support');
  };

  const handleAbout = () => {
    navigation.navigate('About');
  };

  const openAccessibilitySettings = () => {
    if (PermissionModule && PermissionModule.openAccessibilitySettings) {
      PermissionModule.openAccessibilitySettings();
    } else {
      showAlert(
        t('alerts.error'),
        'Cannot open accessibility settings',
        'error',
      );
    }
  };

  const openOverlaySettings = () => {
    if (PermissionModule && PermissionModule.openOverlayPermissionSettings) {
      PermissionModule.openOverlayPermissionSettings();
    } else {
      showAlert(t('alerts.error'), 'Cannot open overlay settings', 'error');
    }
  };

  const openUsageAccessSettings = () => {
    if (PermissionModule && PermissionModule.openUsageAccessSettings) {
      PermissionModule.openUsageAccessSettings();
    } else {
      showAlert(
        t('alerts.error'),
        'Cannot open usage access settings',
        'error',
      );
    }
  };

  const testAccessibilityService = async () => {
    try {
      setIsLoading(true);
      let isRunning = false;

      if (AppLockModule && AppLockModule.isAccessibilityServiceRunning) {
        isRunning = await AppLockModule.isAccessibilityServiceRunning();
      }

      if (isRunning) {
        showAlert(
          t('alerts.success'),
          t('settings.accessibility_working'),
          'success',
        );
      } else {
        showAlert(
          t('alerts.warning'),
          t('settings.accessibility_not_working'),
          'warning',
        );
      }
    } catch (error) {
      showAlert(t('alerts.error'), t('errors.test_failed'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const resetAppData = () => {
    Alert.alert(t('settings.reset_data'), t('settings.reset_confirmation'), [
      {
        text: t('common.cancel'),
        style: 'cancel',
      },
      {
        text: t('alerts.reset'),
        style: 'destructive',
        onPress: async () => {
          try {
            await AsyncStorage.multiRemove([
              'lockedApps',
              'initialSetupDone',
              'biometrics_enabled',
            ]);

            if (
              AppLockModule &&
              typeof AppLockModule.setLockedApps === 'function'
            ) {
              await AppLockModule.setLockedApps([]);
            }

            // Reset local state
            setBiometricsEnabledState(false);

            showAlert(
              t('alerts.success'),
              t('settings.reset_success'),
              'success',
            );
          } catch (error) {
            console.error('Error resetting app data:', error);
            showAlert(t('alerts.error'), t('errors.reset_failed'), 'error');
          }
        },
      },
    ]);
  };

  const getPermissionStatusColor = enabled => {
    return enabled ? '#4CAF50' : '#F44336';
  };

  const getPermissionStatusText = enabled => {
    return enabled ? t('settings.enabled') : t('settings.disabled');
  };

  const getCurrentLanguageName = () => {
    const language = languages.find(lang => lang.code === currentLanguage);
    return language ? language.nativeName : 'English';
  };

  const refreshBiometricsStatus = () => {
    checkBiometrics();
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
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
                securityStatus.deviceSecure &&
                securityStatus.appSecure &&
                permissions.accessibility &&
                permissions.overlay &&
                permissions.usageAccess
                  ? styles.statusSecure
                  : styles.statusWarning,
              ]}>
              <Text style={styles.statusText}>
                {securityStatus.deviceSecure &&
                securityStatus.appSecure &&
                permissions.accessibility &&
                permissions.overlay &&
                permissions.usageAccess
                  ? t('settings.secure')
                  : t('settings.warning')}
              </Text>
            </View>
          </View>

          {securityStatus.warnings.length > 0 ? (
            <View style={styles.warningsContainer}>
              <Text style={styles.warningsTitle}>
                {t('settings.security_warnings')}
              </Text>
              {securityStatus.warnings.map((warning, index) => (
                <Text key={index} style={styles.warningItem}>
                  • {warning}
                </Text>
              ))}
            </View>
          ) : (
            <Text style={styles.secureText}>
              {t('settings.device_app_secure')}
            </Text>
          )}
        </Card.Content>
      </Card>

      {/* App Settings */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>{t('settings.app_settings')}</Text>

          <List.Item
            title={t('settings.auto_lock_new_apps')}
            description={t('settings.auto_lock_new_apps_desc')}
            left={props => (
              <List.Icon
                {...props}
                icon="lock-plus"
                color={theme.colors.primary}
              />
            )}
            right={props => (
              <Switch
                value={autoLockNewApps}
                onValueChange={handleToggleAutoLock}
                color={theme.colors.primary}
              />
            )}
          />

          <Divider style={styles.divider} />

          <List.Item
            title={t('settings.change_password')}
            description={t('settings.change_password_desc')}
            left={props => (
              <List.Icon
                {...props}
                icon="key-change"
                color={theme.colors.primary}
              />
            )}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={handleChangePassword}
          />

          <Divider style={styles.divider} />

          <List.Item
            title={t('settings.security_question')}
            description={t('settings.security_question_desc')}
            left={props => (
              <List.Icon
                {...props}
                icon="shield-key"
                color={theme.colors.primary}
              />
            )}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={handleSecurityQuestion}
          />
        </Card.Content>
      </Card>

      {/* Security & Authentication */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>{t('settings.security_auth')}</Text>

          <List.Item
            title={t('settings.biometric')}
            description={
              isCheckingBiometrics
                ? t('settings.checking_biometrics')
                : !biometricsAvailable
                ? t('settings.biometric_not_supported')
                : biometricsType
                  ? `${t('settings.biometric_available')}: ${biometricsType}`
                  : t('settings.biometric_desc')
            }
            left={props => (
              <List.Icon
                {...props}
                icon="fingerprint"
                color={biometricsAvailable ? theme.colors.primary : '#999'}
              />
            )}
            right={() => (
              <View style={styles.biometricContainer}>
                {isCheckingBiometrics ? (
                  <Text style={styles.checkingText}>
                    {t('common.checking')}
                  </Text>
                ) : !biometricsAvailable ? (
                  <Text style={styles.unavailableText}>
                    {t('settings.not_supported')}
                  </Text>
                ) : (
                  <Switch
                    value={biometricsEnabled}
                    onValueChange={handleToggleBiometrics}
                    disabled={isCheckingBiometrics}
                    thumbColor={
                      biometricsEnabled
                        ? theme.colors.primary
                        : '#f4f3f4'
                    }
                    trackColor={{
                      false: '#767577',
                      true: theme.colors.primary,
                    }}
                  />
                )}
              </View>
            )}
          />
          
          {biometricsAvailable && (
            <Button
              mode="outlined"
              onPress={refreshBiometricsStatus}
              style={styles.refreshButton}
              icon="refresh"
              compact>
              {t('settings.refresh_status')}
            </Button>
          )}
        </Card.Content>
      </Card>

      {/* Language & Regional */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>
            {t('settings.language_regional')}
          </Text>

          <List.Item
            title={t('settings.language')}
            description={`${t(
              'settings.current_language',
            )}: ${getCurrentLanguageName()}`}
            left={props => (
              <List.Icon
                {...props}
                icon="translate"
                color={theme.colors.primary}
              />
            )}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={handleLanguage}
          />
        </Card.Content>
      </Card>

      {/* Maintenance */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>{t('settings.maintenance')}</Text>

          <List.Item
            title={t('settings.reset_app_data')}
            description={t('settings.reset_app_data_desc')}
            left={props => (
              <List.Icon
                {...props}
                icon="refresh"
                color={theme.colors.primary}
              />
            )}
            right={props => (
              <List.Icon {...props} icon="alert" color="#F44336" />
            )}
            onPress={resetAppData}
          />
      </Card.Content>
      </Card>

      {/* Support */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>{t('settings.support')}</Text>

          <List.Item
            title={t('settings.contact_support')}
            description={t('settings.contact_support_desc')}
            left={props => (
              <List.Icon
                {...props}
                icon="headset"
                color={theme.colors.primary}
              />
            )}
            onPress={handleContactSupport}
          />

          <Divider style={styles.divider} />

   <List.Item
  title={t('settings.about_button_title')}
  description={t('settings.about_button_desc')}
  left={props => (
    <List.Icon
      {...props}
      icon="information"
      color={theme.colors.primary}
    />
  )}
  onPress={handleAbout}
/>
        </Card.Content>
      </Card>

  <View style={styles.footer}>
<Text style={styles.version}>
  {t('settings.app_version')}
</Text>

<Text style={styles.copyright}>
  {t('settings.copyright', {year: new Date().getFullYear()})}
</Text>

  {/* <Text style={styles.debugInfo}>
    Biometrics: {biometricsAvailable ? 'Available' : 'Not Available'} |{' '}
    Enabled: {biometricsEnabled ? 'Yes' : 'No'} |{' '}
    Type: {biometricsType || 'None'}
  </Text> */}
</View>


    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 20,
    color: '#1E88E5',
  },
  securityCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 4,
  },
  card: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
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
  divider: {
    marginVertical: 8,
  },
  biometricContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkingText: {
    fontSize: 12,
    color: '#FF9800',
    marginRight: 8,
  },
  unavailableText: {
    fontSize: 12,
    color: '#F44336',
    marginRight: 8,
  },
  refreshButton: {
    marginTop: 16,
    alignSelf: 'center',
  },
  footer: {
    alignItems: 'center',
    padding: 20,
  },
  version: {
    color: '#666',
    fontSize: 14,
    marginBottom: 4,
  },
  copyright: {
    color: '#999',
    fontSize: 12,
  },
  debugInfo: {
    color: '#666',
    fontSize: 10,
    marginTop: 8,
    textAlign: 'center',
  },
});

export default SettingsScreen;