import React, {useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import {useTranslation} from 'react-i18next';

const {width, height} = Dimensions.get('window');

const SimpleSplashScreen = ({onAnimationComplete}) => {
  const {t} = useTranslation();
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    console.log('🎬 Starting splash screen animation');

    const animate = async () => {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 10,
          friction: 2,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();

      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log('✅ Splash screen animation complete');
      if (onAnimationComplete) {
        onAnimationComplete();
      }
    };

    animate();
  }, [scaleAnim, fadeAnim, onAnimationComplete]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[styles.logoContainer, {transform: [{scale: scaleAnim}]}]}>
        <View style={styles.logoBackground}>
          <Text style={styles.logoText}>🔒</Text>
        </View>
      </Animated.View>

      <Animated.View style={{opacity: fadeAnim}}>
        <Text style={styles.title}>{t('splash.title')}</Text>
        <Text style={styles.subtitle}>{t('splash.subtitle')}</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoBackground: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#1E88E5',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  logoText: {
    fontSize: 50,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1E88E5',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default SimpleSplashScreen;
