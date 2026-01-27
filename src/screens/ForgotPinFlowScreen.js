// ForgotPinFlowScreen.js
import React, {useEffect} from 'react';
import {View, ActivityIndicator} from 'react-native';
import {useNavigation} from '@react-navigation/native';

const ForgotPinFlowScreen = () => {
  const navigation = useNavigation();

  useEffect(() => {
    // Navigate directly to reset screen
    navigation.replace('ForgotPinReset');
  }, [navigation]);

  return (
    <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
      <ActivityIndicator size="large" color="#1E88E5" />
    </View>
  );
};

export default ForgotPinFlowScreen;