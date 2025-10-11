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
} from 'react-native';
import {TextInput, Button} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Keychain from 'react-native-keychain';
import {BannerAd, BannerAdSize, TestIds} from 'react-native-google-mobile-ads';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useTranslation} from 'react-i18next';
import {useAlert} from '../contexts/AlertContext';

const {AppLockModule} = NativeModules;

const adUnitId = __DEV__
  ? TestIds.ADAPTIVE_BANNER
  : 'ca-app-pub-8251684647444428~4262993578';

const {width, height} = Dimensions.get('window');

const LockScreen = ({visible, appInfo, onUnlock, onClose, onForgotPin}) => {
  const {t} = useTranslation();
  const {showAlert} = useAlert();
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      console.log('🔒 LockScreen mounted for app:', appInfo?.packageName);
      setPin('');
      setError('');
      setIsLoading(false);
      loadFailedAttempts();

      // Ensure the app is brought to front when lock screen becomes visible
      setTimeout(() => {
        AppLockModule.bringToFront();
      }, 100);
    }
  }, [visible, appInfo]);

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
        await AsyncStorage.setItem(
          'failed_attempts',
          newFailedAttempts.toString(),
        );
        await AsyncStorage.setItem('lock_until', lockTime.toString());
      } catch (error) {
        console.error('Error saving failed attempts:', error);
      }
    } else {
      try {
        await AsyncStorage.setItem(
          'failed_attempts',
          newFailedAttempts.toString(),
        );
      } catch (error) {
        console.error('Error saving failed attempts:', error);
      }
    }
  };

  const handleUnlock = async () => {
    if (lockUntil && Date.now() < lockUntil) {
      const remainingTime = Math.ceil((lockUntil - Date.now()) / 1000 / 60);
      setError(t('lock_screen.too_many_attempts', {minutes: remainingTime}));
      return;
    }

    if (pin.length < 4) {
      setError(t('errors.pin_too_short'));
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      console.log('🔑 Verifying PIN...');
      const credentials = await Keychain.getGenericPassword({
        service: 'applock_service',
      });
      console.log('📋 PIN verification result:', {
        hasCredentials: !!credentials,
        enteredPIN: pin,
      });

      if (credentials && credentials.password === pin) {
        console.log('✅ PIN verified successfully');
        await resetFailedAttempts();
        if (onUnlock) {
          console.log('🔄 Calling onUnlock callback');
          onUnlock();
        } else if (
          AppLockModule &&
          typeof AppLockModule.closeLockScreen === 'function'
        ) {
          AppLockModule.closeLockScreen();
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
        // Shake animation
        Animated.sequence([
          Animated.timing(shakeAnim, {
            toValue: 10,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(shakeAnim, {
            toValue: -10,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(shakeAnim, {
            toValue: 10,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(shakeAnim, {
            toValue: 0,
            duration: 100,
            useNativeDriver: true,
          }),
        ]).start();
      }
    } catch (error) {
      console.error('🔑 Keychain error:', error);
      setError(t('errors.authentication_error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPin = async () => {
    try {
      const securityQuestion = await AsyncStorage.getItem('security_question');
      const securityAnswer = await AsyncStorage.getItem('security_answer');
      if (securityQuestion && securityAnswer) {
        console.log('🔄 Calling onForgotPin prop - Security Q&A exists');
        if (onForgotPin) onForgotPin();
        if (onClose) onClose();
      } else {
        console.log('🔄 No security Q&A - showing reset confirmation');
        showAlert(
          t('alerts.reset_pin'),
          t('forgot_pin.reset_warning'),
          'warning',
          [
            {text: t('common.cancel'), style: 'cancel'},
            {
              text: t('alerts.reset'),
              onPress: async () => {
                try {
                  console.log('🔄 User confirmed reset - calling onForgotPin');
                  if (onForgotPin) onForgotPin();
                } catch (error) {
                  console.error('Error in reset confirmation:', error);
                  showAlert(
                    t('alerts.error'),
                    t('errors.reset_failed'),
                    'error',
                  );
                }
              },
              style: 'destructive',
            },
          ],
        );
      }
    } catch (error) {
      console.error('Error checking security question:', error);
    }
  };

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (visible) {
          console.log('🔒 Back button blocked in lock screen');
          return true;
        }
        return false;
      },
    );
    return () => backHandler.remove();
  }, [visible]);

  if (!visible || !appInfo) return null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      hardwareAccelerated
      statusBarTranslucent={false}
      onRequestClose={() => console.log('🔒 Lock screen back button pressed')}
      presentationStyle="fullScreen"
      supportedOrientations={['portrait', 'landscape']}>
      {/* FIX: Use View instead of TouchableWithoutFeedback for better performance */}
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
          <Text style={styles.prompt}>{t('lock_screen.enter_pin')}</Text>

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

          <Animated.View
            style={[
              styles.inputContainer,
              {transform: [{translateX: shakeAnim}]},
            ]}>
            <TextInput
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
              right={
                <TextInput.Icon
                  icon={showPin ? 'eye-off' : 'eye'}
                  onPress={() => setShowPin(!showPin)}
                  color="#1E88E5"
                />
              }
              autoFocus={true} // Auto focus for better UX
            />
          </Animated.View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            onPress={handleUnlock}
            disabled={
              pin.length < 4 ||
              isLoading ||
              (lockUntil && Date.now() < lockUntil)
            }
            style={[
              styles.unlockButton,
              (pin.length < 4 ||
                isLoading ||
                (lockUntil && Date.now() < lockUntil)) &&
                styles.unlockButtonDisabled,
            ]}>
            <Text style={styles.unlockButtonText}>
              {isLoading ? t('common.loading') : t('lock_screen.unlock')}
            </Text>
          </TouchableOpacity>

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
  inputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  pinInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    height: 50,
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
