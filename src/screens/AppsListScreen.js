// src/screens/AppsListScreen.js
import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Switch,
  Dimensions,
  Image,
  TouchableOpacity,
} from 'react-native';
import {
  Appbar,
  Card,
} from 'react-native-paper';
import {useNavigation, useRoute, useFocusEffect} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useAlert} from '../contexts/AlertContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const {width} = Dimensions.get('window');
const OUR_APP_PACKAGE = 'com.applock';

const AppsListScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const {t} = useTranslation();
  const {showAlert} = useAlert();
  const {title, apps: initialApps, type} = route.params || {};
  
  const [apps, setApps] = useState(initialApps || []);
  const [lockedApps, setLockedApps] = useState(new Set());

  useFocusEffect(
    React.useCallback(() => {
      console.log('📱 AppsListScreen focused');
      loadLockedApps();
      return () => {
        console.log('📱 AppsListScreen unfocused');
      };
    }, [])
  );

  useEffect(() => {
    console.log('📱 AppsListScreen mounted');
    loadLockedApps();
  }, []);

  const loadLockedApps = async () => {
    try {
      const savedLockedApps = await AsyncStorage.getItem('lockedApps');
      let lockedSet = new Set();

      if (savedLockedApps) {
        try {
          const lockedArray = JSON.parse(savedLockedApps);
          lockedArray.forEach(item => {
            const pkg = typeof item === 'string' ? item : item.packageName;
            if (pkg) {
              lockedSet.add(pkg);
            }
          });
        } catch (e) {
          console.error('Error parsing locked apps:', e);
        }
      }

      setLockedApps(lockedSet);
      
      // Update apps with current lock status
      const updatedApps = initialApps.map(app => ({
        ...app,
        locked: lockedSet.has(app.packageName),
      }));
      setApps(updatedApps);
    } catch (error) {
      console.error('Error loading locked apps:', error);
    }
  };

  const saveLockedApps = async (appsSet) => {
    try {
      const filteredApps = Array.from(appsSet);
      await AsyncStorage.setItem('lockedApps', JSON.stringify(filteredApps));
      setLockedApps(new Set(filteredApps));
      
      // Update local apps state
      const updatedApps = apps.map(app => ({
        ...app,
        locked: filteredApps.includes(app.packageName),
      }));
      setApps(updatedApps);
    } catch (error) {
      console.error('Error saving locked apps:', error);
    }
  };

  const toggleAppLock = async (appId, appPackageName, appName) => {
    console.log(`🔐 Toggling lock for: ${appPackageName} (${appName})`);

    const newLockedApps = new Set(lockedApps);
    const isCurrentlyLocked = newLockedApps.has(appPackageName);

    if (isCurrentlyLocked) {
      newLockedApps.delete(appPackageName);
      console.log(`🔓 Unlocked: ${appPackageName}`);
    } else {
      newLockedApps.add(appPackageName);
      console.log(`🔒 Locked: ${appPackageName}`);
    }

    // Update local state immediately for responsive UI
    const updatedApps = apps.map(app =>
      app.id === appId
        ? {...app, locked: newLockedApps.has(app.packageName)}
        : app,
    );
    setApps(updatedApps);

    await saveLockedApps(newLockedApps);

    // Show security warning when locking our own app
    if (appPackageName === OUR_APP_PACKAGE && !isCurrentlyLocked) {
      showAlert(
        t('alerts.success'),
        t('home.security_enabled_message'),
        'info',
      );
    }
  };

  const renderAppItem = ({item}) => (
    <View style={styles.appItem}>
      <View style={styles.appInfo}>
        <View style={styles.appIconContainer}>
          {item.icon ? (
            <Image source={{uri: item.icon}} style={styles.appIcon} />
          ) : (
            <View style={styles.placeholderIcon}>
              <Icon name="android" size={20} color="#666" />
            </View>
          )}
        </View>
        <View style={styles.appDetails}>
          <Text style={styles.appName} numberOfLines={1}>
            {item.name}
            {item.packageName === OUR_APP_PACKAGE && (
              <Text style={styles.ourAppBadge}> ({t('home.this_app')})</Text>
            )}
          </Text>
          {item.locked && (
            <View style={styles.lockedBadge}>
              <Icon name="lock" size={12} color="#1E88E5" />
              <Text style={styles.lockedBadgeText}>{t('home.app_locked')}</Text>
            </View>
          )}
        </View>
      </View>
      <Switch
        value={item.locked}
        onValueChange={() =>
          toggleAppLock(item.id, item.packageName, item.name)
        }
        thumbColor={item.locked ? '#1E88E5' : '#f4f3f4'}
        trackColor={{false: '#767577', true: '#BBDEFB'}}
        ios_backgroundColor="#767577"
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color="#1E88E5" />
        <Appbar.Content
          title={title}
          titleStyle={styles.headerTitle}
        />
      </Appbar.Header>

      <View style={styles.content}>
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            {type === 'locked' 
              ? t('home.locked_apps_desc') 
              : t('home.all_apps_desc')}
          </Text>
          <Text style={styles.appsCount}>
            {apps.length} {t('home.apps')}
          </Text>
        </View>

        {apps.length > 0 ? (
          <FlatList
            data={apps}
            renderItem={renderAppItem}
            keyExtractor={item => item.id}
            style={styles.appList}
            showsVerticalScrollIndicator={true}
            contentContainerStyle={styles.appListContent}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Icon 
              name={type === 'locked' ? "lock-open" : "apps"} 
              size={64} 
              color="#BDBDBD" 
            />
            <Text style={styles.emptyTitle}>
              {type === 'locked' 
                ? t('home.no_locked_apps') 
                : t('home.no_apps_available')}
            </Text>
            <Text style={styles.emptyText}>
              {type === 'locked' 
                ? t('home.no_locked_apps_desc') 
                : t('home.no_apps_available_desc')}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E88E5',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  infoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  appsCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E88E5',
    marginLeft: 12,
  },
  appList: {
    flex: 1,
  },
  appListContent: {
    paddingBottom: 20,
  },
  appItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  appInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  appIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  appIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  placeholderIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appDetails: {
    flex: 1,
  },
  appName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  ourAppBadge: {
    fontSize: 12,
    color: '#1E88E5',
    fontStyle: 'italic',
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  lockedBadgeText: {
    fontSize: 10,
    color: '#1E88E5',
    fontWeight: '600',
    marginLeft: 4,
  },
  separator: {
    height: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default AppsListScreen;