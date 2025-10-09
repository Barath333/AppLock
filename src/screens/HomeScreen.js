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
import {
  Searchbar,
  Appbar,
  Card,
  Button,
  Switch as PaperSwitch,
} from 'react-native-paper';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {NativeModules} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useAlert} from '../contexts/AlertContext';
import {RefreshControl, ScrollView} from 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

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
  const [autoLockNewApps, setAutoLockNewApps] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      console.log('🏠 HomeScreen focused - refreshing data');
      loadSettings();
      loadLockedApps();
      loadInstalledApps();
    }, []),
  );

  useEffect(() => {
    console.log('🏠 HomeScreen mounted');
    loadSettings();
    loadInstalledApps();
    loadLockedApps();
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

  const loadSettings = async () => {
    try {
      const autoLock = await AppLockModule.getAutoLockNewApps();
      setAutoLockNewApps(autoLock);
      console.log('🔄 Auto-lock new apps setting:', autoLock);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const toggleAutoLockNewApps = async () => {
    const newValue = !autoLockNewApps;
    try {
      await AppLockModule.setAutoLockNewApps(newValue);
      setAutoLockNewApps(newValue);
      showAlert(
        t('alerts.success'),
        newValue ? t('home.auto_lock_enabled') : t('home.auto_lock_disabled'),
        'success',
      );
    } catch (error) {
      console.error('Error toggling auto-lock:', error);
      showAlert(t('alerts.error'), t('errors.setting_update_failed'), 'error');
    }
  };

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

            if (packageName) {
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
      const filteredApps = Array.from(appsSet);
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
      setIsRefreshing(true);
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
            if (pkg) {
              lockedSet.add(pkg);
            }
          });
        } catch (e) {
          console.error('Error parsing locked apps:', e);
        }
      }

      const appsWithLockStatus = installedApps
        .filter(app => {
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
      showAlert(t('alerts.error'), t('errors.operation_failed'), 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const toggleAppLock = async (appId, appPackageName, appName) => {
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

    // Show security warning when locking our own app
    if (appPackageName === OUR_APP_PACKAGE && !isCurrentlyLocked) {
      showAlert(
        t('alerts.success'),
        t('home.security_enabled_message'),
        'info',
      );
    }
  };

  const lockAllApps = async () => {
    showAlert(
      t('alerts.lock_all_apps'),
      t('home.lock_all_confirmation'),
      'warning',
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('alerts.lock_all'),
          onPress: async () => {
            try {
              const allPackageNames = apps.map(app => app.packageName);
              const newLockedApps = new Set([
                ...lockedApps,
                ...allPackageNames,
              ]);
              await saveLockedApps(newLockedApps);

              const updatedApps = apps.map(app => ({
                ...app,
                locked: true,
              }));
              setApps(updatedApps);
              setFilteredApps(updatedApps);

              showAlert(
                t('alerts.success'),
                t('home.all_apps_locked'),
                'success',
              );
            } catch (error) {
              console.error('Error locking all apps:', error);
              showAlert(
                t('alerts.error'),
                t('errors.operation_failed'),
                'error',
              );
            }
          },
          style: 'destructive',
        },
      ],
    );
  };

  const unlockAllApps = async () => {
    showAlert(
      t('alerts.unlock_all_apps'),
      t('home.unlock_all_confirmation'),
      'warning',
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('alerts.unlock_all'),
          onPress: async () => {
            try {
              const newLockedApps = new Set();
              await saveLockedApps(newLockedApps);

              const updatedApps = apps.map(app => ({
                ...app,
                locked: false,
              }));
              setApps(updatedApps);
              setFilteredApps(updatedApps);

              showAlert(
                t('alerts.success'),
                t('home.all_apps_unlocked'),
                'success',
              );
            } catch (error) {
              console.error('Error unlocking all apps:', error);
              showAlert(
                t('alerts.error'),
                t('errors.operation_failed'),
                'error',
              );
            }
          },
          style: 'default',
        },
      ],
    );
  };

  const renderAppItem = ({item}) => (
    <Animated.View style={[styles.appItem, {transform: [{scale: scaleAnim}]}]}>
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
          {/* <Text style={styles.packageName} numberOfLines={1}>
            {item.packageName}
          </Text> */}
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
    </Animated.View>
  );

  const lockedAppsCount = Array.from(lockedApps).length;

  return (
    <View style={styles.container}>
      <Appbar.Header style={[styles.header, {height: 48}]}>
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
          color="#1E88E5"
        />
        <Appbar.Action
          icon="refresh"
          onPress={() => {
            console.log('🔄 Refresh button pressed');
            loadInstalledApps();
            loadLockedApps();
          }}
          color="#1E88E5"
          disabled={isRefreshing}
        />
      </Appbar.Header>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={loadInstalledApps}
            colors={['#1E88E5']}
            tintColor="#1E88E5"
          />
        }>
        {/* Security Warning Card */}
        {!lockedApps.has(OUR_APP_PACKAGE) && (
          <Card style={styles.securityWarningCard}>
            <Card.Content>
              <View style={styles.securityWarningHeader}>
                <Icon name="shield-alert" size={24} color="#E65100" />
                <Text style={styles.securityWarningTitle}>
                  {t('home.security_recommendation')}
                </Text>
              </View>
              <Text style={styles.securityWarningText}>
                {t('home.security_recommendation_desc')}
              </Text>
            </Card.Content>
          </Card>
        )}

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <View style={[styles.statIcon, styles.lockedStat]}>
              <Icon name="lock" size={20} color="#FFFFFF" />
            </View>
            <View style={styles.statText}>
              <Text style={styles.statNumber}>{lockedAppsCount}</Text>
              <Text style={styles.statLabel}>{t('home.locked_apps')}</Text>
            </View>
          </View>

          <View style={styles.statItem}>
            <View style={[styles.statIcon, styles.totalStat]}>
              <Icon name="apps" size={20} color="#FFFFFF" />
            </View>
            <View style={styles.statText}>
              <Text style={styles.statNumber}>{apps.length}</Text>
              <Text style={styles.statLabel}>{t('home.total_apps')}</Text>
            </View>
          </View>
        </View>

        {/* Auto-lock Settings */}
        <Card style={styles.settingsCard}>
          <Card.Content>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Icon
                  name="lock-plus"
                  size={20}
                  color="#1E88E5"
                  style={styles.settingIcon}
                />
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>
                    {t('home.auto_lock_new_apps')}
                  </Text>
                  <Text style={styles.settingDescription}>
                    {t('home.auto_lock_description')}
                  </Text>
                </View>
              </View>
              <PaperSwitch
                value={autoLockNewApps}
                onValueChange={toggleAutoLockNewApps}
                color="#1E88E5"
              />
            </View>
          </Card.Content>
        </Card>

        {/* Quick Actions */}
        <Card style={styles.actionsCard}>
          <Card.Content>
            <Text style={styles.actionsTitle}>{t('home.quick_actions')}</Text>
            <View style={styles.quickActions}>
              <Button
                mode="contained"
                onPress={lockAllApps}
                style={[styles.quickActionButton, styles.lockAllButton]}
                icon="lock"
                labelStyle={styles.quickActionLabel}
                compact>
                {t('home.lock_all')}
              </Button>
              <Button
                mode="outlined"
                onPress={unlockAllApps}
                style={[styles.quickActionButton, styles.unlockAllButton]}
                icon="lock-open"
                labelStyle={styles.quickActionLabel}
                compact>
                {t('home.unlock_all')}
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* Search Bar */}
        <Card style={styles.searchCard}>
          <Card.Content>
            <Searchbar
              placeholder={t('home.search_placeholder')}
              onChangeText={setSearchQuery}
              value={searchQuery}
              style={styles.searchBar}
              iconColor="#1E88E5"
              inputStyle={styles.searchInput}
              placeholderTextColor="#888"
              elevation={0}
            />
          </Card.Content>
        </Card>

        {/* Apps List */}
        <Card style={styles.appsCard}>
          <Card.Content>
            <View style={styles.appsHeader}>
              <Text style={styles.appsTitle}>{t('home.installed_apps')}</Text>
              <Text
                style={
                  apps.length === 0 ? styles.appsCountEmpty : styles.appsCount
                }>
                {filteredApps.length} {t('home.apps')}
              </Text>
            </View>

            {filteredApps.length > 0 ? (
              <FlatList
                data={filteredApps}
                renderItem={renderAppItem}
                keyExtractor={item => item.id}
                style={styles.appList}
                scrollEnabled={true}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
                initialNumToRender={20} // Add this for better performance
                maxToRenderPerBatch={20} // Add this
                windowSize={10} // Add this
                removeClippedSubviews={false} // Add this
                getItemLayout={(data, index) => ({
                  length: 80, // Approximate height of each item
                  offset: 80 * index,
                  index,
                })}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
              />
            ) : (
              <View style={styles.emptyContainer}>
                <Icon name="magnify" size={64} color="#BDBDBD" />
                <Text style={styles.emptyTitle}>{t('home.no_apps_found')}</Text>
                <Text style={styles.emptyText}>
                  {searchQuery
                    ? t('home.no_search_results')
                    : t('home.no_apps_available')}
                </Text>
                {searchQuery && (
                  <Button
                    mode="text"
                    onPress={() => setSearchQuery('')}
                    style={styles.clearSearchButton}
                    labelStyle={styles.clearSearchLabel}>
                    {t('home.clear_search')}
                  </Button>
                )}
              </View>
            )}
          </Card.Content>
        </Card>
      </ScrollView>
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E88E5',
  },
  content: {
    flex: 1,
  },
  securityWarningCard: {
    margin: 16,
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: '#FFF3E0',
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  securityWarningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  securityWarningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#E65100',
    marginLeft: 8,
  },
  securityWarningText: {
    fontSize: 14,
    color: '#E65100',
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
    marginTop: 20,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    elevation: 2,
  },
  lockedCard: {
    backgroundColor: '#E3F2FD',
  },
  totalCard: {
    backgroundColor: '#E8F5E9',
  },
  statCardContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1E88E5',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontWeight: '500',
  },
  settingsCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    elevation: 2,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    marginRight: 12,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  actionsCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    elevation: 2,
  },
  actionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    borderRadius: 12,
  },
  lockAllButton: {
    backgroundColor: '#1E88E5',
  },
  unlockAllButton: {
    borderColor: '#1E88E5',
  },
  quickActionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  searchCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    elevation: 2,
  },
  searchBar: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    elevation: 0,
  },
  searchInput: {
    color: '#333',
    fontSize: 14,
  },
  appsCard: {
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    elevation: 2,
  },
  appsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  appsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  appsCount: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  appsCountEmpty: {
    fontSize: 14,
    color: '#BDBDBD',
    fontWeight: '500',
  },
  appList: {
    maxHeight: 400,
  },
  appItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
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
  packageName: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
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
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
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
  clearSearchButton: {
    marginTop: 10,
  },
  clearSearchLabel: {
    color: '#1E88E5',
    fontSize: 14,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 16,
    marginTop: 12,
    gap: 12,
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    elevation: 2,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  lockedStat: {
    backgroundColor: '#1E88E5',
  },
  totalStat: {
    backgroundColor: '#43A047',
  },
  statText: {
    flex: 1,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 13,
    color: '#777',
    fontWeight: '500',
  },
});

export default HomeScreen;
