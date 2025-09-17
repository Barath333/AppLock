import React, {useState, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import {TextInput, Button} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const {width, height} = Dimensions.get('window');

const LockScreen = ({appName, appIcon, onUnlock}) => {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const handleUnlock = () => {
    if (pin === '1234') {
      onUnlock();
    } else {
      setError('Invalid PIN');
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
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Animated.View
          style={[
            styles.appIconContainer,
            {transform: [{translateX: shakeAnim}]},
          ]}>
          <View style={styles.iconBackground}>
            <Icon name={appIcon || 'android'} size={40} color="#1E88E5" />
          </View>
        </Animated.View>

        <Text style={styles.appName}>{appName || 'App'} is locked</Text>
        <Text style={styles.prompt}>Enter your PIN to unlock</Text>

        <Animated.View
          style={[
            styles.inputContainer,
            {transform: [{translateX: shakeAnim}]},
          ]}>
          <TextInput
            value={pin}
            onChangeText={setPin}
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
          disabled={pin.length < 4}
          labelStyle={styles.unlockButtonLabel}>
          Unlock
        </Button>

        <Button
          mode="text"
          onPress={() => {
            /* Handle forgot PIN */
          }}
          style={styles.forgotButton}
          labelStyle={styles.forgotButtonLabel}>
          Forgot PIN?
        </Button>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>App Lock - Secure Your Privacy</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'space-between',
    alignItems: 'center',
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
