import React, {useState, useRef, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
  Image,
  Modal,
  AppState,
  BackHandler,
  Alert,
  NativeModules,
} from 'react-native';
import {TextInput, Button} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Keychain from 'react-native-keychain';
import {BannerAd, BannerAdSize, TestIds} from 'react-native-google-mobile-ads';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useTranslation} from 'react-i18next';

const {AppLockModule} = NativeModules;

const adUnitId = __DEV__
  ? TestIds.ADAPTIVE_BANNER
  : 'ca-app-pub-8251684647444428~4262993578';

const {width, height} = Dimensions.get('window');

const LockScreen = ({visible, appInfo, onUnlock, onClose, onForgotPin}) => {
  const {t} = useTranslation();
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setPin('');
      setError('');
      setIsLoading(false);
      loadFailedAttempts();
      console.log('🔍 AppLockModule methods:', Object.keys(AppLockModule));
    }
  }, [visible, appInfo]);

  const loadFailedAttempts = async () => {
    try {
      const attempts = await AsyncStorage.getItem('failed_attempts');
      const lockUntilTime = await AsyncStorage.getItem('lock_until');

      if (attempts) {
        setFailedAttempts(parseInt(attempts, 10));
      }
      if (lockUntilTime) {
        const lockTime = parseInt(lockUntilTime, 10);
        if (Date.now() < lockTime) {
          setLockUntil(lockTime);
        } else {
          await resetFailedAttempts();
        }
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
        storedPIN: credentials ? credentials.password : 'none',
        enteredPIN: pin,
      });

      if (credentials && credentials.password === pin) {
        console.log('✅ PIN verified successfully');
        await resetFailedAttempts();

        if (appInfo?.packageName) {
          console.log(
            '🚀 Attempting to launch original app:',
            appInfo.packageName,
          );

          if (typeof AppLockModule.launchApp === 'function') {
            console.log('✅ launchApp method is available');
            AppLockModule.launchApp(appInfo.packageName);
          } else {
            console.log(
              '❌ launchApp method not available, using closeLockScreen',
            );
            AppLockModule.closeLockScreen();
          }
        } else {
          console.log('❌ No package name available, using closeLockScreen');
          AppLockModule.closeLockScreen();
        }

        onUnlock();
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
        console.log('🔄 Calling onForgotPin prop');
        if (onForgotPin) {
          onForgotPin();
        }
        onClose();
      } else {
        Alert.alert(t('alerts.reset_pin'), t('forgot_pin.reset_warning'), [
          {
            text: t('common.cancel'),
            style: 'cancel',
          },
          {
            text: t('alerts.reset'),
            onPress: async () => {
              try {
                await Keychain.resetGenericPassword({
                  service: 'applock_service',
                });
                await AsyncStorage.removeItem('lockedApps');
                if (
                  AppLockModule &&
                  typeof AppLockModule.setLockedApps === 'function'
                ) {
                  await AppLockModule.setLockedApps([]);
                }
                await resetFailedAttempts();

                Alert.alert(
                  t('alerts.success'),
                  t('forgot_pin.reset_success'),
                  [
                    {
                      text: t('common.ok'),
                      onPress: () => {
                        onClose();
                        if (onForgotPin) {
                          onForgotPin();
                        }
                      },
                    },
                  ],
                );
              } catch (error) {
                console.error('Error resetting PIN:', error);
                Alert.alert(t('alerts.error'), t('errors.reset_failed'));
              }
            },
            style: 'destructive',
          },
        ]);
      }
    } catch (error) {
      console.error('Error checking security question:', error);
    }
  };

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => visible,
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
      statusBarTranslucent
      onRequestClose={() => {
        if (visible) {
          return;
        }
      }}>
      <View style={styles.container}>
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
                colors: {primary: '#1E88E5', text: '#333', placeholder: '#888'},
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
            />
          </Animated.View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            mode="contained"
            onPress={handleUnlock}
            style={styles.unlockButton}
            disabled={
              pin.length < 4 ||
              isLoading ||
              (lockUntil && Date.now() < lockUntil)
            }
            loading={isLoading}
            labelStyle={styles.unlockButtonLabel}>
            {t('lock_screen.unlock')}
          </Button>

          <Button
            mode="text"
            onPress={handleForgotPin}
            style={styles.forgotButton}
            labelStyle={styles.forgotButtonLabel}>
            {t('lock_screen.forgot_pin')}
          </Button>
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
    alignItems: 'center',
  },
  adContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    marginTop: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
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
  },
  error: {
    color: '#FF3B30',
    marginBottom: 20,
    fontSize: 14,
    textAlign: 'center',
  },
  unlockButton: {
    marginBottom: 15,
    borderRadius: 12,
    backgroundColor: '#1E88E5',
    width: '100%',
    elevation: 4,
  },
  unlockButtonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    paddingVertical: 6,
    color: '#FFF',
  },
  forgotButton: {
    marginBottom: 20,
  },
  forgotButtonLabel: {
    fontSize: 14,
    color: '#1E88E5',
  },
  footer: {
    padding: 20,
  },
  footerText: {
    color: '#888',
    fontSize: 12,
  },
});

export default LockScreen;
