import { Platform } from 'react-native';
import Purchases, { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import {
  addExpiringCreditsOnline,
  checkAuth,
  getCreditsOnline,
  getRestorationStatsOnline,
  isPurchaseProcessedOnline,
  isTransactionRestoredOnline,
  markPurchaseAsProcessedOnline,
  markPurchaseAsRestored,
  spendCreditsOnline,
  trackCreditRestorationOnline,
  trackPurchaseOnline
} from './onlineStorage';

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
      const creditsToAdd = PLAN_CREDITS[productId] || 0;
      const durationDays = PLAN_DURATION[productId] || 30;
      if (creditsToAdd <= 0) {
        console.log('SubscriptionService: No credits to add for this plan');
        return { success: true };
      }
      // Log all nonSubscriptionTransactions for debugging
      const allTxns = customerInfo.nonSubscriptionTransactions || [];
      console.log('All nonSubscriptionTransactions for this product:',
        allTxns.map(t => ({
          transactionIdentifier: t.transactionIdentifier,
          productIdentifier: t.productIdentifier,
          purchaseDate: t.purchaseDate
        }))
      );
      // Process all unprocessed nonSubscriptionTransactions for this product
      const transactions = allTxns.filter(t => t.productIdentifier.toLowerCase() === productId);
      if (transactions.length === 0) {
        // Fallback: try to process the latest transaction as before
        const fallbackTransactionId = `purchase_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const alreadyProcessed = await isPurchaseProcessedOnline(fallbackTransactionId);
        if (!alreadyProcessed) {
          const expirationDate = new Date();
          expirationDate.setDate(expirationDate.getDate() + durationDays);
          await addExpiringCreditsOnline(creditsToAdd, expirationDate.toISOString());
          await markPurchaseAsProcessedOnline(fallbackTransactionId);
          await trackCreditRestorationOnline(productId, fallbackTransactionId, creditsToAdd, creditsToAdd, 'initial_purchase', 'success');
          console.log('Credited fallback transaction:', fallbackTransactionId);
          return { success: true, credits: creditsToAdd };
        } else {
          console.log('Fallback transaction already processed:', fallbackTransactionId);
          return { success: true, credits: 0, error: 'Credits already added for this purchase' };
        }
      }
      let totalCreditsAdded = 0;
      let errors: string[] = [];
      for (const txn of transactions) {
        const transactionId = txn.transactionIdentifier;
        console.log('Processing transaction:', transactionId, 'purchaseDate:', txn.purchaseDate);
        try {
          const alreadyProcessed = await isPurchaseProcessedOnline(transactionId);
          if (alreadyProcessed) {
            console.log('Transaction already processed, skipping:', transactionId);
            continue;
          }
          // Track the purchase (for each transaction)
          try {
            await trackPurchaseOnline(
              productId,
              txn.purchaseDate || new Date().toISOString(),
              transactionId,
              pack.product.price,
              pack.product.currencyCode || 'INR',
              'completed'
            );
            console.log('Tracked purchase for transaction:', transactionId);
          } catch (trackError) {
            console.error('Failed to track purchase for transaction:', transactionId, trackError);
          }
          const expirationDate = new Date();
          expirationDate.setDate(expirationDate.getDate() + durationDays);
          await addExpiringCreditsOnline(creditsToAdd, expirationDate.toISOString());
          await markPurchaseAsProcessedOnline(transactionId);
          await trackCreditRestorationOnline(
            productId,
            transactionId,
            creditsToAdd,
            creditsToAdd,
            'initial_purchase',
            'success'
          );
          totalCreditsAdded += creditsToAdd;
          console.log(`Successfully added ${creditsToAdd} credits for transaction ${transactionId}`);
        } catch (creditError: any) {
          console.error('Failed to add credits for transaction', transactionId, creditError);
          errors.push(transactionId);
          try {
            await trackCreditRestorationOnline(
              productId,
              transactionId,
              creditsToAdd,
              0,
              'initial_purchase',
              'failed'
            );
          } catch (restoreTrackError) {
            console.error('Failed to track failed restoration:', restoreTrackError);
          }
        }
      }
      if (totalCreditsAdded > 0) {
        return { success: true, credits: totalCreditsAdded, error: errors.length ? `Some transactions failed: ${errors.join(', ')}` : undefined };
      } else {
        return { success: true, credits: 0, error: errors.length ? `All transactions failed: ${errors.join(', ')}` : 'Credits already added for this purchase' };
      }
    } catch (error: any) {
      console.error('Purchase failed:', error);
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
      return { success: false, error: error.message || 'Purchase failed. Please try again.' };
    }
  }

  async getCurrentCredits(): Promise<{ online: number; total: number }> {
    try {
      // Get online credits only
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
        online: onlineCredits,
        total: onlineCredits
      };
    } catch (error) {
      console.error('SubscriptionService: Failed to get credits:', error);
      return { online: 0, total: 0 };
    }
  }

  async spendCredits(amount: number): Promise<{ success: boolean; remainingCredits?: number; error?: string }> {
    try {
      console.log(`SubscriptionService: Attempting to spend ${amount} credits`);
      
      // Try online credits only
      try {
        const onlineSuccess = await spendCreditsOnline(amount);
        if (onlineSuccess) {
          const remaining = await this.getCurrentCredits();
          return { success: true, remainingCredits: remaining.total };
        }
      } catch (onlineError: any) {
        if (onlineError.message === 'Not authenticated') {
          console.log('SubscriptionService: User not authenticated, online credits not available');
          return { success: false, error: 'Please sign in to use credits' };
        } else {
          console.error('SubscriptionService: Failed to spend online credits:', onlineError);
          return { success: false, error: 'Failed to process credit transaction' };
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

  /**
   * Restore credits for a single transaction (fraud protection)
   */
  async restoreCreditsForTransaction(transactionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const userId = await checkAuth();
      const { data, error } = await (await import('../utils/supabase')).supabase
        .from('purchases')
        .select('*')
        .eq('user_id', userId)
        .eq('transaction_id', transactionId)
        .single();
      if (error || !data) {
        return { success: false, error: 'Purchase not found' };
      }
      if (data.status !== 'completed') {
        return { success: false, error: 'Payment not completed yet' };
      }
      // Only allow restore if both processed_at is null, restored is false, and credit_status is 'none'
      if (data.processed_at || data.restored || data.credit_status !== 'none') {
        return { success: false, error: 'Credits already restored or added for this transaction' };
      }
      const productId = data.product_id.toLowerCase();
      const creditsToAdd = PLAN_CREDITS[productId] || 0;
      const durationDays = PLAN_DURATION[productId] || 30;
      if (creditsToAdd <= 0) {
        return { success: false, error: 'No credits to add for this plan' };
      }
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + durationDays);
      await addExpiringCreditsOnline(creditsToAdd, expirationDate.toISOString());
      await markPurchaseAsRestored(transactionId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Restore failed' };
    }
  }

  /**
   * Check and verify credits for all purchased products
   * This is the main function for credit verification
   */
  async verifyAndRestoreCredits(): Promise<{ 
    success: boolean; 
    restored: number; 
    errors: number; 
    message: string;
    details: Array<{ productId: string; credits: number; status: string }>;
  }> {
    try {
      console.log('SubscriptionService: Starting credit verification...');
      
      const customerInfo = await Purchases.getCustomerInfo();
      const purchasedProducts = customerInfo.allPurchasedProductIdentifiers || [];
      
      if (purchasedProducts.length === 0) {
        return {
          success: true,
          restored: 0,
          errors: 0,
          message: 'No purchased products found to verify.',
          details: []
        };
      }

      console.log('SubscriptionService: Found purchased products:', purchasedProducts);
      
      let totalRestored = 0;
      let totalErrors = 0;
      const details: Array<{ productId: string; credits: number; status: string }> = [];

      // Get current credits before verification
      const currentCredits = await this.getCurrentCredits();
      console.log('SubscriptionService: Current credits before verification:', currentCredits.total);

      for (const productId of purchasedProducts) {
        try {
          const result = await this.verifySingleProductCredits(productId, customerInfo);
          if (result.success) {
            totalRestored += result.credits;
            details.push({
              productId,
              credits: result.credits,
              status: 'restored'
            });
          } else {
            totalErrors++;
            details.push({
              productId,
              credits: 0,
              status: result.error || 'failed'
            });
          }
        } catch (error) {
          console.error(`SubscriptionService: Error verifying product ${productId}:`, error);
          totalErrors++;
          details.push({
            productId,
            credits: 0,
            status: 'error'
          });
        }
      }

      // Get credits after verification
      const finalCredits = await this.getCurrentCredits();
      const actualRestored = finalCredits.total - currentCredits.total;

      console.log(`SubscriptionService: Credit verification complete. Restored: ${actualRestored}, Errors: ${totalErrors}`);

      return {
        success: totalErrors === 0,
        restored: actualRestored,
        errors: totalErrors,
        message: totalErrors === 0 
          ? `Successfully verified ${purchasedProducts.length} purchase(s). ${actualRestored > 0 ? `${actualRestored} credits restored.` : 'All credits already present.'}`
          : `Verified ${purchasedProducts.length} purchase(s) with ${totalErrors} error(s). ${actualRestored > 0 ? `${actualRestored} credits restored.` : ''}`,
        details
      };

    } catch (error) {
      console.error('SubscriptionService: Credit verification failed:', error);
      return {
        success: false,
        restored: 0,
        errors: 1,
        message: 'Failed to verify credits. Please try again or contact support.',
        details: []
      };
    }
  }

  /**
   * Verify credits for a single purchased product
   */
  private async verifySingleProductCredits(productId: string, customerInfo: CustomerInfo): Promise<{ 
    success: boolean; 
    credits: number; 
    error?: string;
  }> {
    try {
      const productIdLower = productId.toLowerCase();
      const expectedCredits = PLAN_CREDITS[productIdLower] || 0;
      const durationDays = PLAN_DURATION[productIdLower] || 30;

      if (expectedCredits === 0) {
        return { success: true, credits: 0, error: 'No credits expected for this product' };
      }

      // Check if this product was purchased recently (within last 24 hours)
      const purchaseDate = customerInfo.allPurchaseDates?.[productId];
      if (!purchaseDate) {
        return { success: false, credits: 0, error: 'Purchase date not found' };
      }

      const purchaseTime = new Date(purchaseDate).getTime();
      const now = Date.now();
      const hoursSincePurchase = (now - purchaseTime) / (1000 * 60 * 60);

      // Only process purchases from the last 24 hours to avoid duplicate credits
      if (hoursSincePurchase > 24) {
        return { success: true, credits: 0, error: 'Purchase too old for verification' };
      }

      // Get transaction ID for this purchase
      const transactionId = customerInfo.nonSubscriptionTransactions?.find(t => t.productIdentifier === productId)?.transactionIdentifier ||
                           `purchase_${purchaseTime}_${productId}`;

      // Check if this transaction has already been restored
      const alreadyRestored = await isTransactionRestoredOnline(transactionId);
      if (alreadyRestored) {
        console.log(`SubscriptionService: Transaction ${transactionId} already restored, skipping`);
        return { success: true, credits: 0, error: 'Credits already restored for this transaction' };
      }

      // Check if credits already exist for this purchase
      const currentCredits = await this.getCurrentCredits();
      
      // For now, we'll add credits if they don't exist
      // In a more sophisticated system, you might want to track which purchases have been processed
      try {
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + durationDays);
        
        await addExpiringCreditsOnline(expectedCredits, expirationDate.toISOString());
        
        // Track the successful restoration
        try {
          await trackCreditRestorationOnline(
            productId,
            transactionId,
            expectedCredits,
            expectedCredits,
            'verification',
            'success'
          );
        } catch (trackError) {
          console.error('SubscriptionService: Failed to track restoration:', trackError);
        }
        
        console.log(`SubscriptionService: Verified and added ${expectedCredits} credits for product ${productId}`);
        
        return { success: true, credits: expectedCredits };
      } catch (creditError: any) {
        console.error(`SubscriptionService: Failed to add credits for ${productId}:`, creditError);
        
        // Track the failed restoration
        try {
          await trackCreditRestorationOnline(
            productId,
            transactionId,
            expectedCredits,
            0,
            'verification',
            'failed'
          );
        } catch (trackError) {
          console.error('SubscriptionService: Failed to track failed restoration:', trackError);
        }
        
        return { success: false, credits: 0, error: 'Failed to add credits' };
      }

    } catch (error) {
      console.error(`SubscriptionService: Error in verifySingleProductCredits for ${productId}:`, error);
      return { success: false, credits: 0, error: 'Verification failed' };
    }
  }

  /**
   * Check purchase status and return detailed information
   */
  async checkPurchaseStatus(): Promise<{
    success: boolean;
    message: string;
    purchases: Array<{
      productId: string;
      purchaseDate: string;
      status: string;
      expectedCredits: number;
    }>;
    totalCredits: number;
  }> {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      const purchasedProducts = customerInfo.allPurchasedProductIdentifiers || [];
      const currentCredits = await this.getCurrentCredits();

      const purchases = purchasedProducts.map(productId => {
        const purchaseDate = customerInfo.allPurchaseDates?.[productId] || 'Unknown';
        const expectedCredits = PLAN_CREDITS[productId.toLowerCase()] || 0;
        
        return {
          productId,
          purchaseDate,
          status: 'purchased',
          expectedCredits
        };
      });

      return {
        success: true,
        message: `Found ${purchasedProducts.length} purchase(s) with ${currentCredits.total} total credits`,
        purchases,
        totalCredits: currentCredits.total
      };

    } catch (error) {
      console.error('SubscriptionService: Failed to check purchase status:', error);
      return {
        success: false,
        message: 'Failed to check purchase status',
        purchases: [],
        totalCredits: 0
      };
    }
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

  /**
   * Get restoration statistics for the current user
   */
  async getRestorationStatistics(): Promise<{
    success: boolean;
    stats: {
      totalRestorations: number;
      successfulRestorations: number;
      totalCreditsRestored: number;
      lastRestorationDate?: string;
    };
    message: string;
  }> {
    try {
      const stats = await getRestorationStatsOnline();
      
      return {
        success: true,
        stats,
        message: `You have restored ${stats.totalCreditsRestored} credits in ${stats.successfulRestorations} successful attempts.`
      };
    } catch (error) {
      console.error('SubscriptionService: Failed to get restoration statistics:', error);
      return {
        success: false,
        stats: {
          totalRestorations: 0,
          successfulRestorations: 0,
          totalCreditsRestored: 0
        },
        message: 'Unable to load restoration statistics.'
      };
    }
  }
}

export default SubscriptionService.getInstance();