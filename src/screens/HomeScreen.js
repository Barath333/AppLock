

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
} from 'react-native';
import {Searchbar, Appbar, Card} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import {NativeModules} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const {AppListModule} = NativeModules;
const {width} = Dimensions.get('window');

const HomeScreen = () => {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [apps, setApps] = useState([]);
  const [filteredApps, setFilteredApps] = useState([]);
  const [lockedApps, setLockedApps] = useState([]);
  const [scaleAnim] = useState(new Animated.Value(1));

  useEffect(() => {
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

  const loadLockedApps = async () => {
    try {
      const savedLockedApps = await AsyncStorage.getItem('lockedApps');
      if (savedLockedApps) {
        setLockedApps(JSON.parse(savedLockedApps));
      }
    } catch (error) {
      console.error('Error loading locked apps:', error);
    }
  };

  const saveLockedApps = async apps => {
    try {
      await AsyncStorage.setItem('lockedApps', JSON.stringify(apps));
    } catch (error) {
      console.error('Error saving locked apps:', error);
    }
  };

  const loadInstalledApps = async () => {
    try {
      const installedApps = await AppListModule.getInstalledApps();

      // Add locked status to each app
      const appsWithLockStatus = installedApps.map(app => ({
        ...app,
        id: app.packageName,
        locked: lockedApps.some(
          lockedApp => lockedApp.packageName === app.packageName,
        ),
        icon: app.icon ? `data:image/png;base64,${app.icon}` : null,
      }));

      setApps(appsWithLockStatus);
      setFilteredApps(appsWithLockStatus);
    } catch (error) {
      console.error('Error loading apps:', error);
    }
  };

  const toggleAppLock = async appId => {
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

    const updatedApps = apps.map(app =>
      app.id === appId ? {...app, locked: !app.locked} : app,
    );

    setApps(updatedApps);

    // Update locked apps list
    const locked = updatedApps.filter(app => app.locked);
    setLockedApps(locked);

    // Save to storage
    saveLockedApps(locked);
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
        </View>
      </View>
      <Switch
        value={item.locked}
        onValueChange={() => toggleAppLock(item.id)}
        thumbColor={item.locked ? '#42A5F5' : '#f4f3f4'}
        trackColor={{false: '#767577', true: '#BBDEFB'}}
      />
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.header}>
        <Appbar.Content title="App Lock" titleStyle={styles.headerTitle} />
        <Appbar.Action
          icon="cog"
          onPress={() => navigation.navigate('Settings')}
          color="#42A5F5"
        />
      </Appbar.Header>

      <View style={styles.content}>
        <Card style={styles.statsCard}>
          <Card.Content>
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{lockedApps.length}</Text>
                <Text style={styles.statLabel}>Locked</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{apps.length}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        <Searchbar
          placeholder="Search apps"
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
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // ... keep your existing styles but add these new ones:
  appIcon: {
    width: 24,
    height: 24,
    borderRadius: 5,
  },
  placeholderIcon: {
    width: 24,
    height: 24,
    borderRadius: 5,
    backgroundColor: '#E3F2FD',
  },
  // Update the appIconContainer to remove the background color
  appIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
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
});

export default HomeScreen;
