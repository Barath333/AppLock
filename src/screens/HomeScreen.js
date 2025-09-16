import React, {useState, useEffect} from 'react';
import {View, Text, StyleSheet, FlatList, Switch} from 'react-native';
import {Searchbar, Button, Appbar} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import DeviceInfo from 'react-native-device-info';

const HomeScreen = () => {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [apps, setApps] = useState([]);
  const [filteredApps, setFilteredApps] = useState([]);
  const [lockedApps, setLockedApps] = useState([]);

  useEffect(() => {
    loadInstalledApps();
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

  const loadInstalledApps = async () => {
    try {
      // This would actually fetch the installed apps
      // For now, we'll use mock data
      const mockApps = [
        {id: '1', name: 'WhatsApp', packageName: 'com.whatsapp', locked: false},
        {
          id: '2',
          name: 'Facebook',
          packageName: 'com.facebook.katana',
          locked: true,
        },
        {
          id: '3',
          name: 'Instagram',
          packageName: 'com.instagram.android',
          locked: true,
        },
        {
          id: '4',
          name: 'Messenger',
          packageName: 'com.facebook.orca',
          locked: false,
        },
        {
          id: '5',
          name: 'Gmail',
          packageName: 'com.google.android.gm',
          locked: false,
        },
        {
          id: '6',
          name: 'Photos',
          packageName: 'com.google.android.apps.photos',
          locked: false,
        },
        {
          id: '7',
          name: 'Chrome',
          packageName: 'com.android.chrome',
          locked: false,
        },
        {
          id: '8',
          name: 'Gallery',
          packageName: 'com.sec.android.gallery3d',
          locked: true,
        },
      ];

      setApps(mockApps);
      setFilteredApps(mockApps);

      // Get actually locked apps from storage
      const locked = mockApps.filter(app => app.locked);
      setLockedApps(locked);
    } catch (error) {
      console.error('Error loading apps:', error);
    }
  };

  const toggleAppLock = appId => {
    const updatedApps = apps.map(app =>
      app.id === appId ? {...app, locked: !app.locked} : app,
    );

    setApps(updatedApps);

    // Update locked apps list
    const locked = updatedApps.filter(app => app.locked);
    setLockedApps(locked);

    // Here you would save this to persistent storage
  };

  const renderAppItem = ({item}) => (
    <View style={styles.appItem}>
      <View style={styles.appInfo}>
        <Text style={styles.appName}>{item.name}</Text>
        <Text style={styles.packageName}>{item.packageName}</Text>
      </View>
      <Switch
        value={item.locked}
        onValueChange={() => toggleAppLock(item.id)}
        color="#6200ee"
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.Content title="App Lock" />
        <Appbar.Action
          icon="cog"
          onPress={() => navigation.navigate('Settings')}
        />
      </Appbar.Header>

      <View style={styles.content}>
        <Text style={styles.statusText}>
          {lockedApps.length} of {apps.length} apps locked
        </Text>

        <Searchbar
          placeholder="Search apps"
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
        />

        <FlatList
          data={filteredApps}
          renderItem={renderAppItem}
          keyExtractor={item => item.id}
          style={styles.appList}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statusText: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
    color: '#666',
  },
  searchBar: {
    marginBottom: 16,
    elevation: 2,
  },
  appList: {
    flex: 1,
  },
  appItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginBottom: 8,
    backgroundColor: 'white',
    borderRadius: 8,
    elevation: 1,
  },
  appInfo: {
    flex: 1,
  },
  appName: {
    fontSize: 16,
    fontWeight: '500',
  },
  packageName: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
});

export default HomeScreen;
