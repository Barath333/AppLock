// src/screens/PremiumUpgradeScreen.js
import React from 'react';
import {View, Text, StyleSheet, ScrollView} from 'react-native';
import {Button, List} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';

const PremiumUpgradeScreen = () => {
  const navigation = useNavigation();

  const handlePurchase = () => {
    // This would integrate with react-native-iap
    Alert.alert('Premium', 'Premium purchase would be processed here');
  };

  const handleRestorePurchase = () => {
    // This would restore previous purchases
    Alert.alert('Restore', 'Would restore previous purchase');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Go Premium</Text>
        <Text style={styles.subtitle}>
          Unlock all features with a one-time purchase
        </Text>
      </View>

      <List.Section>
        <List.Item
          title="Ad-Free Experience"
          description="No more ads on the lock screen"
          left={props => <List.Icon {...props} icon="block-helper" />}
        />
        <List.Item
          title="Priority Support"
          description="Get faster help from our team"
          left={props => <List.Icon {...props} icon="headset" />}
        />
        <List.Item
          title="Advanced Features"
          description="Get access to upcoming premium features"
          left={props => <List.Icon {...props} icon="star" />}
        />
      </List.Section>

      <View style={styles.pricingContainer}>
        <Text style={styles.price}>$4.99</Text>
        <Text style={styles.pricingDescription}>
          One-time payment, forever premium
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <Button
          mode="contained"
          onPress={handlePurchase}
          style={styles.purchaseButton}
          labelStyle={styles.buttonLabel}>
          Upgrade Now
        </Button>

        <Button
          mode="outlined"
          onPress={handleRestorePurchase}
          style={styles.restoreButton}>
          Restore Purchase
        </Button>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Your payment will be charged to your Google Play account. Subscription
          automatically renews unless canceled at least 24 hours before the end
          of the current period.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: 'white',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#6200ee',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  pricingContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: 'white',
    marginTop: 10,
  },
  price: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#6200ee',
  },
  pricingDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  buttonContainer: {
    padding: 20,
  },
  purchaseButton: {
    paddingVertical: 8,
    backgroundColor: '#6200ee',
    marginBottom: 15,
  },
  buttonLabel: {
    fontSize: 16,
  },
  restoreButton: {
    borderColor: '#6200ee',
  },
  footer: {
    padding: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});

export default PremiumUpgradeScreen;
