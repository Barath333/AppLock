import React, {useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Linking,
  Alert,
  Animated,
} from 'react-native';
import {Button, Card} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const PermissionGrantingScreen = () => {
  const navigation = useNavigation();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

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

  const requestAccessibilityPermission = async () => {
    try {
      Linking.openSettings();
    } catch (error) {
      Alert.alert('Error', 'Could not open settings');
    }
  };

  const requestOverlayPermission = async () => {
    try {
      Alert.alert('Info', 'Please grant overlay permission in the next screen');
      Linking.openSettings();
    } catch (error) {
      Alert.alert('Error', 'Could not request overlay permission');
    }
  };

  const arePermissionsGranted = () => {
    navigation.navigate('Setup');
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
          <Text style={styles.title}>App Lock</Text>
          <Text style={styles.subtitle}>
            We need some permissions to protect your apps
          </Text>
        </View>

        <Card style={styles.permissionCard}>
          <Card.Content>
            <View style={styles.permissionItem}>
              <View style={styles.permissionIcon}>
                <Icon name="account-lock" size={30} color="#1E88E5" />
              </View>
              <View style={styles.permissionText}>
                <Text style={styles.permissionTitle}>
                  Accessibility Service
                </Text>
                <Text style={styles.permissionDesc}>
                  Required to detect when apps are launched and lock them
                </Text>
              </View>
            </View>
            <Button
              mode="contained"
              onPress={requestAccessibilityPermission}
              style={styles.button}
              labelStyle={styles.buttonLabel}>
              Grant Permission
            </Button>
          </Card.Content>
        </Card>

        <Card style={styles.permissionCard}>
          <Card.Content>
            <View style={styles.permissionItem}>
              <View style={styles.permissionIcon}>
                <Icon name="layers" size={30} color="#1E88E5" />
              </View>
              <View style={styles.permissionText}>
                <Text style={styles.permissionTitle}>
                  Display Over Other Apps
                </Text>
                <Text style={styles.permissionDesc}>
                  Required to show the lock screen over other applications
                </Text>
              </View>
            </View>
            <Button
              mode="contained"
              onPress={requestOverlayPermission}
              style={styles.button}
              labelStyle={styles.buttonLabel}>
              Grant Permission
            </Button>
          </Card.Content>
        </Card>

        <Card style={styles.permissionCard}>
          <Card.Content>
            <View style={styles.permissionItem}>
              <View style={styles.permissionIcon}>
                <Icon name="chart-bar" size={30} color="#1E88E5" />
              </View>
              <View style={styles.permissionText}>
                <Text style={styles.permissionTitle}>Usage Access</Text>
                <Text style={styles.permissionDesc}>
                  Required to see which apps are installed and running
                </Text>
              </View>
            </View>
            <Button
              mode="contained"
              onPress={requestAccessibilityPermission}
              style={styles.button}
              labelStyle={styles.buttonLabel}>
              Grant Permission
            </Button>
          </Card.Content>
        </Card>

        <Button
          mode="contained"
          onPress={arePermissionsGranted}
          style={styles.continueButton}
          labelStyle={styles.continueButtonLabel}>
          Continue
        </Button>
      </Animated.View>
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
  button: {
    marginTop: 5,
    borderRadius: 10,
    backgroundColor: '#42A5F5',
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
});

export default PermissionGrantingScreen;
