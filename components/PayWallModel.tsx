import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Purchases, { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { addExpiringCredits, getCredits } from '../services/historyStorage';

const { width: screenWidth } = Dimensions.get('window');

const premiumFeatures = [
  { icon: 'infinite', title: 'Unlimited AI Scans', subtitle: 'Scan any document without limits' },
  { icon: 'library', title: 'Unlimited Quiz Generation', subtitle: 'Create endless practice quizzes' },
  { icon: 'albums', title: 'Unlimited Flash Card Sets', subtitle: 'Build comprehensive study decks' },
  { icon: 'headset', title: 'Priority Support', subtitle: '24/7 dedicated customer service' },
  { icon: 'school', title: 'Access to All Subjects', subtitle: 'Every topic and discipline covered' },
  { icon: 'shield-checkmark', title: 'Ad-Free Experience', subtitle: 'Focus without interruptions' },
];

const reviews = [
  {
    name: 'Aarav S.',
    rating: 5,
    text: 'BookIQ PRO helped me ace my exams! The AI features are a game changer.',
  },
  {
    name: 'Priya M.',
    rating: 5,
    text: 'The credits system is super fair and flexible. Highly recommend!',
  },
  {
    name: 'Rahul D.',
    rating: 5,
    text: 'I love being able to buy extra credits when I need them. 5 stars!',
  },
];

const planCredits: Record<string, number> = {
  weekly: 100,
  monthly: 400,
  yearly: 1000,
};

interface ErrorState {
  hasError: boolean;
  message: string;
  type: 'network' | 'purchase' | 'restore' | 'general';
}

const PayWallModel = () => {
  // State management
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [expiryDate, setExpiryDate] = useState<string | null>(null);
  const [credits, setCredits] = useState<number>(0);
  const [error, setError] = useState<ErrorState>({ hasError: false, message: '', type: 'general' });
  const [retryCount, setRetryCount] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    fetchData();
    startAnimations();
  }, []);

  const startAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      })
    ]).start();
  };

  const clearError = useCallback(() => {
    setError({ hasError: false, message: '', type: 'general' });
  }, []);

  const handleError = useCallback((message: string, type: ErrorState['type'] = 'general') => {
    console.error(`PayWall Error (${type}):`, message);
    setError({ hasError: true, message, type });
  }, []);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    clearError();

    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 15000)
      );

      const dataPromise = Promise.all([
        Purchases.getOfferings(),
        Purchases.getCustomerInfo(),
        getCredits(),
      ]);

      const [offeringsRes, customerInfo, creditsData] = await Promise.race([
        dataPromise,
        timeoutPromise
      ]) as [any, CustomerInfo, number];

      setOfferings(offeringsRes.current);
      updateSubscriptionStatus(customerInfo);
      setCredits(creditsData);
      setRetryCount(0);
    } catch (e: any) {
      console.error('Fetch data error:', e);
      
      if (e.message === 'Request timeout') {
        handleError('Connection timeout. Please check your internet connection.', 'network');
      } else if (e.code === 'NETWORK_ERROR' || e.message.includes('network')) {
        handleError('Network error. Please check your connection and try again.', 'network');
      } else {
        handleError('Failed to load subscription information. Please try again.', 'general');
      }
      
      setRetryCount(prev => prev + 1);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const updateSubscriptionStatus = (customerInfo: CustomerInfo) => {
    try {
      const proEntitlement = customerInfo.entitlements.active.pro;
      if (proEntitlement) {
        let formattedExpiryDate: string | null = null;
        if (proEntitlement.expirationDate) {
          const date = new Date(proEntitlement.expirationDate);
          formattedExpiryDate = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
        }
        
        setSubscribed(true);
        setCurrentPlan(proEntitlement.productIdentifier);
        setExpiryDate(formattedExpiryDate);
      } else {
        setSubscribed(false);
        setCurrentPlan(null);
        setExpiryDate(null);
      }
    } catch (e) {
      console.error('Error updating subscription status:', e);
      handleError('Failed to update subscription status.', 'general');
    }
  };

  const handlePurchase = async (pack: PurchasesPackage) => {
    setPurchaseLoading(pack.identifier);
    clearError();
    
    try {
      const { customerInfo } = await Purchases.purchasePackage(pack);
      
      const creditsToAdd = planCredits[pack.product.identifier.toLowerCase()] || 0;
      let expirationDate: Date | null = null;
      const planIdentifier = pack.product.identifier;
      
      if (planIdentifier.toLowerCase().includes('week')) {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        expirationDate = d;
      } else if (planIdentifier.toLowerCase().includes('month')) {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        expirationDate = d;
      } else if (planIdentifier.toLowerCase().includes('year')) {
        const d = new Date();
        d.setFullYear(d.getFullYear() + 1);
        expirationDate = d;
      }

      if (creditsToAdd > 0 && expirationDate) {
        const initialCredits = await getCredits();
        await addExpiringCredits(creditsToAdd, expirationDate.toISOString());
        const finalCredits = await getCredits();

        if (finalCredits > initialCredits) {
          setCredits(finalCredits);
          setSubscribed(true);
          setCurrentPlan(planIdentifier);
          setExpiryDate(expirationDate.toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
          }));

          Alert.alert(
            '🎉 Purchase Successful!',
            `${creditsToAdd} credits have been added to your account.`,
            [{ text: 'Awesome!', style: 'default' }]
          );
        } else {
          handleError(`Your purchase was successful, but we failed to add credits to your account. Please contact support immediately.`, 'purchase');
        }
      } else {
        updateSubscriptionStatus(customerInfo);
        Alert.alert(
          '🎉 Purchase Successful!',
          'Your purchase was completed.',
          [{ text: 'Great!', style: 'default' }]
        );
      }
    } catch (e: any) {
      // Suppress logging for user cancellation errors
      if (
        e.userCancelled ||
        e.code === 'PurchaseCancelledError' ||
        e.code === 'USER_CANCELED' ||
        (e.message && e.message.toLowerCase().includes('cancel'))
      ) {
        setPurchaseLoading(null);
        return;
      }
      // Only log unexpected errors
      
      switch (e.code) {
        case 'PURCHASE_NOT_ALLOWED_ERROR':
          handleError('Purchases are not allowed on this device. Please check your device settings.', 'purchase');
          break;
        case 'PAYMENT_PENDING_ERROR':
          Alert.alert(
            'Payment Pending',
            'Your payment is being processed. You will receive access once the payment is confirmed.',
            [{ text: 'OK', style: 'default' }]
          );
          break;
        case 'PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR':
          handleError('This subscription is currently unavailable. Please try again later.', 'purchase');
          break;
        case 'PRODUCT_ALREADY_PURCHASED_ERROR':
          handleError('You already own this item. Please try restoring your purchases.', 'purchase');
          break;
        case 'RECEIPT_IN_USE_BY_OTHER_SUBSCRIBER_ERROR':
          handleError('This purchase is linked to another user account. Please login to that account or contact support.', 'purchase');
          break;
        default:
          handleError(e.message || 'Purchase failed. Please try again.', 'purchase');
          break;
      }
    } finally {
      setPurchaseLoading(null);
    }
  };

  // const handleRestore = async () => {
  //   setRestoring(true);
  //   clearError();
    
  //   try {
  //     const customerInfo = await Purchases.restorePurchases();
  //     updateSubscriptionStatus(customerInfo);
      
  //     if (Object.keys(customerInfo.entitlements.active).length > 0) {
  //       Alert.alert(
  //         '🎉 Purchases Restored!', 
  //         'Your previous purchases have been successfully restored.',
  //         [{ text: 'Great!', style: 'default' }]
  //       );
  //     } else {
  //       Alert.alert(
  //         'No Purchases Found',
  //         'No previous purchases were found to restore. If you believe this is an error, please contact support.',
  //         [{ text: 'OK', style: 'default' }]
  //       );
  //     }
  //   } catch (e: any) {
  //     console.error('Restore error:', e);
  //     handleError('Failed to restore purchases. Please try again or contact support.', 'restore');
  //   } finally {
  //     setRestoring(false);
  //   }
  // };

  const onRefresh = useCallback(() => {
    fetchData(true);
  }, []);

  const retryAction = useCallback(() => {
    if (error.type === 'network' && retryCount < 3) {
      fetchData();
    } else {
      clearError();
      fetchData();
    }
  }, [error.type, retryCount]);

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Ionicons
        key={i}
        name={i < rating ? 'star' : 'star-outline'}
        size={16}
        color="#FFD700"
        style={{ marginRight: 2 }}
      />
    ));
  };

  const ErrorModal = () => (
    <Modal
      visible={error.hasError}
      transparent
      animationType="fade"
      onRequestClose={clearError}
    >
      <Pressable style={styles.modalOverlay} onPress={clearError}>
        <Animated.View 
          style={[
            styles.errorModal,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          <Ionicons 
            name={error.type === 'network' ? 'wifi-outline' : 'alert-circle-outline'} 
            size={48} 
            color="#FF6B6B" 
          />
          <Text style={styles.errorTitle}>
            {error.type === 'network' ? 'Connection Issue' : 'Something went wrong'}
          </Text>
          <Text style={styles.errorMessage}>{error.message}</Text>
          <View style={styles.errorActions}>
            <TouchableOpacity 
              style={styles.errorButton} 
              onPress={retryAction}
              activeOpacity={0.7}
            >
              <Text style={styles.errorButtonText}>
                {retryCount > 0 ? `Retry (${retryCount}/3)` : 'Retry'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.errorCancelButton} 
              onPress={clearError}
              activeOpacity={0.7}
            >
              <Text style={styles.errorCancelText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={styles.loadingText}>Loading your subscription options...</Text>
        <Text style={styles.loadingSubtext}>This may take a moment</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>  
          {/* Header */}
          <View style={styles.snapHeaderContainer}>
            <View style={styles.snapHeaderIconWrap}>
              <Ionicons name="diamond" size={40} color="#FFD700" />
            </View>
            <Text style={styles.snapHeaderTitle}>Save 60% on BookIQ PRO</Text>
          </View>

          {/* Offer Bar */}
          <View style={styles.offerBar}>
            <Text style={styles.offerBarText}>SPECIAL OFFER</Text>
            <Ionicons name="checkmark-circle" size={22} color="#181818" style={styles.offerBarCheck} />
          </View>

          {/* Plans */}
          <View style={styles.snapPlansContainer}>
            {offerings && offerings.availablePackages.length > 0 ? (
              offerings.availablePackages.map((pack, idx) => {
                const oldPrice = pack.product.priceString === '$1.99' ? '$4.99' : '$2.50';
                const isSelected = selectedPlan === pack.identifier;
                const isBestValue = pack.product.identifier.toLowerCase().includes('year');
                const isNoAds = pack.product.identifier.toLowerCase().includes('platinum');
                return (
                  <TouchableOpacity
                    key={pack.identifier}
                    style={[styles.snapPlanCard, isSelected && styles.snapPlanCardSelected]}
                    onPress={() => setSelectedPlan(pack.identifier)}
                    activeOpacity={0.8}
                    disabled={!!purchaseLoading}
                  >
                    {/* Badges */}
                    {isBestValue && <View style={styles.snapBadge}><Text style={styles.snapBadgeText}>BEST VALUE</Text></View>}
                    {isNoAds && <View style={styles.snapBadgeNoAds}><Text style={styles.snapBadgeNoAdsText}>NO ADS</Text></View>}
                    {/* Checkmark */}
                    {isSelected && <Ionicons name="checkmark-circle" size={24} color="#FFD700" style={styles.snapCheckmark} />}
                    {/* Plan info */}
                    <View style={styles.snapPlanRow}>
                      <Text style={styles.snapPlanName}>{pack.product.title.replace(' (BookIQ)', '')}</Text>
                      <View style={styles.snapPlanPriceRow}>
                        <Text style={styles.snapPlanOldPrice}>{oldPrice}</Text>
                        <Text style={styles.snapPlanNewPrice}>{pack.product.priceString}</Text>
                      </View>
                    </View>
                    {/* Only show description and features for selected plan */}
                    {isSelected && (
                      <>
                        <Text style={styles.snapPlanDesc}>{pack.product.description}</Text>
                        {/* Example features, you can replace with your own */}
                        <View style={{marginTop: 8}}>
                          <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 4}}>
                            <Ionicons name="checkmark" size={16} color="#FFD700" style={{marginRight: 6}} />
                            <Text style={{color: '#fff', fontSize: 13}}>Access 40+ exclusive features</Text>
                          </View>
                          <View style={{flexDirection: 'row', alignItems: 'center'}}>
                            <Ionicons name="checkmark" size={16} color="#FFD700" style={{marginRight: 6}} />
                            <Text style={{color: '#fff', fontSize: 13}}>Cancel or change plan at any time</Text>
                          </View>
                          {/* Add more features as needed */}
                        </View>
                        {/* Example extra info for monthly plan */}
                        {pack.product.identifier.toLowerCase().includes('month') && (
                          <Text style={{color: '#FFD700', fontSize: 12, marginTop: 6}}>
                            $1.99 / mo for the first 2 months, then $4.99 / mo
                          </Text>
                        )}
                      </>
                    )}
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.noPlansContainer}>
                <Ionicons name="alert-circle-outline" size={48} color="#9CA3AF" />
                <Text style={styles.noPlansText}>No subscription plans available</Text>
                <TouchableOpacity onPress={() => fetchData()} style={styles.retryButton} activeOpacity={0.7}>
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Subscribe Button */}
          <TouchableOpacity
            style={styles.snapSubscribeBtn}
            onPress={() => {
              if (selectedPlan && offerings) {
                const pack = offerings.availablePackages.find(p => p.identifier === selectedPlan);
                if (pack) handlePurchase(pack);
              }
            }}
            disabled={!selectedPlan || !!purchaseLoading}
            activeOpacity={0.8}
          >
            {purchaseLoading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.snapSubscribeBtnText}>Subscribe</Text>
            )}
          </TouchableOpacity>

          {/* Footer */}
          <View style={styles.snapFooter}>
            <Text style={styles.snapFooterText}>
              Features can change at any time. Payment will be charged to your App Store account. Subscription auto-renews unless canceled at least 24 hours before the end of the period.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
      <ErrorModal />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#181818',
  },
  content: {
    paddingBottom: 40,
    backgroundColor: '#181818',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#181818',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    color: '#1F2937',
    textAlign: 'center',
    fontFamily: 'Inter-SemiBold',
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
  },
  snapHeaderContainer: {
    backgroundColor: '#181818',
    alignItems: 'center',
    paddingTop: 36,
    paddingBottom: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  snapHeaderIconWrap: {
    backgroundColor: '#222',
    borderRadius: 40,
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  snapHeaderTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  snapPlansContainer: {
    marginTop: 12,
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  snapPlanCard: {
    backgroundColor: '#232323',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  snapPlanCardSelected: {
    borderColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    zIndex: 2,
  },
  snapBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#FFD700',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    zIndex: 2,
  },
  snapBadgeText: {
    color: '#181818',
    fontWeight: 'bold',
    fontSize: 11,
  },
  snapBadgeNoAds: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    zIndex: 2,
  },
  snapBadgeNoAdsText: {
    color: '#181818',
    fontWeight: 'bold',
    fontSize: 11,
  },
  snapCheckmark: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 3,
  },
  snapPlanRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  snapPlanName: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 17,
  },
  snapPlanPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  snapPlanOldPrice: {
    color: '#aaa',
    textDecorationLine: 'line-through',
    fontSize: 15,
    marginRight: 8,
  },
  snapPlanNewPrice: {
    color: '#FFD700',
    fontWeight: 'bold',
    fontSize: 18,
  },
  snapPlanDesc: {
    color: '#eee',
    fontSize: 13,
    marginTop: 4,
  },
  snapSubscribeBtn: {
    backgroundColor: '#FFD700',
    borderRadius: 24,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  snapSubscribeBtnText: {
    color: '#181818',
    fontWeight: 'bold',
    fontSize: 18,
  },
  snapFooter: {
    marginTop: 8,
    marginBottom: 16,
    paddingHorizontal: 18,
  },
  snapFooterText: {
    color: '#aaa',
    fontSize: 12,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    maxWidth: 320,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 12,
    textAlign: 'center',
    fontFamily: 'Inter-Bold',
  },
  errorMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    fontFamily: 'Inter-Regular',
  },
  errorActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  errorButton: {
    flex: 1,
    backgroundColor: '#7C3AED',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  errorButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  errorCancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  errorCancelText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'Inter-Medium',
  },
  noPlansContainer: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 20,
  },
  noPlansText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 20,
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
  },
  retryButton: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  offerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD700',
    borderRadius: 14,
    marginHorizontal: 18,
    marginTop: 18,
    marginBottom: 18,
    paddingVertical: 8,
    shadowColor: '#FFD700',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    position: 'relative',
  },
  offerBarText: {
    color: '#181818',
    fontWeight: 'bold',
    fontSize: 15,
    letterSpacing: 1,
    flex: 1,
    textAlign: 'center',
  },
  offerBarCheck: {
    position: 'absolute',
    right: 16,
  },
});

export default PayWallModel;