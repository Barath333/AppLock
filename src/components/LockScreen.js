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

const {AppLockModule} = NativeModules;

const adUnitId = __DEV__
  ? TestIds.ADAPTIVE_BANNER
  : 'ca-app-pub-8251684647444428~4262993578';

const {width, height} = Dimensions.get('window');

const LockScreen = ({visible, appInfo, onUnlock, onClose, onForgotPin}) => {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setPin('');
      setError('');
      setIsLoading(false);
      // Debug: Check if launchApp method exists
      console.log('🔍 AppLockModule methods:', Object.keys(AppLockModule));
      console.log(
        '🔍 launchApp method exists:',
        typeof AppLockModule.launchApp === 'function',
      );
    }
  }, [visible, appInfo]);

  const handleUnlock = async () => {
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
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

        // Try to launch the original app
        if (appInfo?.packageName) {
          console.log(
            '🚀 Attempting to launch original app:',
            appInfo.packageName,
          );

          // Check if launchApp method exists
          if (typeof AppLockModule.launchApp === 'function') {
            console.log('✅ launchApp method is available');
            AppLockModule.launchApp(appInfo.packageName);
          } else {
            console.log(
              '❌ launchApp method not available, using closeLockScreen',
            );
            // Fallback: just close the lock screen
            AppLockModule.closeLockScreen();
          }
        } else {
          console.log('❌ No package name available, using closeLockScreen');
          AppLockModule.closeLockScreen();
        }

        // Call onUnlock to update state
        onUnlock();
      } else {
        console.log('❌ Invalid PIN');
        setError('Invalid PIN');
        setPin('');
        // Shake animation for wrong PIN
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
      setError('Authentication error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPin = async () => {
    try {
      // Check if security question is set
      const securityQuestion = await AsyncStorage.getItem('security_question');
      const securityAnswer = await AsyncStorage.getItem('security_answer');

      if (securityQuestion && securityAnswer) {
        // Call the onForgotPin prop instead of navigation.navigate
        console.log('🔄 Calling onForgotPin prop');
        if (onForgotPin) {
          onForgotPin(); // This will trigger the navigation in LockScreenManager
        }
        onClose(); // Close the lock screen
      } else {
        // Show old alert if no security question is set
        Alert.alert(
          'Reset PIN',
          'This will reset your PIN and unlock all apps. You will need to set up a new PIN.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Reset',
              onPress: async () => {
                try {
                  // Reset Keychain
                  await Keychain.resetGenericPassword({
                    service: 'applock_service',
                  });

                  // Clear locked apps
                  await AppLockModule.setLockedApps([]);

                  Alert.alert(
                    'Success',
                    'PIN has been reset. All apps are now unlocked.',
                    [
                      {
                        text: 'OK',
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
                  Alert.alert('Error', 'Failed to reset PIN');
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

          <Text style={styles.appName}>{appInfo.name} is locked</Text>
          <Text style={styles.prompt}>Enter your PIN to unlock</Text>

          <Animated.View
            style={[
              styles.inputContainer,
              {transform: [{translateX: shakeAnim}]},
            ]}>
            <TextInput
              value={pin}
              onChangeText={text => {
                setPin(text);
                setError(''); // Clear error when user types
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
            disabled={pin.length < 4 || isLoading}
            loading={isLoading}
            labelStyle={styles.unlockButtonLabel}>
            Unlock
          </Button>

          <Button
            mode="text"
            onPress={handleForgotPin}
            style={styles.forgotButton}
            labelStyle={styles.forgotButtonLabel}>
            Forgot PIN?
          </Button>
        </View>

        <BannerAd
          unitId={adUnitId}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        />

        <View style={styles.footer}>
          <Text style={styles.footerText}>App Lock - Secure Your Privacy</Text>
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
