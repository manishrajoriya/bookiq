import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import Purchases, { CustomerInfo, PurchasesOffering } from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';

const PayWall = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | undefined>();
  const [offerings, setOfferings] = useState<PurchasesOffering | undefined>();
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      try {
        const configured = await Purchases.isConfigured();
        if (configured) {
          setIsConfigured(true);
          await loadCustomerData();
          return;
        }
        const apiKey = __DEV__ 
          ? 'goog_MbtvzZWOvbOowwuAEceuQFLMVaF' 
          : 'goog_MbtvzZWOvbOowwuAEceuQFLMVaF';
        await Purchases.configure({
          apiKey,
          appUserID: undefined,
          userDefaultsSuiteName: undefined,
          shouldShowInAppMessagesAutomatically: true,
          entitlementVerificationMode: Purchases.ENTITLEMENT_VERIFICATION_MODE.DISABLED
        });
        setIsConfigured(true);
        await loadCustomerData();
      } catch (error) {
        console.error('Error initializing RevenueCat:', error);
        Alert.alert('Error', 'Failed to initialize payment system');
      } finally {
        setIsLoading(false);
      }
    };
    initialize();
  }, []);

  const loadCustomerData = async () => {
    try {
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
      const offs = await Purchases.getOfferings();
      setOfferings(offs.current ?? undefined);
      // Removed automatic presentPaywall call to avoid threading error
    } catch (error) {
      console.error('Error loading customer data:', error);
      Alert.alert('Error', 'Failed to load subscription data');
    }
  };

  const presentPaywall = async () => {
    try {
      if (!isConfigured) return;
      try {
        const paywallResult = await RevenueCatUI.presentPaywall();
        handlePaywallResult(paywallResult);
      } catch (error) {
        console.error('Error in presentPaywall:', error);
        Alert.alert('Error', 'Failed to show payment options. Please try again.');
      }
    } catch (error) {
      console.error('Error presenting paywall:', error);
      Alert.alert('Error', 'Failed to show payment options');
    }
  };

  const handlePaywallResult = (result: string) => {
    switch (result) {
      case RevenueCatUI.PAYWALL_RESULT.NOT_PRESENTED:
        break;
      case RevenueCatUI.PAYWALL_RESULT.CANCELLED:
        break;
      case RevenueCatUI.PAYWALL_RESULT.PURCHASED:
      case RevenueCatUI.PAYWALL_RESULT.RESTORED:
        handleSuccessfulPurchase();
        break;
      default:
        break;
    }
  };

  const handleSuccessfulPurchase = async () => {
    try {
      const updatedCustomerInfo = await Purchases.getCustomerInfo();
      setCustomerInfo(updatedCustomerInfo);
      Alert.alert(
        'Success!',
        'Thank you for your purchase! You now have premium access.',
        [{ text: 'OK', onPress: () => {} }]
      );
    } catch (error) {
      console.error('Error getting updated customer info:', error);
    }
  };

  const restorePurchases = async () => {
    try {
      if (!isConfigured) {
        Alert.alert('Error', 'Payment system not ready. Please try again.');
        return;
      }
      setIsLoading(true);
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
      if (info.entitlements.active.premium) {
        Alert.alert('Success', 'Your purchases have been restored!');
      } else {
        Alert.alert('No Purchases', 'No previous purchases found.');
      }
    } catch (error) {
      console.error('Error restoring purchases:', error);
      Alert.alert('Error', 'Failed to restore purchases');
    } finally {
      setIsLoading(false);
    }
  };

  const checkPremiumStatus = () => {
    return customerInfo?.entitlements.active.premium !== undefined;
  };

  if (checkPremiumStatus()) {
    return (
      <View style={styles.container}>
        <Text style={styles.premiumText}>🎉 You have premium access!</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading payment options...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Premium Features</Text>
      <Text style={styles.subtitle}>
        Unlock all premium features and enjoy unlimited access!
      </Text>
      <View style={styles.buttonContainer}>
        <Text 
          style={styles.button}
          onPress={presentPaywall}
        >
          Subscribe Now
        </Text>
        <Text 
          style={styles.restoreButton}
          onPress={restorePurchases}
        >
          Restore Purchases
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
  },
  premiumText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    padding: 15,
    borderRadius: 8,
    textAlign: 'center',
    marginBottom: 15,
    width: '100%',
  },
  restoreButton: {
    color: '#007AFF',
    fontSize: 16,
    textAlign: 'center',
    padding: 10,
  },
});

export default PayWall;