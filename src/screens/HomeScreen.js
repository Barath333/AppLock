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
} from 'react-native';
import {Searchbar, Appbar, Card} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

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
      const mockApps = [
        {
          id: '1',
          name: 'WhatsApp',
          packageName: 'com.whatsapp',
          locked: false,
          icon: 'whatsapp',
        },
        {
          id: '2',
          name: 'Facebook',
          packageName: 'com.facebook.katana',
          locked: true,
          icon: 'facebook',
        },
        {
          id: '3',
          name: 'Instagram',
          packageName: 'com.instagram.android',
          locked: true,
          icon: 'instagram',
        },
        {
          id: '4',
          name: 'Messenger',
          packageName: 'com.facebook.orca',
          locked: false,
          icon: 'facebook-messenger',
        },
        {
          id: '5',
          name: 'Gmail',
          packageName: 'com.google.android.gm',
          locked: false,
          icon: 'gmail',
        },
        {
          id: '6',
          name: 'Photos',
          packageName: 'com.google.android.apps.photos',
          locked: false,
          icon: 'image',
        },
        {
          id: '7',
          name: 'Chrome',
          packageName: 'com.android.chrome',
          locked: false,
          icon: 'google-chrome',
        },
        {
          id: '8',
          name: 'Gallery',
          packageName: 'com.sec.android.gallery3d',
          locked: true,
          icon: 'image-album',
        },
      ];

      setApps(mockApps);
      setFilteredApps(mockApps);

      const locked = mockApps.filter(app => app.locked);
      setLockedApps(locked);
    } catch (error) {
      console.error('Error loading apps:', error);
    }
  };

  const toggleAppLock = appId => {
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
    const locked = updatedApps.filter(app => app.locked);
    setLockedApps(locked);
  };

  const renderAppItem = ({item}) => (
    <Animated.View style={[styles.appItem, {transform: [{scale: scaleAnim}]}]}>
      <View style={styles.appInfo}>
        <View style={styles.appIconContainer}>
          <Icon name={item.icon} size={24} color="#42A5F5" />
        </View>
        <View style={styles.appDetails}>
          <Text style={styles.appName}>{item.name}</Text>
          <Text style={styles.packageName}>{item.packageName}</Text>
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
