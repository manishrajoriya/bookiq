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
import { PurchasesPackage } from 'react-native-purchases';
import { useSubscription } from '../hooks/useSubscription';
import subscriptionService from '../services/subscriptionService';

const { width: screenWidth } = Dimensions.get('window');

const premiumFeatures = [
  { icon: 'book', title: 'Unlimited AI Scans', subtitle: 'Scan any document, anytime' },
  { icon: 'bulb', title: 'Quiz Generator', subtitle: 'Create custom quizzes for any subject' },
  { icon: 'flash', title: 'Flashcard Sets', subtitle: 'Build and review flashcards easily' },
  { icon: 'school', title: 'All Subjects', subtitle: 'Full access to every topic' },
  { icon: 'shield-checkmark', title: 'Ad-Free', subtitle: 'Study without distractions' },
  { icon: 'chatbubbles', title: 'Priority Support', subtitle: 'Get help when you need it' },
];

const reviews = [
  {
    name: 'Aarav S.',
    avatar: '🧑🏽‍🎓',
    text: 'BookIQ PRO helped me ace my exams! The AI features are a game changer.',
  },
  {
    name: 'Priya M.',
    avatar: '👩🏻‍🎓',
    text: 'The credits system is super fair and flexible. Highly recommend!',
  },
  {
    name: 'Rahul D.',
    avatar: '👨🏾‍🎓',
    text: 'I love being able to buy extra credits when I need them. 5 stars!',
  },
];

const faqs = [
  {
    q: 'What is BookIQ PRO?',
    a: 'BookIQ PRO provides credits for AI-powered study tools like scans, quizzes, and flashcards to supercharge your learning.'
  },
  {
    q: 'How do credits work?',
    a: 'Credits are one-time purchases that give you access to AI features. You can buy multiple credit packs to get more access.'
  },
  {
    q: 'Do credits expire?',
    a: 'Yes, credits expire after their duration period (weekly, monthly, or yearly). Use them before they expire!'
  },
  {
    q: 'Can I buy more credits?',
    a: 'Absolutely! You can purchase multiple credit packs anytime to get more access to AI features.'
  },
];

const PayWallModel = () => {
  console.log('PayWall: Component mounted');
  
  // Use the subscription hook
  const {
    isSubscribed,
    currentPlan,
    expirationDate,
    credits,
    loading,
    error,
    purchasePackage,
    restorePurchases,
    refreshCredits
  } = useSubscription();
  
  // Local state
  const [refreshing, setRefreshing] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [offerings, setOfferings] = useState<any>(null);
  const [pendingPayment, setPendingPayment] = useState(false);

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

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    }
    
    try {
      const offeringsData = await subscriptionService.getOfferings();
      if (offeringsData) {
        setOfferings(offeringsData);
      }
    } catch (error) {
      console.error('PayWall: Failed to fetch offerings:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handlePurchase = async (pack: PurchasesPackage) => {
    setPurchaseLoading(pack.identifier);
    
    try {
      const result = await purchasePackage(pack);
      
      if (result.success) {
        if (result.credits && result.credits > 0) {
          Alert.alert(
            '🎉 Purchase Successful!',
            `${result.credits} credits have been added to your account.`,
            [{ text: 'Awesome!', style: 'default' }]
          );
        } else if (result.error) {
          // Partial success - purchase worked but credits failed
          Alert.alert(
            '⚠️ Purchase Partially Successful',
            result.error,
            [
              { text: 'Contact Support', style: 'default' },
              { text: 'OK', style: 'cancel' }
            ]
          );
        } else {
          Alert.alert(
            '🎉 Purchase Successful!',
            'Your purchase was completed successfully.',
            [{ text: 'Great!', style: 'default' }]
          );
        }
      } else {
        // Handle specific error cases
        let title = 'Purchase Failed';
        let message = result.error || 'Please try again.';
        let buttons = [{ text: 'OK', style: 'default' as const }];
        
        if (result.error?.includes('cancelled')) {
          title = 'Purchase Cancelled';
          message = 'You cancelled the purchase.';
        } else if (result.error?.includes('network')) {
          title = 'Network Error';
          message = 'Please check your internet connection and try again.';
        } else if (result.error?.includes('not allowed')) {
          title = 'Purchase Not Allowed';
          message = 'Please check your device settings and try again.';
        } else if (result.isPending || result.error?.includes('pending')) {
          title = 'Payment Processing';
          message = 'Your payment is being processed and will be confirmed shortly. We\'ll automatically check for updates.';
          buttons = [{ text: 'OK', style: 'default' }];
          
          // Set pending payment state
          setPendingPayment(true);
          
          // Auto-refresh after a few seconds for pending payments
          setTimeout(() => {
            refreshCredits();
            setPendingPayment(false);
          }, 5000);
        }
        
        Alert.alert(title, message, buttons);
      }
    } catch (error: any) {
      console.error('PayWall: Purchase error:', error);
      Alert.alert('Purchase Failed', 'An unexpected error occurred. Please try again.');
    } finally {
      setPurchaseLoading(null);
    }
  };

  const onRefresh = useCallback(() => {
    fetchData(true);
  }, []);

  const checkPurchaseStatus = useCallback(async () => {
    try {
      // Refresh subscription data to check if pending payment was confirmed
      await refreshCredits();
      Alert.alert(
        'Status Checked',
        'Your purchase status has been updated. If your payment was confirmed, credits should now be available.',
        [{ text: 'OK', style: 'default' }]
      );
    } catch (error) {
      Alert.alert(
        'Status Check Failed',
        'Unable to check purchase status. Please try again later.',
        [{ text: 'OK', style: 'default' }]
      );
    }
  }, [refreshCredits]);

  const ErrorModal = () => (
    <Modal
      visible={!!error}
      transparent
      animationType="fade"
      onRequestClose={() => {}}
    >
      <Pressable style={styles.modalOverlay}>
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
            name="alert-circle-outline" 
            size={48} 
            color="#FF6B6B" 
          />
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <View style={styles.errorActions}>
            <TouchableOpacity 
              style={styles.errorButton} 
              onPress={onRefresh}
              activeOpacity={0.7}
            >
              <Text style={styles.errorButtonText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.errorCancelButton} 
              onPress={() => {}}
              activeOpacity={0.7}
            >
              <Text style={styles.errorCancelText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );

  console.log('PayWall: Component render state:', { loading, offerings: !!offerings, error: !!error });
  console.log('PayWall: Current state:', {
    loading,
    offerings: offerings ? 'Available' : 'Not available',
    offeringsCount: offerings?.availablePackages?.length || 0,
    selectedPlan,
    isSubscribed,
    currentPlan,
    credits: credits.total
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Loading your study upgrade options...</Text>
        <Text style={styles.loadingSubtext}>This may take a moment</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>  
          {/* Header */}
          <View style={styles.headerContainer}>
            <View style={styles.headerIconWrap}>
              <Ionicons name="school" size={44} color="#6C63FF" />
            </View>
            <Text style={styles.headerTitle}>Get AI Study Credits</Text>
            <Text style={styles.headerSubtitle}>Purchase credits to unlock AI-powered learning tools</Text>
            <TouchableOpacity 
              style={styles.debugRefreshButton} 
              onPress={() => fetchData(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh-outline" size={20} color="#6C63FF" />
              <Text style={styles.debugRefreshText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          {/* Feature List */}
          <View style={styles.featuresSection}>
            {premiumFeatures.map((feature, idx) => (
              <View key={idx} style={styles.featureCard}>
                <Ionicons name={feature.icon as any} size={24} color="#6C63FF" style={{marginRight: 12}} />
                <View>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureSubtitle}>{feature.subtitle}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Quick Purchase Section */}
          <View style={styles.quickPurchaseSection}>
            <Text style={styles.quickPurchaseHeader}>Quick Purchase</Text>
            <Text style={styles.quickPurchaseSubtext}>Get started with our most popular option</Text>
            {offerings && offerings.availablePackages && offerings.availablePackages.length > 0 && (
              <TouchableOpacity
                style={styles.quickPurchaseBtn}
                onPress={() => {
                  const weeklyPack = offerings.availablePackages.find((p: any) => 
                    p.product.identifier.toLowerCase().includes('week')
                  );
                  if (weeklyPack) handlePurchase(weeklyPack);
                }}
                disabled={!!purchaseLoading}
                activeOpacity={0.8}
              >
                {purchaseLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.quickPurchaseBtnText}>Get Weekly Credits</Text>
                    <Text style={styles.quickPurchaseBtnPrice}>₹250</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Plans */}
          <View style={styles.plansSection}>
            <Text style={styles.plansHeader}>Choose your credit pack</Text>
            {offerings && offerings.availablePackages && offerings.availablePackages.length > 0 ? (
              offerings.availablePackages.map((pack: any, idx: number) => {
                const isSelected = selectedPlan === pack.identifier;
                const isBestValue = pack.product.identifier.toLowerCase().includes('year');
                return (
                  <View key={pack.identifier} style={[styles.planCard, isSelected && styles.planCardSelected]}>
                    {isBestValue && <View style={styles.bestValueBadge}><Text style={styles.bestValueText}>Best Value</Text></View>}
                    <View style={styles.planCardRow}>
                      <Text style={styles.planTitle}>{pack.product.title.replace(' (BookIQ)', '')}</Text>
                      <Text style={styles.planPrice}>{pack.product.priceString}</Text>
                    </View>
                    <Text style={styles.planDesc}>{pack.product.description}</Text>
                    
                    {/* Individual Purchase Button */}
                    <TouchableOpacity
                      style={[
                        styles.planPurchaseBtn,
                        purchaseLoading === pack.identifier && styles.planPurchaseBtnLoading
                      ]}
                      onPress={() => handlePurchase(pack)}
                      disabled={!!purchaseLoading}
                      activeOpacity={0.8}
                    >
                      {purchaseLoading === pack.identifier ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.planPurchaseBtnText}>Purchase</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })
            ) : (
              <View style={styles.noPlansContainer}>
                <Ionicons name="alert-circle-outline" size={48} color="#9CA3AF" />
                <Text style={styles.noPlansText}>
                  {offerings ? 'No subscription plans available' : 'Loading subscription plans...'}
                </Text>
                <Text style={styles.noPlansSubtext}>
                  {offerings ? 'Please check back later or contact support.' : 'Please wait while we load the available plans.'}
                </Text>
                <TouchableOpacity onPress={() => fetchData()} style={styles.retryButton} activeOpacity={0.7}>
                  <Text style={styles.retryButtonText}>
                    {offerings ? 'Retry' : 'Refresh'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Sticky Purchase Button */}
          <View style={styles.stickyUpgradeWrap}>
            {selectedPlan && offerings ? (
              <TouchableOpacity
                style={styles.upgradeBtn}
                onPress={() => {
                  const pack = offerings.availablePackages.find((p: any) => p.identifier === selectedPlan);
                  if (pack) handlePurchase(pack);
                }}
                disabled={!!purchaseLoading}
                activeOpacity={0.9}
              >
                {purchaseLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.upgradeBtnText}>Purchase Selected Plan</Text>
                    <Text style={styles.upgradeBtnSubtext}>
                      {offerings.availablePackages.find((p: any) => p.identifier === selectedPlan)?.product.priceString}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.noSelectionContainer}>
                <Text style={styles.noSelectionText}>Select a plan to purchase</Text>
              </View>
            )}
            
                      {/* Credit Info */}
          <View style={styles.creditInfoContainer}>
            <Text style={styles.creditInfoText}>
              💡 Purchase multiple times to get more credits!
            </Text>
            <Text style={styles.creditInfoSubtext}>
              Credits expire after their duration period
            </Text>
            <Text style={styles.creditInfoAuth}>
              🔐 Log in to sync credits across devices
            </Text>
          </View>

          {/* Pending Payment Indicator */}
          {pendingPayment && (
            <View style={styles.pendingPaymentContainer}>
              <Ionicons name="time-outline" size={20} color="#F59E0B" />
              <Text style={styles.pendingPaymentText}>
                Payment processing... Checking for updates
              </Text>
            </View>
          )}
          </View>

          {/* Testimonials */}
          <View style={styles.testimonialsSection}>
            <Text style={styles.testimonialsHeader}>What students say</Text>
            {reviews.map((review, idx) => (
              <View key={idx} style={styles.testimonialCard}>
                <Text style={styles.testimonialAvatar}>{review.avatar}</Text>
                <View style={{flex: 1}}>
                  <Text style={styles.testimonialText}>{review.text}</Text>
                  <Text style={styles.testimonialName}>— {review.name}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* FAQ Section */}
          <View style={styles.faqSection}>
            <Text style={styles.faqHeader}>FAQs</Text>
            {faqs.map((faq, idx) => (
              <View key={idx}>
                <TouchableOpacity onPress={() => setFaqOpen(faqOpen === idx ? null : idx)} style={styles.faqQuestionRow}>
                  <Text style={styles.faqQuestion}>{faq.q}</Text>
                  <Ionicons name={faqOpen === idx ? 'chevron-up' : 'chevron-down'} size={20} color="#6C63FF" />
                </TouchableOpacity>
                {faqOpen === idx && <Text style={styles.faqAnswer}>{faq.a}</Text>}
              </View>
            ))}
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
    backgroundColor: '#F7F8FA',
    paddingBottom: 120,
  },
  content: {
    paddingBottom: 40,
    backgroundColor: '#F7F8FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7F8FA',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    color: '#22223B',
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
  headerContainer: {
    alignItems: 'center',
    paddingTop: 36,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginBottom: 8,
    shadowColor: '#6C63FF',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  headerIconWrap: {
    backgroundColor: '#EDEBFE',
    borderRadius: 40,
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    color: '#22223B',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  headerSubtitle: {
    color: '#6C63FF',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 8,
  },
  featuresSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 18,
    padding: 16,
    shadowColor: '#6C63FF',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureTitle: {
    color: '#22223B',
    fontWeight: 'bold',
    fontSize: 15,
  },
  featureSubtitle: {
    color: '#6B7280',
    fontSize: 13,
  },
  quickPurchaseSection: {
    marginHorizontal: 16,
    marginBottom: 18,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#6C63FF',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  quickPurchaseHeader: {
    color: '#22223B',
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 4,
    textAlign: 'center',
  },
  quickPurchaseSubtext: {
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  quickPurchaseBtn: {
    backgroundColor: '#6C63FF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickPurchaseBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  quickPurchaseBtnPrice: {
    color: '#fff',
    fontSize: 14,
    marginTop: 2,
    opacity: 0.9,
  },
  plansSection: {
    marginHorizontal: 16,
    marginBottom: 18,
  },
  plansHeader: {
    color: '#22223B',
    fontWeight: 'bold',
    fontSize: 17,
    marginBottom: 10,
  },
  planCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
    shadowColor: '#6C63FF',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  planCardSelected: {
    borderColor: '#6C63FF',
    shadowColor: '#6C63FF',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    zIndex: 2,
  },
  bestValueBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#6C63FF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    zIndex: 2,
  },
  bestValueText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 11,
  },
  planCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  planTitle: {
    color: '#22223B',
    fontWeight: 'bold',
    fontSize: 16,
  },
  planPrice: {
    color: '#6C63FF',
    fontWeight: 'bold',
    fontSize: 18,
  },
  planDesc: {
    color: '#6B7280',
    fontSize: 13,
    marginTop: 4,
  },
  planPurchaseBtn: {
    backgroundColor: '#6C63FF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planPurchaseBtnLoading: {
    backgroundColor: '#9CA3AF',
  },
  planPurchaseBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  stickyUpgradeWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    padding: 16,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    shadowColor: '#6C63FF',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
    alignItems: 'center',
  },
  upgradeBtn: {
    backgroundColor: '#6C63FF',
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 60,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  upgradeBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  upgradeBtnSubtext: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
    marginTop: 2,
  },
  noSelectionContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 60,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  noSelectionText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '500',
  },
  restoreCreditsBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#6C63FF',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 12,
    alignItems: 'center',
  },
  restoreCreditsBtnText: {
    color: '#6C63FF',
    fontWeight: '600',
    fontSize: 14,
  },
  creditInfoContainer: {
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
  },
  creditInfoText: {
    color: '#6C63FF',
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
  },
  creditInfoSubtext: {
    color: '#6B7280',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  creditInfoAuth: {
    color: '#6C63FF',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 6,
    fontWeight: '500',
  },
  pendingPaymentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 12,
  },
  pendingPaymentText: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
  },
  testimonialsSection: {
    marginHorizontal: 16,
    marginBottom: 18,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#6C63FF',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  testimonialsHeader: {
    color: '#22223B',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 10,
  },
  testimonialCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  testimonialAvatar: {
    fontSize: 28,
    marginRight: 12,
  },
  testimonialText: {
    color: '#22223B',
    fontSize: 14,
    marginBottom: 2,
  },
  testimonialName: {
    color: '#6B7280',
    fontSize: 12,
    fontStyle: 'italic',
  },
  faqSection: {
    marginHorizontal: 16,
    marginBottom: 32,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#6C63FF',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  faqHeader: {
    color: '#22223B',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 10,
  },
  faqQuestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  faqQuestion: {
    color: '#22223B',
    fontWeight: '600',
    fontSize: 14,
    flex: 1,
  },
  faqAnswer: {
    color: '#6B7280',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 8,
    paddingLeft: 2,
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
    backgroundColor: '#6C63FF',
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
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
  },
  noPlansSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 20,
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
  },
  retryButton: {
    backgroundColor: '#6C63FF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  debugRefreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 8,
  },
  debugRefreshText: {
    color: '#6C63FF',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
});

export default PayWallModel;