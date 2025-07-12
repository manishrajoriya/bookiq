import { useCallback, useEffect, useState } from 'react';
import { PurchasesPackage } from 'react-native-purchases';
import subscriptionService from '../services/subscriptionService';

interface SubscriptionState {
  isSubscribed: boolean;
  currentPlan?: string;
  expirationDate?: string;
  entitlements: string[];
  credits: {
    local: number;
    online: number;
    total: number;
  };
  loading: boolean;
  error?: string;
}

export const useSubscription = () => {
  const [state, setState] = useState<SubscriptionState>({
    isSubscribed: false,
    entitlements: [],
    credits: { local: 0, online: 0, total: 0 },
    loading: true
  });

  const loadSubscriptionData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: undefined }));
      
      const [subscriptionInfo, credits] = await Promise.all([
        subscriptionService.getSubscriptionInfo(),
        subscriptionService.getCurrentCredits()
      ]);

      setState(prev => ({
        ...prev,
        ...subscriptionInfo,
        credits,
        loading: false
      }));
    } catch (error) {
      console.error('useSubscription: Failed to load subscription data:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to load subscription data'
      }));
    }
  }, []);

  const purchasePackage = useCallback(async (pack: PurchasesPackage) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: undefined }));
      
      const result = await subscriptionService.purchasePackage(pack);
      
      if (result.success) {
        // Reload subscription data after successful purchase
        await loadSubscriptionData();
        return { success: true, credits: result.credits };
      } else {
        setState(prev => ({ ...prev, loading: false, error: result.error }));
        return { success: false, error: result.error, isPending: result.isPending };
      }
    } catch (error) {
      console.error('useSubscription: Purchase failed:', error);
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: 'Purchase failed' 
      }));
      return { success: false, error: 'Purchase failed' };
    }
  }, [loadSubscriptionData]);

  const spendCredits = useCallback(async (amount: number) => {
    try {
      const result = await subscriptionService.spendCredits(amount);
      
      if (result.success) {
        // Reload credits after spending
        const updatedCredits = await subscriptionService.getCurrentCredits();
        setState(prev => ({
          ...prev,
          credits: updatedCredits
        }));
      }
      
      return result;
    } catch (error) {
      console.error('useSubscription: Failed to spend credits:', error);
      return { success: false, error: 'Failed to spend credits' };
    }
  }, []);

  const restorePurchases = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: undefined }));
      
      await subscriptionService.restorePurchases();
      await loadSubscriptionData();
      
      return { success: true };
    } catch (error) {
      console.error('useSubscription: Failed to restore purchases:', error);
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: 'Failed to restore purchases' 
      }));
      return { success: false, error: 'Failed to restore purchases' };
    }
  }, [loadSubscriptionData]);

  const refreshCredits = useCallback(async () => {
    try {
      const credits = await subscriptionService.getCurrentCredits();
      setState(prev => ({ ...prev, credits }));
    } catch (error) {
      console.error('useSubscription: Failed to refresh credits:', error);
    }
  }, []);

  useEffect(() => {
    // Initialize subscription service and load data
    const initialize = async () => {
      try {
        await subscriptionService.initialize();
        await loadSubscriptionData();
      } catch (error) {
        console.error('useSubscription: Initialization failed:', error);
        setState(prev => ({ 
          ...prev, 
          loading: false, 
          error: 'Failed to initialize subscription service' 
        }));
      }
    };

    initialize();
  }, [loadSubscriptionData]);

  return {
    ...state,
    purchasePackage,
    spendCredits,
    restorePurchases,
    refreshCredits,
    reload: loadSubscriptionData
  };
}; 