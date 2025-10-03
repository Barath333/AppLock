import React from 'react';
import {View, Text, StyleSheet, ScrollView, Linking} from 'react-native';
import {List, Divider, Card} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';

const AboutScreen = () => {
  const navigation = useNavigation();

  const handleContactSupport = () => {
    Linking.openURL('mailto:support@applock.com?subject=App%20Lock%20Support');
  };

  const handlePrivacyPolicy = () => {
    // You can replace this with your actual privacy policy URL
    Linking.openURL('https://yourapp.com/privacy');
  };

  const handleTermsOfService = () => {
    // You can replace this with your actual terms of service URL
    Linking.openURL('https://yourapp.com/terms');
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.title}>App Lock</Text>
          <Text style={styles.version}>Version 1.0.0</Text>
          <Text style={styles.description}>
            Secure your privacy by locking apps with a PIN code. App Lock
            provides comprehensive protection for your personal applications and
            data.
          </Text>
        </Card.Content>
      </Card>

      <List.Section>
        <List.Subheader style={styles.sectionHeader}>
          Information
        </List.Subheader>
        <List.Item
          title="Contact Support"
          description="Get help with the app"
          left={props => (
            <List.Icon {...props} icon="headset" color="#1E88E5" />
          )}
          onPress={handleContactSupport}
        />
        <List.Item
          title="Privacy Policy"
          description="How we handle your data"
          left={props => (
            <List.Icon {...props} icon="shield-account" color="#1E88E5" />
          )}
          onPress={handlePrivacyPolicy}
        />
        <List.Item
          title="Terms of Service"
          description="App usage terms and conditions"
          left={props => (
            <List.Icon {...props} icon="file-document" color="#1E88E5" />
          )}
          onPress={handleTermsOfService}
        />
      </List.Section>

      <Divider style={styles.divider} />

      <List.Section>
        <List.Subheader style={styles.sectionHeader}>Features</List.Subheader>
        <List.Item
          title="🔒 App Locking"
          description="Lock any app with PIN protection"
          left={props => <List.Icon {...props} icon="lock" color="#4CAF50" />}
        />
        <List.Item
          title="👆 Biometric Auth"
          description="Unlock with fingerprint or face ID"
          left={props => (
            <List.Icon {...props} icon="fingerprint" color="#4CAF50" />
          )}
        />
        <List.Item
          title="❓ Security Question"
          description="Recover PIN if forgotten"
          left={props => (
            <List.Icon {...props} icon="help-circle" color="#4CAF50" />
          )}
        />
        <List.Item
          title="🔄 Master PIN Change"
          description="Update your security PIN anytime"
          left={props => (
            <List.Icon {...props} icon="key-change" color="#4CAF50" />
          )}
        />
      </List.Section>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          © 2024 App Lock. All rights reserved.
        </Text>
        <Text style={styles.footerSubtext}>
          Protect your privacy, one app at a time.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  card: {
    margin: 16,
    borderRadius: 12,
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1E88E5',
    marginBottom: 8,
  },
  version: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666',
    lineHeight: 20,
  },
  sectionHeader: {
    color: '#1E88E5',
    fontWeight: '600',
    fontSize: 16,
  },
  divider: {
    marginVertical: 10,
    marginHorizontal: 16,
    backgroundColor: '#E0E0E0',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    color: '#666',
    fontSize: 14,
    marginBottom: 4,
  },
  footerSubtext: {
    color: '#999',
    fontSize: 12,
  },
});

export default AboutScreen;
