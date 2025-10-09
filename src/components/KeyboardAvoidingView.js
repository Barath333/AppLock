import React from 'react';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
import {StyleSheet} from 'react-native';

const CustomKeyboardAvoidingView = ({children, style}) => {
  return (
    <KeyboardAwareScrollView
      style={styles.scrollView}
      contentContainerStyle={[styles.scrollContent, style]} // ✅ move layout styles here
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid={true}
      extraScrollHeight={20}
      enableAutomaticScroll={true}
      extraHeight={100}
      keyboardOpeningTime={0}>
      {children}
    </KeyboardAwareScrollView>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center', // ✅ layout rules go here
  },
});

export default CustomKeyboardAvoidingView;
