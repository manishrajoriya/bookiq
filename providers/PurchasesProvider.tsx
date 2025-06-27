import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Purchases, { CustomerInfo, LOG_LEVEL, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { addExpiringCredits } from '../services/historyStorage';

interface PurchasesContextType {
  user: {
    id: string;
    pro: boolean;
  };
  offerings: PurchasesOffering | null;
  isPro: boolean;
  login: (userId: string) => Promise<void>;
  logout: () => Promise<void>;
  purchasePackage: (pack: PurchasesPackage) => Promise<void>;
  restorePurchases: () => Promise<CustomerInfo>;
}

const PurchasesContext = createContext<PurchasesContextType | null>(null);

const PurchasesProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState({
    id: '',
    pro: false,
  });
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    const init = async () => {
      if (Platform.OS === 'android') {
        await Purchases.configure({ apiKey: process.env.EXPO_PUBLIC_REVENUCAT_API_KEY! });
      } else {
        await Purchases.configure({ apiKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY! });
      }

      Purchases.setLogLevel(LOG_LEVEL.DEBUG);

      const offerings = await Purchases.getOfferings();
      setOfferings(offerings.current);

      const customerInfo = await Purchases.getCustomerInfo();
      setUser({
        id: customerInfo.originalAppUserId,
        pro: customerInfo.entitlements.active.pro ? true : false,
      });
    };

    init();

    const customerInfoUpdate = (customerInfo: CustomerInfo) => {
        setUser({
            id: customerInfo.originalAppUserId,
            pro: customerInfo.entitlements.active.pro ? true : false,
        });
    };

    Purchases.addCustomerInfoUpdateListener(customerInfoUpdate);
  }, []);

  const login = async (userId: string) => {
    const { customerInfo, created } = await Purchases.logIn(userId);
    setUser({
        id: customerInfo.originalAppUserId,
        pro: customerInfo.entitlements.active.pro ? true : false,
    });
  };

  const logout = async () => {
    await Purchases.logOut();
    setUser({
        id: '',
        pro: false,
    });
  };

  const purchasePackage = async (pack: PurchasesPackage) => {
    try {
      const { customerInfo } = await Purchases.purchasePackage(pack);
      if (customerInfo.entitlements.active.pro) {
        setIsPro(true);
        const expirationDate = customerInfo.entitlements.all.pro?.expirationDate;
        console.log('PURCHASED:', pack.product.identifier, 'Expiration:', expirationDate);
        if (expirationDate) {
          if (pack.product.identifier.includes('week')) {
            console.log('Adding 100 expiring credits for week plan');
            await addExpiringCredits(100, expirationDate);
          } else if (pack.product.identifier.includes('year')) {
            console.log('Adding 1000 expiring credits for year plan');
            await addExpiringCredits(1000, expirationDate);
          } else {
            console.log('No matching plan for credits');
          }
        } else {
          console.log('No expiration date found');
        }
      }
    } catch (e: any) {
      if (!e.userCancelled) {
        alert(e);
      }
    }
  };

  const restorePurchases = async () => {
    try {
      const customerInfo = await Purchases.restorePurchases();
      setUser({
        id: customerInfo.originalAppUserId,
        pro: customerInfo.entitlements.active.pro ? true : false,
      });
      if (customerInfo.entitlements.active.pro) {
        setIsPro(true);
      }
      return customerInfo;
    } catch (e: any) {
      throw e;
    }
  };

  return (
    <PurchasesContext.Provider value={{ user, offerings, isPro, login, logout, purchasePackage, restorePurchases }}>
      {children}
    </PurchasesContext.Provider>
  );
};

export const usePurchases = () => {
  return useContext(PurchasesContext) as PurchasesContextType;
};

export default PurchasesProvider; 