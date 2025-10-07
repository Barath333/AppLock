import React, {useRef, useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  AppState,
  NativeEventEmitter,
  Modal,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import {Button, Card} from 'react-native-paper';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {NativeModules} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useLanguage} from '../contexts/LanguageContext';
import {useAlert} from '../contexts/AlertContext';

const {PermissionModule} = NativeModules;

const LanguageSelectionPopup = ({visible, onLanguageSelect, onClose}) => {
  const {languages, changeLanguage} = useLanguage();
  const {t} = useTranslation();
  const [selectedLanguage, setSelectedLanguage] = useState(null);
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleLanguageSelect = async language => {
    setSelectedLanguage(language);
    await changeLanguage(language.code);
    onLanguageSelect(language);
  };

  const getFlagEmoji = languageCode => {
    const flagEmojis = {
      en: '🇺🇸',
      es: '🇪🇸',
      fr: '🇫🇷',
      hi: '🇮🇳',
      ar: '🇸🇦',
      zh: '🇨🇳',
      ru: '🇷🇺',
      pt: '🇧🇷',
      de: '🇩🇪',
      ja: '🇯🇵',
      ko: '🇰🇷',
    };
    return flagEmojis[languageCode] || '🌐';
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <Animated.View
          style={[
            styles.modalContent,
            {
              transform: [{scale: scaleAnim}],
              opacity: fadeAnim,
            },
          ]}>
          <View style={styles.popupHeader}>
            <Icon name="earth" size={40} color="#1E88E5" />
            <Text style={styles.popupTitle}>{t('language.welcome_title')}</Text>
            <Text style={styles.popupSubtitle}>
              {t('language.welcome_subtitle')}
            </Text>
          </View>

          <FlatList
            data={languages}
            keyExtractor={item => item.code}
            renderItem={({item}) => (
              <TouchableOpacity
                style={[
                  styles.languageItem,
                  selectedLanguage?.code === item.code && styles.selectedItem,
                ]}
                onPress={() => handleLanguageSelect(item)}>
                <Text style={styles.flag}>{getFlagEmoji(item.code)}</Text>
                <View style={styles.languageInfo}>
                  <Text style={styles.languageName}>{item.nativeName}</Text>
                  <Text style={styles.languageEnglish}>{item.name}</Text>
                </View>
                {selectedLanguage?.code === item.code && (
                  <Icon name="check-circle" size={24} color="#1E88E5" />
                )}
              </TouchableOpacity>
            )}
            style={styles.languageList}
          />

          <Button
            mode="contained"
            onPress={onClose}
            style={styles.continueButton}
            disabled={!selectedLanguage}
            labelStyle={styles.continueButtonLabel}>
            {t('common.continue')} →
          </Button>
        </Animated.View>
      </View>
    </Modal>
  );
};

const PermissionGrantingScreen = () => {
  const navigation = useNavigation();
  const {t} = useTranslation();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const {currentLanguage} = useLanguage();
  const {showAlert} = useAlert();

  const [permissions, setPermissions] = useState({
    accessibility: false,
    overlay: false,
    usage: false,
  });

  const [showLanguagePopup, setShowLanguagePopup] = useState(false);
  const [hasSelectedLanguage, setHasSelectedLanguage] = useState(false);

  const [eventEmitter] = useState(new NativeEventEmitter(PermissionModule));

  useEffect(() => {
    checkLanguageSelection();
  }, []);

  const checkLanguageSelection = async () => {
    try {
      const languageSelected = await AsyncStorage.getItem('language_selected');
      if (!languageSelected) {
        setShowLanguagePopup(true);
      }
    } catch (error) {
      console.error('Error checking language selection:', error);
      setShowLanguagePopup(true);
    }
  };

  const handleLanguageSelect = async language => {
    try {
      await AsyncStorage.setItem('language_selected', 'true');
      setHasSelectedLanguage(true);
    } catch (error) {
      console.error('Error saving language selection:', error);
    }
  };

  const handleCloseLanguagePopup = () => {
    setShowLanguagePopup(false);
  };

  useFocusEffect(
    React.useCallback(() => {
      checkAllPermissions();
    }, []),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        checkAllPermissions();
      }
    });

    const accessibilitySubscription = eventEmitter.addListener(
      'onAppOpened',
      data => {
        console.log('App opened:', data.packageName);
      },
    );

    return () => {
      subscription.remove();
      accessibilitySubscription.remove();
    };
  }, []);

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
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const checkAllPermissions = async () => {
    try {
      const accessibility =
        await PermissionModule.getAccessibilityServiceStatus();
      const overlay = await PermissionModule.isOverlayPermissionGranted();
      const usage = await PermissionModule.isUsageAccessGranted();

      setPermissions({
        accessibility,
        overlay,
        usage,
      });
    } catch (error) {
      console.error('Error checking permissions:', error);
    }
  };

  const requestAccessibilityPermission = async () => {
    try {
      PermissionModule.openAccessibilitySettings();

      setTimeout(() => {
        checkAllPermissions();
      }, 1000);
    } catch (error) {
      showAlert(t('alerts.error'), t('errors.accessibility_settings'), 'error');
    }
  };

  const requestOverlayPermission = async () => {
    try {
      PermissionModule.openOverlayPermissionSettings();

      setTimeout(() => {
        checkAllPermissions();
      }, 1000);
    } catch (error) {
      showAlert(t('alerts.error'), t('errors.overlay_permission'), 'error');
    }
  };

  const requestUsagePermission = async () => {
    try {
      PermissionModule.openUsageAccessSettings();

      setTimeout(() => {
        checkAllPermissions();
      }, 1000);
    } catch (error) {
      showAlert(t('alerts.error'), t('errors.usage_access'), 'error');
    }
  };

  const arePermissionsGranted = async () => {
    try {
      const setupCompleted = await AsyncStorage.getItem('setupCompleted');

      if (setupCompleted === 'true') {
        console.log('✅ Setup already completed, going to main app');
        navigation.navigate('Main');
      } else {
        console.log('🔄 Setup not completed, going to setup screen');
        navigation.navigate('Setup');
      }
    } catch (error) {
      console.error('❌ Error checking setup status:', error);
      navigation.navigate('Setup');
    }
  };

  const getButtonLabel = permissionName => {
    return permissions[permissionName]
      ? t('permissions.permission_granted')
      : t('permissions.grant_permission');
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}>
      <Animated.View
        style={{opacity: fadeAnim, transform: [{translateY: slideAnim}]}}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Icon name="shield-lock" size={60} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>{t('permissions.title')}</Text>
          <Text style={styles.subtitle}>{t('permissions.subtitle')}</Text>
        </View>

        <Card style={styles.permissionCard}>
          <Card.Content>
            <View style={styles.permissionItem}>
              <View
                style={[
                  styles.permissionIcon,
                  permissions.accessibility && styles.grantedIcon,
                ]}>
                <Icon
                  name="account-lock"
                  size={30}
                  color={permissions.accessibility ? '#4CAF50' : '#1E88E5'}
                />
              </View>
              <View style={styles.permissionText}>
                <Text style={styles.permissionTitle}>
                  {t('permissions.accessibility_title')}
                </Text>
                <Text style={styles.permissionDesc}>
                  {t('permissions.accessibility_desc')}
                </Text>
                {permissions.accessibility && (
                  <Text style={styles.grantedText}>
                    {t('permissions.accessibility_granted')}
                  </Text>
                )}
              </View>
            </View>
            <Button
              mode="contained"
              onPress={requestAccessibilityPermission}
              style={[
                styles.button,
                permissions.accessibility && styles.grantedButton,
              ]}
              labelStyle={styles.buttonLabel}
              disabled={permissions.accessibility}>
              {getButtonLabel('accessibility')}
            </Button>
          </Card.Content>
        </Card>

        <Card style={styles.permissionCard}>
          <Card.Content>
            <View style={styles.permissionItem}>
              <View
                style={[
                  styles.permissionIcon,
                  permissions.overlay && styles.grantedIcon,
                ]}>
                <Icon
                  name="layers"
                  size={30}
                  color={permissions.overlay ? '#4CAF50' : '#1E88E5'}
                />
              </View>
              <View style={styles.permissionText}>
                <Text style={styles.permissionTitle}>
                  {t('permissions.overlay_title')}
                </Text>
                <Text style={styles.permissionDesc}>
                  {t('permissions.overlay_desc')}
                </Text>
                {permissions.overlay && (
                  <Text style={styles.grantedText}>
                    {t('permissions.overlay_granted')}
                  </Text>
                )}
              </View>
            </View>
            <Button
              mode="contained"
              onPress={requestOverlayPermission}
              style={[
                styles.button,
                permissions.overlay && styles.grantedButton,
              ]}
              labelStyle={styles.buttonLabel}
              disabled={permissions.overlay}>
              {getButtonLabel('overlay')}
            </Button>
          </Card.Content>
        </Card>

        <Card style={styles.permissionCard}>
          <Card.Content>
            <View style={styles.permissionItem}>
              <View
                style={[
                  styles.permissionIcon,
                  permissions.usage && styles.grantedIcon,
                ]}>
                <Icon
                  name="chart-bar"
                  size={30}
                  color={permissions.usage ? '#4CAF50' : '#1E88E5'}
                />
              </View>
              <View style={styles.permissionText}>
                <Text style={styles.permissionTitle}>
                  {t('permissions.usage_title')}
                </Text>
                <Text style={styles.permissionDesc}>
                  {t('permissions.usage_desc')}
                </Text>
                {permissions.usage && (
                  <Text style={styles.grantedText}>
                    {t('permissions.usage_granted')}
                  </Text>
                )}
              </View>
            </View>
            <Button
              mode="contained"
              onPress={requestUsagePermission}
              style={[styles.button, permissions.usage && styles.grantedButton]}
              labelStyle={styles.buttonLabel}
              disabled={permissions.usage}>
              {getButtonLabel('usage')}
            </Button>
          </Card.Content>
        </Card>

        <Button
          mode="contained"
          onPress={arePermissionsGranted}
          style={styles.continueButton}
          labelStyle={styles.continueButtonLabel}>
          {t('common.continue')}
        </Button>

        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>{t('permissions.note')}</Text>
        </View>
      </Animated.View>
      <LanguageSelectionPopup
        visible={showLanguagePopup}
        onLanguageSelect={handleLanguageSelect}
        onClose={handleCloseLanguagePopup}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  header: {
    alignItems: 'center',
    marginVertical: 30,
    marginBottom: 10,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#42A5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    elevation: 4,
    shadowColor: '#1E88E5',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 10,
    color: '#42A5F5',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
    lineHeight: 22,
  },
  permissionCard: {
    borderRadius: 16,
    marginBottom: 20,
    backgroundColor: 'white',
    elevation: 4,
    shadowColor: '#1E88E5',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  permissionItem: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  permissionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  grantedIcon: {
    backgroundColor: '#E8F5E9',
  },
  permissionText: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 5,
    color: '#333',
  },
  permissionDesc: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  grantedText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
    marginTop: 5,
  },
  button: {
    marginTop: 5,
    borderRadius: 10,
    backgroundColor: '#42A5F5',
  },
  grantedButton: {
    backgroundColor: '#4CAF50',
  },
  buttonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  continueButton: {
    marginTop: 20,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#42A5F5',
    elevation: 4,
  },
  continueButtonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoContainer: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  infoText: {
    color: '#E65100',
    fontSize: 14,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 25,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  popupHeader: {
    alignItems: 'center',
    marginBottom: 25,
  },
  popupTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1E88E5',
    marginTop: 15,
    textAlign: 'center',
  },
  popupSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  languageList: {
    maxHeight: 300,
    marginBottom: 20,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: '#F8F9FA',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedItem: {
    backgroundColor: '#E3F2FD',
    borderColor: '#1E88E5',
  },
  flag: {
    fontSize: 28,
    marginRight: 15,
  },
  languageInfo: {
    flex: 1,
  },
  languageName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  languageEnglish: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  continueButton: {
    borderRadius: 12,
    backgroundColor: '#1E88E5',
    paddingVertical: 8,
  },
  continueButtonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default PermissionGrantingScreen;
