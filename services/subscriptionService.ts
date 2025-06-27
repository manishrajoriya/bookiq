import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';

export const initializeRevenueCat = async () => {
  if (Platform.OS === 'android') {
    await Purchases.configure({ apiKey: process.env.EXPO_PUBLIC_REVENUCAT_API_KEY! });
  } else {
    await Purchases.configure({ apiKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY! });
  }
};