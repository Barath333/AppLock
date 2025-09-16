import React, {useState} from 'react';
import {View, Text, StyleSheet, Image} from 'react-native';
import {TextInput, Button} from 'react-native-paper';
import {BannerAd, BannerAdSize, TestIds} from 'react-native-google-mobile-ads';

const LockScreen = ({appName, appIcon, onUnlock}) => {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');

  const handleUnlock = () => {
    if (pin === '1234') {
      onUnlock();
    } else {
      setError('Invalid PIN');
      setPin('');
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Banner */}
      <BannerAd
        unitId={TestIds.BANNER}
        size={BannerAdSize.FULL_BANNER}
        requestOptions={{requestNonPersonalizedAdsOnly: true}}
      />

      {/* Main Content */}
      <View style={styles.content}>
        <Image source={appIcon} style={styles.appIcon} />
        <Text style={styles.appName}>{appName} is locked</Text>
        <Text style={styles.prompt}>Enter your PIN to unlock</Text>

        <TextInput
          value={pin}
          onChangeText={setPin}
          secureTextEntry={!showPin}
          keyboardType="numeric"
          style={styles.pinInput}
          maxLength={6}
          right={
            <TextInput.Icon
              name={showPin ? 'eye-off' : 'eye'}
              onPress={() => setShowPin(!showPin)}
            />
          }
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          mode="contained"
          onPress={handleUnlock}
          style={styles.unlockButton}
          disabled={pin.length < 4}>
          Unlock
        </Button>

        <Button
          mode="text"
          onPress={() => {
            /* Handle forgot PIN */
          }}
          style={styles.forgotButton}>
          Forgot PIN?
        </Button>
      </View>

      {/* Bottom Banner */}
      <BannerAd
        unitId={TestIds.BANNER}
        size={BannerAdSize.FULL_BANNER}
        requestOptions={{requestNonPersonalizedAdsOnly: true}}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
  },
  appIcon: {
    width: 64,
    height: 64,
    marginBottom: 20,
    borderRadius: 12,
  },
  appName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  prompt: {
    fontSize: 16,
    marginBottom: 20,
    color: '#666',
  },
  pinInput: {
    width: '80%',
    marginBottom: 20,
    backgroundColor: 'white',
  },
  error: {
    color: 'red',
    marginBottom: 20,
  },
  unlockButton: {
    marginBottom: 10,
    backgroundColor: '#6200ee',
  },
  forgotButton: {
    marginBottom: 20,
  },
});

export default LockScreen;
