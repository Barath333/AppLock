import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Switch,
  Animated,
  Easing,
  Dimensions,
  Image,
  LogBox,
} from 'react-native';
import {Searchbar, Appbar, Card} from 'react-native-paper';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {NativeModules} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useAlert} from '../contexts/AlertContext';

const {AppListModule, AppLockModule} = NativeModules;
const {width} = Dimensions.get('window');

LogBox.ignoreLogs(['new NativeEventEmitter']);

const OUR_APP_PACKAGE = 'com.applock';

const HomeScreen = () => {
  const navigation = useNavigation();
  const {t} = useTranslation();
  const {showAlert} = useAlert();
  const [searchQuery, setSearchQuery] = useState('');
  const [apps, setApps] = useState([]);
  const [filteredApps, setFilteredApps] = useState([]);
  const [lockedApps, setLockedApps] = useState(new Set());
  const [scaleAnim] = useState(new Animated.Value(1));
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      console.log('🏠 HomeScreen focused - refreshing data');
      loadLockedApps();
      loadInstalledApps();
    }, []),
  );

  useEffect(() => {
    console.log('🏠 HomeScreen mounted');
    loadInstalledApps();
    loadLockedApps();

    return () => {
      console.log('🏠 HomeScreen unmounted');
    };
  }, []);

  useEffect(() => {
    if (searchQuery === '') {
      setFilteredApps(apps);
    } else {
      setFilteredApps(
        apps.filter(app =>
          app.name.toLowerCase().includes(searchQuery.toLowerCase()),
        ),
      );
    }
  }, [searchQuery, apps]);

  const loadLockedApps = async () => {
    try {
      console.log('📦 HomeScreen: Loading locked apps');
      const savedLockedApps = await AsyncStorage.getItem('lockedApps');
      let lockedSet = new Set();

      if (savedLockedApps) {
        let lockedAppsArray;
        try {
          lockedAppsArray = JSON.parse(savedLockedApps);
          console.log('📋 Raw locked apps from storage:', lockedAppsArray);
        } catch (e) {
          console.error('❌ Error parsing locked apps:', e);
          await AsyncStorage.removeItem('lockedApps');
          lockedAppsArray = [];
        }

        if (Array.isArray(lockedAppsArray) && lockedAppsArray.length > 0) {
          lockedAppsArray.forEach(item => {
            let packageName;
            if (typeof item === 'string') {
              packageName = item;
            } else if (typeof item === 'object' && item.packageName) {
              packageName = item.packageName;
            }

            if (packageName && packageName !== OUR_APP_PACKAGE) {
              lockedSet.add(packageName);
            }
          });
        }
      }

      console.log('🔒 Final locked apps set:', Array.from(lockedSet));
      setLockedApps(lockedSet);

      if (apps.length > 0) {
        const updatedApps = apps.map(app => ({
          ...app,
          locked: lockedSet.has(app.packageName),
        }));
        setApps(updatedApps);
        setFilteredApps(updatedApps);
      }

      const packageNamesArray = Array.from(lockedSet);
      if (AppLockModule && typeof AppLockModule.setLockedApps === 'function') {
        await AppLockModule.setLockedApps(packageNamesArray);
      }
    } catch (error) {
      console.error('❌ HomeScreen: Error loading locked apps:', error);
    }
  };

  const saveLockedApps = async appsSet => {
    try {
      const filteredApps = Array.from(appsSet).filter(
        pkg => pkg !== OUR_APP_PACKAGE,
      );
      console.log('💾 Saving locked apps:', filteredApps);

      await AsyncStorage.setItem('lockedApps', JSON.stringify(filteredApps));
      if (AppLockModule && typeof AppLockModule.setLockedApps === 'function') {
        await AppLockModule.setLockedApps(filteredApps);
      }

      setLockedApps(new Set(filteredApps));
    } catch (error) {
      console.error('❌ Error saving locked apps:', error);
    }
  };

  const loadInstalledApps = async () => {
    try {
      console.log('📱 Loading installed apps...');
      const installedApps = await AppListModule.getInstalledApps();
      console.log(`📱 Loaded ${installedApps.length} apps`);

      const currentLockedApps = await AsyncStorage.getItem('lockedApps');
      const lockedSet = new Set();

      if (currentLockedApps) {
        try {
          const lockedArray = JSON.parse(currentLockedApps);
          lockedArray.forEach(item => {
            const pkg = typeof item === 'string' ? item : item.packageName;
            if (pkg && pkg !== OUR_APP_PACKAGE) {
              lockedSet.add(pkg);
            }
          });
        } catch (e) {
          console.error('Error parsing locked apps:', e);
        }
      }

      const appsWithLockStatus = installedApps
        .filter(app => {
          if (app.packageName === OUR_APP_PACKAGE) {
            return false;
          }
          const systemApps = [
            'android',
            'com.android',
            'com.google.android',
            'com.sec.android',
            'com.samsung',
            'com.orange',
            'com.osp',
          ];
          return !systemApps.some(systemApp =>
            app.packageName.startsWith(systemApp),
          );
        })
        .map(app => ({
          ...app,
          id: app.packageName,
          locked: lockedSet.has(app.packageName),
          icon: app.icon ? `data:image/png;base64,${app.icon}` : null,
        }));

      console.log(`📱 Showing ${appsWithLockStatus.length} apps`);
      setApps(appsWithLockStatus);
      setFilteredApps(appsWithLockStatus);
      setLockedApps(lockedSet);
    } catch (error) {
      console.error('❌ Error loading apps:', error);
    }
  };

  const toggleAppLock = async (appId, appPackageName, appName) => {
    if (appPackageName === OUR_APP_PACKAGE) {
      showAlert(t('alerts.cannot_lock'), t('home.cannot_lock_self'), 'warning');
      return;
    }

    console.log(`🔐 Toggling lock for: ${appPackageName} (${appName})`);

    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        easing: Easing.ease,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        easing: Easing.ease,
        useNativeDriver: true,
      }),
    ]).start();

    const newLockedApps = new Set(lockedApps);
    const isCurrentlyLocked = newLockedApps.has(appPackageName);

    if (isCurrentlyLocked) {
      newLockedApps.delete(appPackageName);
      console.log(`🔓 Unlocked: ${appPackageName}`);
    } else {
      newLockedApps.add(appPackageName);
      console.log(`🔒 Locked: ${appPackageName}`);
    }

    const updatedApps = apps.map(app =>
      app.id === appId
        ? {...app, locked: newLockedApps.has(app.packageName)}
        : app,
    );
    setApps(updatedApps);
    setLockedApps(newLockedApps);

    await saveLockedApps(newLockedApps);
  };

  const renderAppItem = ({item}) => (
    <Animated.View style={[styles.appItem, {transform: [{scale: scaleAnim}]}]}>
      <View style={styles.appInfo}>
        <View style={styles.appIconContainer}>
          {item.icon ? (
            <Image source={{uri: item.icon}} style={styles.appIcon} />
          ) : (
            <View style={styles.placeholderIcon} />
          )}
        </View>
        <View style={styles.appDetails}>
          <Text style={styles.appName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.packageName} numberOfLines={1}>
            {item.packageName}
          </Text>
          {item.locked && (
            <Text style={styles.lockedBadge}>🔒 {t('home.app_locked')}</Text>
          )}
        </View>
      </View>
      <Switch
        value={item.locked}
        onValueChange={() =>
          toggleAppLock(item.id, item.packageName, item.name)
        }
        thumbColor={item.locked ? '#42A5F5' : '#f4f3f4'}
        trackColor={{false: '#767577', true: '#BBDEFB'}}
      />
    </Animated.View>
  );

  const lockedAppsCount = Array.from(lockedApps).length;

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.header}>
        <Appbar.Content
          title={t('home.title')}
          titleStyle={styles.headerTitle}
        />
        <Appbar.Action
          icon="cog"
          onPress={() => {
            console.log('⚙️ Settings button pressed');
            navigation.navigate('Settings');
          }}
          color="#42A5F5"
        />
        <Appbar.Action
          icon="refresh"
          onPress={() => {
            console.log('🔄 Refresh button pressed');
            loadInstalledApps();
            loadLockedApps();
          }}
          color="#42A5F5"
        />
      </Appbar.Header>

      <View style={styles.content}>
        <Card style={styles.statsCard}>
          <Card.Content>
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{lockedAppsCount}</Text>
                <Text style={styles.statLabel}>{t('home.locked_apps')}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{apps.length}</Text>
                <Text style={styles.statLabel}>{t('home.total_apps')}</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>{t('home.testing_instructions')}</Text>
        </View>

        <Searchbar
          placeholder={t('home.search_placeholder')}
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
          iconColor="#42A5F5"
          inputStyle={styles.searchInput}
          placeholderTextColor="#888"
        />

        <FlatList
          data={filteredApps}
          renderItem={renderAppItem}
          keyExtractor={item => item.id}
          style={styles.appList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{t('home.no_apps_found')}</Text>
            </View>
          }
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    fontSize: 22,
    fontWeight: 'bold',
    color: '#42A5F5',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statsCard: {
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    elevation: 4,
    shadowColor: '#42A5F5',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#42A5F5',
  },
  infoText: {
    fontSize: 14,
    color: '#1565C0',
    lineHeight: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#42A5F5',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E0E0E0',
  },
  searchBar: {
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchInput: {
    color: '#333',
  },
  appList: {
    flex: 1,
  },
  appItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    backgroundColor: 'white',
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  appInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  appIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  appIcon: {
    width: 24,
    height: 24,
    borderRadius: 5,
  },
  placeholderIcon: {
    width: 24,
    height: 24,
    borderRadius: 5,
    backgroundColor: '#BBDEFB',
  },
  appDetails: {
    flex: 1,
  },
  appName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  packageName: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  lockedBadge: {
    fontSize: 10,
    color: '#42A5F5',
    marginTop: 4,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
});

export default HomeScreen;
