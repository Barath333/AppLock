import React, {useState, useRef, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Image,
  Modal,
  AppState,
  BackHandler,
  NativeModules,
  StatusBar,
  Platform,
  TouchableOpacity,
  Keyboard,
  InteractionManager,
} from 'react-native';
import {TextInput} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Keychain from 'react-native-keychain';
import {BannerAd, BannerAdSize, TestIds} from 'react-native-google-mobile-ads';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useTranslation} from 'react-i18next';
import {useAlert} from '../contexts/AlertContext';
import { 
  initializeBiometrics, 
  isBiometricsAvailable, 
  authenticateWithBiometrics, 
  isBiometricsEnabled as checkBiometricsEnabled 
} from '../utils/biometrics';

const {AppLockModule} = NativeModules;

const adUnitId = __DEV__
  ? TestIds.ADAPTIVE_BANNER
  : 'ca-app-pub-8251684647444428~4262993578';

const {width, height} = Dimensions.get('window');

const LockScreen = ({visible, appInfo, onUnlock, onClose, onForgotPin, biometricsEnabled: propBiometricsEnabled}) => {
  const {t} = useTranslation();
  const {showAlert} = useAlert();
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState(null);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricsType, setBiometricsType] = useState('');
  const [showPinEntry, setShowPinEntry] = useState(true); // Start with PIN entry
  const [isAuthenticatingBiometrics, setIsAuthenticatingBiometrics] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const [hasAttemptedManualUnlock, setHasAttemptedManualUnlock] = useState(false);
  const textInputRef = useRef(null);
  const unlockInProgress = useRef(false);

  useEffect(() => {
    if (visible) {
      console.log('🔒 LockScreen mounted for app:', appInfo?.packageName);
      setPin('');
      setError('');
      setIsLoading(false);
      setHasAttemptedManualUnlock(false);
      unlockInProgress.current = false;
      loadFailedAttempts();
      checkBiometricsAvailability();

      // Bring app to front (only for other apps)
      if (appInfo?.packageName !== 'com.applock') {
        setTimeout(() => {
          AppLockModule.bringToFront();
        }, 100);
      }
    }
  }, [visible, appInfo]);

  const checkBiometricsAvailability = async () => {
    try {
      await initializeBiometrics();
      const {available, biometryType} = await isBiometricsAvailable();
      setBiometricsAvailable(available);
      setBiometricsType(biometryType || '');
      
      if (propBiometricsEnabled !== undefined) {
        setBiometricsEnabled(propBiometricsEnabled && available);
      } else {
        const enabled = await checkBiometricsEnabled();
        setBiometricsEnabled(enabled && available);
      }
    } catch (error) {
      console.error('Error checking biometrics availability:', error);
      setBiometricsAvailable(false);
      setBiometricsEnabled(false);
    }
  };

  const loadFailedAttempts = async () => {
    try {
      const attempts = await AsyncStorage.getItem('failed_attempts');
      const lockUntilTime = await AsyncStorage.getItem('lock_until');
      if (attempts) setFailedAttempts(parseInt(attempts, 10));
      if (lockUntilTime) {
        const lockTime = parseInt(lockUntilTime, 10);
        if (Date.now() < lockTime) setLockUntil(lockTime);
        else await resetFailedAttempts();
      }
    } catch (error) {
      console.error('Error loading failed attempts:', error);
    }
  };

  const resetFailedAttempts = async () => {
    setFailedAttempts(0);
    setLockUntil(null);
    try {
      await AsyncStorage.multiRemove(['failed_attempts', 'lock_until']);
    } catch (error) {
      console.error('Error resetting failed attempts:', error);
    }
  };

  const incrementFailedAttempts = async () => {
    const newFailedAttempts = failedAttempts + 1;
    setFailedAttempts(newFailedAttempts);
    if (newFailedAttempts >= 5) {
      const lockTime = Date.now() + 5 * 60 * 1000;
      setLockUntil(lockTime);
      try {
        await AsyncStorage.setItem('failed_attempts', newFailedAttempts.toString());
        await AsyncStorage.setItem('lock_until', lockTime.toString());
      } catch (error) {
        console.error('Error saving failed attempts:', error);
      }
    } else {
      try {
        await AsyncStorage.setItem('failed_attempts', newFailedAttempts.toString());
      } catch (error) {
        console.error('Error saving failed attempts:', error);
      }
    }
  };

  const handleBiometricUnlock = async () => {
    if (unlockInProgress.current || (lockUntil && Date.now() < lockUntil)) return;
    
    unlockInProgress.current = true;
    setIsAuthenticatingBiometrics(true);
    setError('');
    setHasAttemptedManualUnlock(true);
    Keyboard.dismiss();

    try {
      const promptMessage =
        Platform.OS === 'ios'
          ? t('lock_screen.unlock_with_face_id')
          : Platform.OS === 'android' && biometricsType === 'Fingerprint'
          ? t('lock_screen.unlock_with_fingerprint')
          : t('lock_screen.unlock_with_biometrics');

      const {success, error: authError} = await authenticateWithBiometrics(promptMessage);

      if (success) {
        console.log('✅ Biometric authentication successful');
        await resetFailedAttempts();
        if (onUnlock) {
          onUnlock();
        }
      } else {
        console.log('❌ Biometric authentication failed:', authError);
        setIsAuthenticatingBiometrics(false);
        unlockInProgress.current = false;
        
        if (authError && authError.includes('cancel')) {
          setError(t('lock_screen.tap_biometric_to_retry'));
        } else {
          setError(t('lock_screen.biometric_failed'));
          shakeError();
        }
      }
    } catch (error) {
      console.error('❌ Biometric authentication error:', error);
      setIsAuthenticatingBiometrics(false);
      unlockInProgress.current = false;
      setError(t('lock_screen.biometric_error'));
    }
  };

  const handlePinUnlock = async () => {
    if (unlockInProgress.current) {
      console.log('⏭️ Unlock already in progress, skipping');
      return;
    }
    
    Keyboard.dismiss();
    
    if (lockUntil && Date.now() < lockUntil) {
      const remainingTime = Math.ceil((lockUntil - Date.now()) / 1000 / 60);
      setError(t('lock_screen.too_many_attempts', {minutes: remainingTime}));
      return;
    }

    if (pin.length < 4) {
      setError(t('errors.pin_too_short'));
      return;
    }

    unlockInProgress.current = true;
    setIsLoading(true);
    setError('');

    try {
      console.log('🔑 Verifying PIN...');
      const credentials = await Keychain.getGenericPassword({
        service: 'applock_service',
      });

      if (credentials && credentials.password === pin) {
        console.log('✅ PIN verified successfully');
        await resetFailedAttempts();
        
        if (onUnlock) {
          onUnlock();
        }
      } else {
        console.log('❌ Invalid PIN');
        await incrementFailedAttempts();
        const remainingAttempts = 5 - (failedAttempts + 1);
        if (remainingAttempts > 0) {
          setError(
            t('lock_screen.invalid_pin') +
              ' ' +
              t('lock_screen.attempts_remaining', {count: remainingAttempts}),
          );
        } else {
          setError(t('lock_screen.too_many_attempts', {minutes: 5}));
        }
        setPin('');
        shakeError();
      }
    } catch (error) {
      console.error('🔑 Keychain error:', error);
      setError(t('errors.authentication_error'));
    } finally {
      setIsLoading(false);
      unlockInProgress.current = false;
    }
  };

  const shakeError = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  const handleForgotPin = async () => {
    console.log('🔓 Forgot PIN clicked in LockScreen');
    Keyboard.dismiss();
    if (onForgotPin) {
      onForgotPin();
    }
  };

  const switchToPinEntry = () => {
    setShowPinEntry(true);
    setError('');
    setIsAuthenticatingBiometrics(false);
    // Focus will be handled by autoFocus
  };

  const switchToBiometrics = () => {
    setShowPinEntry(false);
    setError('');
    setPin('');
    setIsAuthenticatingBiometrics(false);
    setHasAttemptedManualUnlock(false);
    Keyboard.dismiss();
  };

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (visible) {
          Keyboard.dismiss();
          return true;
        }
        return false;
      },
    );
    return () => backHandler.remove();
  }, [visible]);

  if (!visible || !appInfo) return null;

  const showBiometricOption = biometricsEnabled && biometricsAvailable && !showPinEntry;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      // hardwareAccelerated REMOVED – fixes rendering issues
      statusBarTranslucent={false}
      onRequestClose={() => {
        Keyboard.dismiss();
      }}
      presentationStyle="fullScreen"
      supportedOrientations={['portrait', 'landscape']}
    >
      <View style={styles.container}>
        <StatusBar
          backgroundColor="#FFFFFF"
          barStyle="dark-content"
          translucent={false}
        />

        <View style={styles.adContainer}>
          <BannerAd
            unitId={adUnitId}
            size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          />
        </View>

        <View style={styles.content}>
          <Animated.View
            style={[
              styles.appIconContainer,
              {transform: [{translateX: shakeAnim}]},
            ]}>
            <View style={styles.iconBackground}>
              {appInfo.icon ? (
                <Image
                  source={{uri: appInfo.icon}}
                  style={styles.appIconImage}
                />
              ) : (
                <Icon
                  name={appInfo.iconName || 'android'}
                  size={40}
                  color="#1E88E5"
                />
              )}
            </View>
          </Animated.View>

          <Text style={styles.appName}>
            {appInfo.name} {t('lock_screen.app_locked')}
          </Text>
          
          {showBiometricOption ? (
            <Text style={styles.prompt}>{t('lock_screen.use_biometrics')}</Text>
          ) : (
            <Text style={styles.prompt}>{t('lock_screen.enter_pin')}</Text>
          )}

          {lockUntil && Date.now() < lockUntil && (
            <View style={styles.lockWarning}>
              <Icon name="lock-alert" size={24} color="#FF9800" />
              <Text style={styles.lockWarningText}>
                {t('lock_screen.too_many_attempts', {
                  minutes: Math.ceil((lockUntil - Date.now()) / 1000 / 60),
                })}
              </Text>
            </View>
          )}

          {/* Biometric Unlock Option */}
          {showBiometricOption && (
            <Animated.View
              style={[
                styles.biometricContainer,
                {transform: [{translateX: shakeAnim}]},
              ]}>
              <TouchableOpacity
                style={[
                  styles.biometricButton,
                  isAuthenticatingBiometrics && styles.biometricButtonLoading,
                ]}
                onPress={handleBiometricUnlock}
                disabled={isAuthenticatingBiometrics || (lockUntil && Date.now() < lockUntil)}>
                <View style={styles.biometricIconContainer}>
                  {isAuthenticatingBiometrics ? (
                    <View style={styles.biometricLoading}>
                      <Icon name="loading" size={48} color="#1E88E5" />
                    </View>
                  ) : (
                    <>
                      <Icon
                        name={
                          Platform.OS === 'ios' 
                            ? 'face-recognition' 
                            : biometricsType === 'Fingerprint' 
                              ? 'fingerprint' 
                              : biometricsType === 'Face' 
                                ? 'face-recognition' 
                                : 'fingerprint'
                        }
                        size={64}
                        color="#1E88E5"
                      />
                      <Text style={styles.biometricSubText}>
                        {t('lock_screen.tap_to_authenticate')}
                      </Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>
              
              {/* Switch to PIN button */}
              <TouchableOpacity
                onPress={switchToPinEntry}
                style={styles.switchButton}>
                <Text style={styles.switchButtonText}>
                  {t('lock_screen.use_pin_instead')}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* PIN Entry Option */}
          {(!showBiometricOption || showPinEntry) && (
            <Animated.View
              style={[
                styles.inputContainer,
                {transform: [{translateX: shakeAnim}]},
              ]}>
              <TextInput
                ref={textInputRef}
                value={pin}
                onChangeText={text => {
                  setPin(text);
                  setError('');
                }}
                secureTextEntry={!showPin}
                keyboardType="numeric"
                style={styles.pinInput}
                maxLength={6}
                mode="flat"
                underlineColor="transparent"
                selectionColor="#1E88E5"
                theme={{
                  colors: {
                    primary: '#1E88E5',
                    text: '#333',
                    placeholder: '#888',
                  },
                }}
                editable={!lockUntil || Date.now() >= lockUntil}
                placeholder={t('setup.enter_pin')}
                returnKeyType="go"
                onSubmitEditing={handlePinUnlock}
                right={
                  <TextInput.Icon
                    icon={showPin ? 'eye-off' : 'eye'}
                    onPress={() => setShowPin(!showPin)}
                    color="#1E88E5"
                  />
                }
                autoFocus={true}   // Let React Native handle focus automatically
              />
              
              {/* Switch back to biometrics if available */}
              {biometricsEnabled && biometricsAvailable && showPinEntry && (
                <TouchableOpacity
                  onPress={switchToBiometrics}
                  style={styles.switchToBiometricsButton}>
                  <Icon 
                    name={
                      Platform.OS === 'ios' 
                        ? 'face-recognition' 
                        : 'fingerprint'
                    } 
                    size={16} 
                    color="#1E88E5" 
                  />
                  <Text style={styles.switchToBiometricsText}>
                    {t('lock_screen.use_biometrics_instead')}
                  </Text>
                </TouchableOpacity>
              )}
            </Animated.View>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* Unlock Button (only shown for PIN entry) */}
          {(!showBiometricOption || showPinEntry) && (
            <TouchableOpacity
              onPress={handlePinUnlock}
              disabled={
                pin.length < 4 ||
                isLoading ||
                (lockUntil && Date.now() < lockUntil) ||
                unlockInProgress.current
              }
              style={[
                styles.unlockButton,
                (pin.length < 4 ||
                  isLoading ||
                  (lockUntil && Date.now() < lockUntil) ||
                  unlockInProgress.current) &&
                  styles.unlockButtonDisabled,
              ]}>
              <Text style={styles.unlockButtonText}>
                {isLoading ? t('common.loading') : t('lock_screen.unlock')}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={handleForgotPin}
            style={styles.forgotButton}>
            <Text style={styles.forgotButtonText}>
              {t('lock_screen.forgot_pin')}
            </Text>
          </TouchableOpacity>
        </View>

        <BannerAd
          unitId={adUnitId}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        />

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {t('common.app_name')} - {t('splash.subtitle')}
          </Text>
        </View>
      </View>
    </Modal>
  );
};

// Styles (unchanged, kept as in original)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'space-between',
  },
  adContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  appIconContainer: {
    marginBottom: 30,
  },
  iconBackground: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  appIconImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
    textAlign: 'center',
  },
  prompt: {
    fontSize: 16,
    marginBottom: 30,
    color: '#666',
    textAlign: 'center',
  },
  lockWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  lockWarningText: {
    marginLeft: 8,
    color: '#E65100',
    fontSize: 14,
    flex: 1,
  },
  biometricContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  biometricButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  biometricButtonLoading: {
    backgroundColor: '#E3F2FD',
  },
  biometricIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  biometricLoading: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  biometricText: {
    marginTop: 12,
    fontSize: 16,
    color: '#1E88E5',
    textAlign: 'center',
    fontWeight: '500',
  },
  biometricSubText: {
    marginTop: 4,
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  switchButton: {
    marginTop: 25,
    padding: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    width: '80%',
    alignItems: 'center',
  },
  switchButtonText: {
    color: '#1E88E5',
    fontSize: 14,
    fontWeight: '500',
  },
  inputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  pinInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    height: 50,
  },
  switchToBiometricsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
    padding: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
  },
  switchToBiometricsText: {
    color: '#1E88E5',
    fontSize: 14,
    marginLeft: 6,
    fontWeight: '500',
  },
  error: {
    color: '#FF3B30',
    marginBottom: 20,
    fontSize: 14,
    textAlign: 'center',
  },
  unlockButton: {
    backgroundColor: '#1E88E5',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 15,
    elevation: 4,
  },
  unlockButtonDisabled: {
    backgroundColor: '#BBDEFB',
  },
  unlockButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  forgotButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  forgotButtonText: {
    color: '#1E88E5',
    fontSize: 14,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    color: '#888',
    fontSize: 12,
  },
});

export default LockScreen;