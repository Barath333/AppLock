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

const {AppLockModule, PermissionModule} = NativeModules;

// Import biometrics properly - handle the complex export structure
let biometricsModule;
try {
  const ReactNativeBiometrics = require('react-native-biometrics');
  console.log('Biometrics module loaded:', ReactNativeBiometrics);

  // Extract the actual biometrics module from the complex export
  // Try different possible export structures
  if (ReactNativeBiometrics.ReactNativeBiometricsLegacy) {
    biometricsModule = ReactNativeBiometrics.ReactNativeBiometricsLegacy;
    console.log('Using ReactNativeBiometricsLegacy');
  } else if (ReactNativeBiometrics.default) {
    biometricsModule = ReactNativeBiometrics.default;
    console.log('Using default export');
  } else {
    biometricsModule = ReactNativeBiometrics;
    console.log('Using direct export');
  }

  console.log('Available biometrics methods:', Object.keys(biometricsModule));
} catch (error) {
  console.warn('Biometrics module not available:', error);
  biometricsModule = null;
}

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

  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
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

  useEffect(() => {
    loadSettings();
    checkBiometricsAvailability();
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

  const checkBiometricsAvailability = async () => {
    try {
      if (!biometricsModule) {
        console.warn('Biometrics module not available');
        setBiometricsAvailable(false);

        // Check if biometrics is enabled in storage anyway
        const biometricsEnabledStorage = await AsyncStorage.getItem(
          'biometrics_enabled',
        );
        setBiometricsEnabled(biometricsEnabledStorage === 'true');
        return;
      }

      console.log('Checking biometrics with module:', biometricsModule);

      // Check if the method exists
      if (typeof biometricsModule.isSensorAvailable !== 'function') {
        console.warn('isSensorAvailable method not found in biometrics module');
        setBiometricsAvailable(false);
        return;
      }

      const {available, biometryType} =
        await biometricsModule.isSensorAvailable();

      setBiometricsAvailable(available);

      const biometricsEnabledStorage = await AsyncStorage.getItem(
        'biometrics_enabled',
      );
      setBiometricsEnabled(available && biometricsEnabledStorage === 'true');

      console.log('Biometrics available:', available, 'Type:', biometryType);
    } catch (error) {
      console.error('Error checking biometrics:', error);
      setBiometricsAvailable(false);

      // Fallback: check storage
      try {
        const biometricsEnabledStorage = await AsyncStorage.getItem(
          'biometrics_enabled',
        );
        setBiometricsEnabled(biometricsEnabledStorage === 'true');
      } catch (storageError) {
        setBiometricsEnabled(false);
      }
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
      try {
        if (!biometricsModule || !biometricsAvailable) {
          showAlert(
            t('alerts.error'),
            t('settings.biometrics_not_available'),
            'error',
          );
          return;
        }

        // Check if methods exist
        if (typeof biometricsModule.isSensorAvailable !== 'function') {
          showAlert(
            t('alerts.error'),
            'Biometrics methods not available',
            'error',
          );
          return;
        }

        const {available} = await biometricsModule.isSensorAvailable();

        if (!available) {
          showAlert(
            t('alerts.error'),
            t('settings.biometrics_not_available'),
            'error',
          );
          return;
        }

        const promptMessage =
          Platform.OS === 'ios'
            ? 'Authenticate with Face ID'
            : 'Authenticate with Biometrics';

        // Check if simplePrompt method exists
        if (typeof biometricsModule.simplePrompt !== 'function') {
          showAlert(
            t('alerts.error'),
            'Biometric prompt method not available',
            'error',
          );
          return;
        }

        const {success} = await biometricsModule.simplePrompt({
          promptMessage,
          cancelButtonText: 'Cancel',
        });

        if (success) {
          await AsyncStorage.setItem('biometrics_enabled', 'true');
          setBiometricsEnabled(true);
          showAlert(
            t('alerts.success'),
            t('settings.biometrics_enabled'),
            'success',
          );
        } else {
          showAlert(
            t('alerts.error'),
            t('settings.biometrics_failed'),
            'error',
          );
        }
      } catch (error) {
        console.error('Error enabling biometrics:', error);
        showAlert(t('alerts.error'), t('settings.biometrics_error'), 'error');
      }
    } else {
      await AsyncStorage.setItem('biometrics_enabled', 'false');
      setBiometricsEnabled(false);
      showAlert(
        t('settings.biometrics_disabled'),
        t('settings.biometrics_disabled_message'),
        'info',
      );
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
              !biometricsAvailable
                ? t('settings.biometric_module_unavailable')
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
                {!biometricsAvailable && (
                  <Text style={styles.unavailableText}>
                    {t('settings.module_unavailable')}
                  </Text>
                )}
                <Switch
                  value={biometricsEnabled}
                  onValueChange={handleToggleBiometrics}
                  disabled={!biometricsAvailable}
                  thumbColor={
                    biometricsEnabled && biometricsAvailable
                      ? theme.colors.primary
                      : '#f4f3f4'
                  }
                  trackColor={{
                    false: '#767577',
                    true: biometricsAvailable ? '#BBDEFB' : '#CCC',
                  }}
                />
              </View>
            )}
          />
        </Card.Content>
      </Card>

      {/* Permissions */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>{t('settings.permissions')}</Text>

          <List.Item
            title={t('settings.accessibility_service')}
            description={t('settings.accessibility_service_desc')}
            left={props => (
              <List.Icon
                {...props}
                icon="accessibility"
                color={theme.colors.primary}
              />
            )}
            right={props => (
              <View style={styles.statusContainer}>
                <Text
                  style={[
                    styles.statusText,
                    {
                      color: getPermissionStatusColor(
                        permissions.accessibility,
                      ),
                    },
                  ]}>
                  {getPermissionStatusText(permissions.accessibility)}
                </Text>
                <Button
                  mode="outlined"
                  compact
                  onPress={openAccessibilitySettings}
                  style={styles.smallButton}>
                  {t('settings.fix')}
                </Button>
              </View>
            )}
          />

          <Divider style={styles.divider} />

          <List.Item
            title={t('settings.overlay_permission')}
            description={t('settings.overlay_permission_desc')}
            left={props => (
              <List.Icon
                {...props}
                icon="window-maximize"
                color={theme.colors.primary}
              />
            )}
            right={props => (
              <View style={styles.statusContainer}>
                <Text
                  style={[
                    styles.statusText,
                    {color: getPermissionStatusColor(permissions.overlay)},
                  ]}>
                  {getPermissionStatusText(permissions.overlay)}
                </Text>
                <Button
                  mode="outlined"
                  compact
                  onPress={openOverlaySettings}
                  style={styles.smallButton}>
                  {t('settings.fix')}
                </Button>
              </View>
            )}
          />

          <Divider style={styles.divider} />

          <List.Item
            title={t('settings.usage_access')}
            description={t('settings.usage_access_desc')}
            left={props => (
              <List.Icon
                {...props}
                icon="chart-bar"
                color={theme.colors.primary}
              />
            )}
            right={props => (
              <View style={styles.statusContainer}>
                <Text
                  style={[
                    styles.statusText,
                    {color: getPermissionStatusColor(permissions.usageAccess)},
                  ]}>
                  {getPermissionStatusText(permissions.usageAccess)}
                </Text>
                <Button
                  mode="outlined"
                  compact
                  onPress={openUsageAccessSettings}
                  style={styles.smallButton}>
                  {t('settings.fix')}
                </Button>
              </View>
            )}
          />

          <Button
            mode="contained"
            onPress={testAccessibilityService}
            loading={isLoading}
            disabled={isLoading}
            style={styles.testButton}
            icon="test-tube">
            {t('settings.test_service')}
          </Button>
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

      {/* Premium Features */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>{t('settings.premium')}</Text>

          <List.Item
            title={
              isPremium
                ? t('settings.premium_activated')
                : t('settings.upgrade_premium')
            }
            description={
              isPremium
                ? t('settings.premium_thanks')
                : t('settings.premium_description')
            }
            left={props => (
              <List.Icon
                {...props}
                icon="crown"
                color={isPremium ? '#FFD700' : theme.colors.primary}
              />
            )}
            onPress={handleUpgradeToPremium}
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
            title={t('settings.about')}
            description={t('settings.about_desc')}
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
        <Text style={styles.version}>{t('common.app_name')} v1.0.0</Text>
        <Text style={styles.copyright}>
          © 2024 AppLock. All rights reserved.
        </Text>
        {!biometricsAvailable && (
          <Text style={styles.debugInfo}>
            Debug: Biometrics module not linked
          </Text>
        )}
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
  statusContainer: {
    alignItems: 'flex-end',
  },
  biometricContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unavailableText: {
    fontSize: 10,
    color: '#F44336',
    marginRight: 8,
  },
  smallButton: {
    marginTop: 4,
    height: 30,
  },
  testButton: {
    marginTop: 16,
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
    color: '#FF9800',
    fontSize: 10,
    marginTop: 8,
  },
});

export default SettingsScreen;
