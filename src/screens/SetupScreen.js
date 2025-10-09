import React, {useState, useRef} from 'react';
import {View, Text, StyleSheet, Animated, Easing} from 'react-native';
import {Button, TextInput} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import * as Keychain from 'react-native-keychain';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {validatePINStrength} from '../utils/securityUtils';
import CustomKeyboardAvoidingView from '../components/KeyboardAvoidingView';
import {useAlert} from '../contexts/AlertContext';

const SetupScreen = () => {
  const navigation = useNavigation();
  const {t} = useTranslation();
  const {showAlert} = useAlert();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [pinStrength, setPinStrength] = useState({valid: true, message: ''});
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        easing: Easing.out(Easing.back(1)),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handlePinChange = text => {
    setPin(text);
    if (text.length >= 4) {
      const strength = validatePINStrength(text);
      setPinStrength(strength);
    } else {
      setPinStrength({valid: true, message: ''});
    }
  };

  const handleSetupComplete = async () => {
    if (pin.length < 4) {
      showAlert(t('alerts.error'), t('errors.pin_too_short'), 'error');
      return;
    }

    const strengthCheck = validatePINStrength(pin);
    if (!strengthCheck.valid) {
      showAlert(t('setup.weak_pin'), strengthCheck.message, 'warning');
      return;
    }

    if (pin !== confirmPin) {
      showAlert(t('alerts.error'), t('errors.pins_not_match'), 'error');
      return;
    }

    try {
      console.log('💾 Saving PIN to Keychain...');
      const result = await Keychain.setGenericPassword('applock_user', pin, {
        service: 'applock_service',
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });

      console.log('✅ PIN saved successfully:', result);

      await AsyncStorage.setItem('setupCompleted', 'true');
      console.log('✅ Setup marked as completed');

      const credentials = await Keychain.getGenericPassword({
        service: 'applock_service',
      });

      console.log('🔑 Verified stored PIN:', !!credentials);

      if (credentials && credentials.password === pin) {
        navigation.navigate('Main', {screen: 'Home'});
      } else {
        showAlert(t('alerts.error'), t('errors.verification_failed'), 'error');
      }
    } catch (error) {
      console.error('❌ Error saving PIN:', error);
      showAlert(t('alerts.error'), t('errors.save_failed'), 'error');
    }
  };

  return (
    <CustomKeyboardAvoidingView style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {opacity: fadeAnim, transform: [{translateY: slideAnim}]},
        ]}>
        <View style={styles.iconContainer}>
          <Icon name="lock-plus" size={60} color="#1E88E5" />
        </View>

        <Text style={styles.title}>{t('setup.title')}</Text>
        <Text style={styles.subtitle}>{t('setup.subtitle')}</Text>

        <TextInput
          label={t('setup.enter_pin')}
          value={pin}
          onChangeText={handlePinChange}
          secureTextEntry={!showPin}
          keyboardType="numeric"
          style={styles.input}
          maxLength={6}
          mode="outlined"
          outlineColor="#E0E0E0"
          activeOutlineColor={pinStrength.valid ? '#1E88E5' : '#FF3B30'}
          right={
            <TextInput.Icon
              icon={showPin ? 'eye-off' : 'eye'}
              onPress={() => setShowPin(!showPin)}
              color="#1E88E5"
            />
          }
        />

        {!pinStrength.valid && (
          <Text style={styles.warningText}>⚠️ {pinStrength.message}</Text>
        )}

        <TextInput
          label={t('setup.confirm_pin')}
          value={confirmPin}
          onChangeText={setConfirmPin}
          secureTextEntry={!showPin}
          keyboardType="numeric"
          style={styles.input}
          maxLength={6}
          mode="outlined"
          outlineColor="#E0E0E0"
          activeOutlineColor="#1E88E5"
        />

        <View style={styles.securityTips}>
          <Text style={styles.tipsTitle}>{t('setup.security_tips')}</Text>
          <Text style={styles.tip}>• {t('setup.tip_1')}</Text>
          <Text style={styles.tip}>• {t('setup.tip_2')}</Text>
          <Text style={styles.tip}>• {t('setup.tip_3')}</Text>
          <Text style={styles.tip}>• {t('setup.tip_4')}</Text>
          <Text style={styles.tip}>• {t('setup.tip_5')}</Text>
        </View>

        <Button
          mode="contained"
          onPress={handleSetupComplete}
          style={styles.button}
          disabled={
            pin.length < 4 || confirmPin.length < 4 || !pinStrength.valid
          }
          labelStyle={styles.buttonLabel}>
          {t('setup.complete_setup')}
        </Button>
      </Animated.View>
    </CustomKeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  content: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#42A5F5',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    color: '#666',
    lineHeight: 22,
  },
  input: {
    marginBottom: 10,
    backgroundColor: 'white',
    width: '100%',
    fontSize: 16,
  },
  warningText: {
    color: '#FF3B30',
    fontSize: 14,
    marginBottom: 10,
    textAlign: 'center',
  },
  securityTips: {
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 8,
    marginVertical: 20,
    width: '100%',
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E88E5',
    marginBottom: 8,
  },
  tip: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
    marginLeft: 8,
  },
  button: {
    marginTop: 20,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#42A5F5',
    width: '100%',
    elevation: 4,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
});

export default SetupScreen;
