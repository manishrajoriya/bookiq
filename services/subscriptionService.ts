import { Platform } from 'react-native';
import Purchases, { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { addExpiringCredits, getCredits, spendCredits } from './historyStorage';
import { addExpiringCreditsOnline, getCreditsOnline, spendCreditsOnline } from './onlineStorage';

// Credit mapping for different subscription plans
const PLAN_CREDITS: Record<string, number> = {
  weekly: 100,
  monthly: 400,
  yearly: 1000,
  year: 1000, // Handle both 'yearly' and 'year' identifiers
};

// Credit expiration mapping
const PLAN_DURATION: Record<string, number> = {
  weekly: 7, // days
  monthly: 30, // days
  yearly: 365, // days
  year: 365, // days
};

class SubscriptionService {
  private static instance: SubscriptionService;
  private isInitialized = false;

  static getInstance(): SubscriptionService {
    if (!SubscriptionService.instance) {
      SubscriptionService.instance = new SubscriptionService();
    }
    return SubscriptionService.instance;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      if (Platform.OS === 'android') {
        await Purchases.configure({ apiKey: process.env.EXPO_PUBLIC_REVENUCAT_API_KEY! });
      } else {
        await Purchases.configure({ apiKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY! });
      }

      // Set up customer info listener
      Purchases.addCustomerInfoUpdateListener(this.handleCustomerInfoUpdate.bind(this));
      
      this.isInitialized = true;
      console.log('SubscriptionService: Initialized successfully');
    } catch (error) {
      console.error('SubscriptionService: Initialization failed:', error);
      throw error;
    }
  }

  private async handleCustomerInfoUpdate(customerInfo: CustomerInfo) {
    console.log('SubscriptionService: Customer info updated:', customerInfo);
    // Handle any subscription status changes
    await this.syncCreditsWithSubscription(customerInfo);
  }

  async getOfferings(): Promise<PurchasesOffering | null> {
    try {
      const offerings = await Purchases.getOfferings();
      return offerings.current;
    } catch (error) {
      console.error('SubscriptionService: Failed to get offerings:', error);
      return null;
    }
  }

  async purchasePackage(pack: PurchasesPackage): Promise<{ success: boolean; credits?: number; error?: string; isPending?: boolean }> {
    try {
      console.log('SubscriptionService: Purchasing package:', pack.identifier);
      
      // Attempt the purchase
      const { customerInfo } = await Purchases.purchasePackage(pack);
      console.log('SubscriptionService: Purchase successful, customer info updated');
      
      const productId = pack.product.identifier.toLowerCase();
      console.log('SubscriptionService: Product ID:', productId);
      
      // Get credits for this plan
      const creditsToAdd = PLAN_CREDITS[productId] || 0;
      const durationDays = PLAN_DURATION[productId] || 30;
      
      console.log('SubscriptionService: Credits to add:', creditsToAdd, 'Duration days:', durationDays);
      
      if (creditsToAdd > 0) {
        try {
          // Calculate expiration date
          const expirationDate = new Date();
          expirationDate.setDate(expirationDate.getDate() + durationDays);
          
          console.log('SubscriptionService: Adding credits with expiration:', expirationDate.toISOString());
          
          // Add credits to local storage first (always works)
          await addExpiringCredits(creditsToAdd, expirationDate.toISOString());
          
          // Try to add to online storage (optional - only if user is authenticated)
          try {
            await addExpiringCreditsOnline(creditsToAdd, expirationDate.toISOString());
            console.log('SubscriptionService: Credits added to online storage successfully');
          } catch (onlineError: any) {
            if (onlineError.message === 'Not authenticated') {
              console.log('SubscriptionService: User not authenticated, skipping online storage');
            } else {
              console.error('SubscriptionService: Failed to add credits to online storage:', onlineError);
            }
          }
          
          console.log(`SubscriptionService: Successfully added ${creditsToAdd} credits expiring on ${expirationDate.toISOString()}`);
          
          return {
            success: true,
            credits: creditsToAdd
          };
        } catch (creditError: any) {
          console.error('SubscriptionService: Failed to add credits:', creditError);
          
          // Purchase was successful but credit addition failed
          // This is a partial success - we should still return success but warn about credits
          return {
            success: true,
            credits: 0,
            error: 'Purchase successful but failed to add credits. Please contact support.'
          };
        }
      }
      
      console.log('SubscriptionService: No credits to add for this plan');
      return { success: true };
      
    } catch (error: any) {
      console.error('SubscriptionService: Purchase failed:', error);
      
      // Handle different types of purchase errors
      if (error.userCancelled || error.code === 'USER_CANCELED') {
        return { success: false, error: 'Purchase cancelled' };
      }
      
      if (error.code === 'PURCHASE_NOT_ALLOWED_ERROR') {
        return { success: false, error: 'Purchases are not allowed on this device. Please check your device settings.' };
      }
      
      if (error.code === 'PAYMENT_PENDING_ERROR') {
        return { 
          success: false, 
          error: 'Payment is pending. Your payment is being processed and will be confirmed shortly. You can check your purchase status or try again in a few minutes.',
          isPending: true 
        };
      }
      
      if (error.code === 'PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR') {
        return { success: false, error: 'This subscription is currently unavailable. Please try again later.' };
      }
      
      if (error.code === 'PRODUCT_ALREADY_PURCHASED_ERROR') {
        return { success: false, error: 'You already own this item. Please try restoring your purchases.' };
      }
      
      if (error.code === 'RECEIPT_IN_USE_BY_OTHER_SUBSCRIBER_ERROR') {
        return { success: false, error: 'This purchase is linked to another user account. Please login to that account or contact support.' };
      }
      
      if (error.code === 'NETWORK_ERROR' || error.message?.includes('network')) {
        return { success: false, error: 'Network error. Please check your connection and try again.' };
      }
      
      // Generic error
      return { success: false, error: error.message || 'Purchase failed. Please try again.' };
    }
  }

  async getCurrentCredits(): Promise<{ local: number; online: number; total: number }> {
    try {
      // Get local credits (always works)
      const localCredits = await getCredits();
      
      // Try to get online credits (optional - only if user is authenticated)
      let onlineCredits = 0;
      try {
        onlineCredits = await getCreditsOnline();
      } catch (onlineError: any) {
        if (onlineError.message === 'Not authenticated') {
          console.log('SubscriptionService: User not authenticated, online credits not available');
        } else {
          console.error('SubscriptionService: Failed to get online credits:', onlineError);
        }
      }
      
      return {
        local: localCredits,
        online: onlineCredits,
        total: localCredits + onlineCredits
      };
    } catch (error) {
      console.error('SubscriptionService: Failed to get credits:', error);
      return { local: 0, online: 0, total: 0 };
    }
  }

  async spendCredits(amount: number): Promise<{ success: boolean; remainingCredits?: number; error?: string }> {
    try {
      console.log(`SubscriptionService: Attempting to spend ${amount} credits`);
      
      // Try local credits first
      const localSuccess = await spendCredits(amount);
      
      if (localSuccess) {
        const remaining = await getCredits();
        
        // Try to sync with online storage if user is authenticated
        try {
          await spendCreditsOnline(amount);
        } catch (onlineError: any) {
          if (onlineError.message === 'Not authenticated') {
            console.log('SubscriptionService: User not authenticated, skipping online credit sync');
          } else {
            console.error('SubscriptionService: Failed to sync credits with online storage:', onlineError);
          }
        }
        
        return { success: true, remainingCredits: remaining };
      }
      
      // If local credits insufficient, try online credits
      try {
        const onlineSuccess = await spendCreditsOnline(amount);
        if (onlineSuccess) {
          const remaining = await this.getCurrentCredits();
          return { success: true, remainingCredits: remaining.total };
        }
      } catch (onlineError: any) {
        if (onlineError.message === 'Not authenticated') {
          console.log('SubscriptionService: User not authenticated, online credits not available');
        } else {
          console.error('SubscriptionService: Failed to spend online credits:', onlineError);
        }
      }
      
      return { success: false, error: 'Insufficient credits' };
    } catch (error) {
      console.error('SubscriptionService: Failed to spend credits:', error);
      return { success: false, error: 'Failed to process credit transaction' };
    }
  }

  async restorePurchases(): Promise<CustomerInfo> {
    try {
      const customerInfo = await Purchases.restorePurchases();
      await this.syncCreditsWithSubscription(customerInfo);
      return customerInfo;
    } catch (error) {
      console.error('SubscriptionService: Failed to restore purchases:', error);
      throw error;
    }
  }

  async restoreCreditsForAllPurchases(): Promise<{ restored: number; errors: number }> {
    // For one-time purchases, there's no concept of "restoring" credits
    // Credits are added immediately upon purchase
    console.log('SubscriptionService: Restore not applicable for one-time purchases');
    return { restored: 0, errors: 0 };
  }

  private async syncCreditsWithSubscription(customerInfo: CustomerInfo) {
    // For one-time purchases, no subscription syncing is needed
    // Credits are managed independently of subscription status
    console.log('SubscriptionService: No subscription syncing needed for one-time purchases');
  }



  async checkSubscriptionStatus(): Promise<{ isSubscribed: boolean; entitlements: string[] }> {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      const activeEntitlements = Object.keys(customerInfo.entitlements.active);
      
      return {
        isSubscribed: activeEntitlements.length > 0,
        entitlements: activeEntitlements
      };
    } catch (error) {
      console.error('SubscriptionService: Failed to check subscription status:', error);
      return { isSubscribed: false, entitlements: [] };
    }
  }

  // Helper method to get subscription info for a specific user
  async getSubscriptionInfo(): Promise<{
    isSubscribed: boolean;
    currentPlan?: string;
    expirationDate?: string;
    entitlements: string[];
  }> {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      const activeEntitlements = customerInfo.entitlements.active;
      
      if (Object.keys(activeEntitlements).length === 0) {
        return { isSubscribed: false, entitlements: [] };
      }
      
      // Get the first active entitlement (assuming one subscription at a time)
      const firstEntitlement = Object.values(activeEntitlements)[0];
      
      return {
        isSubscribed: true,
        currentPlan: firstEntitlement.productIdentifier,
        expirationDate: firstEntitlement.expirationDate || undefined,
        entitlements: Object.keys(activeEntitlements)
      };
    } catch (error) {
      console.error('SubscriptionService: Failed to get subscription info:', error);
      return { isSubscribed: false, entitlements: [] };
    }
  }
}

export default SubscriptionService.getInstance();