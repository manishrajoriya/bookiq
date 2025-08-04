import { Ionicons } from '@expo/vector-icons';
import type { Session } from '@supabase/supabase-js';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AuthModal from '../components/AuthModal';
import { useThemeContext } from '../providers/ThemeProvider';
import {
  getAllFlashCardSets,
  getAllHistory,
  getAllNotes,
  getAllQuizzes,
  getAllScanNotes
} from '../services/historyStorage';
import subscriptionService from '../services/subscriptionService';
import { supabase } from '../utils/supabase';

const { width } = Dimensions.get('window');

interface UserStats {
  problemsSolved: number;
  daysActive: number;
  notesCreated: number;
  totalScans: number;
  quizzesCreated: number;
  flashCardsCreated: number;
}

interface Achievement {
  id: number;
  title: string;
  description: string;
  earned: boolean;
  icon: string;
}

const Profile = () => {
  const router = useRouter();
  const { resolvedTheme, toggleTheme } = useThemeContext();
  
  // Enhanced dark mode color palette
  const colors = {
    // Background colors
    background: '#0a0a0b',
    surface: '#111113',
    card: '#16161a',
    cardSecondary: '#1c1c23',
    cardTertiary: '#252530',
    
    // Text colors
    textPrimary: '#ffffff',
    textSecondary: '#a1a1aa',
    textTertiary: '#71717a',
    
    // Brand colors
    primary: '#3b82f6',
    primaryDark: '#2563eb',
    secondary: '#8b5cf6',
    accent: '#06b6d4',
    
    // Status colors
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    
    // Borders and dividers
    border: '#27272a',
    borderLight: '#3f3f46',
    
    // Gradients
    gradientStart: '#1e1b4b',
    gradientEnd: '#312e81',
    
    // Glass effect
    glass: 'rgba(255, 255, 255, 0.05)',
    glassStrong: 'rgba(255, 255, 255, 0.1)',
  };
  
  // State
  const [credits, setCredits] = useState(0);
  const [stats, setStats] = useState<UserStats>({
    problemsSolved: 0,
    daysActive: 0,
    notesCreated: 0,
    totalScans: 0,
    quizzesCreated: 0,
    flashCardsCreated: 0
  });
  const [loading, setLoading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  // Quick actions data with updated styling
  const quickActions = [
    { id: 'study', icon: 'book-outline', title: 'Study Plans', route: '/study-notes', color: colors.primary },
    { id: 'quiz', icon: 'help-circle-outline', title: 'Quiz Me', route: '/quiz-maker', color: colors.secondary },
    { id: 'flashcards', icon: 'card-outline', title: 'Flashcards', route: '/flash-cards', color: colors.accent },
    { id: 'notes', icon: 'document-text-outline', title: 'History', route: '/HistoryList', color: colors.success },
    { id: 'progress', icon: 'trending-up-outline', title: 'Progress', route: '/explore', color: colors.warning },
    { id: 'achievements', icon: 'trophy-outline', title: 'Achievements', route: '/explore', color: colors.danger },
  ];

  const achievements: Achievement[] = [
    { id: 1, title: 'First Quiz', description: 'Complete your first quiz', earned: stats.quizzesCreated > 0, icon: 'help-circle' },
    { id: 2, title: 'Study Streak', description: '7 days of consistent study', earned: stats.daysActive >= 7, icon: 'flame' },
    { id: 3, title: 'Note Master', description: 'Create 50 notes', earned: stats.notesCreated >= 50, icon: 'document-text' },
    { id: 4, title: 'Quiz Champion', description: 'Score 90%+ on 10 quizzes', earned: false, icon: 'trophy' },
    { id: 5, title: 'Scanner Pro', description: 'Scan 100 images', earned: stats.totalScans >= 100, icon: 'scan' },
    { id: 6, title: 'Flashcard Fanatic', description: 'Create 25 flashcard sets', earned: stats.flashCardsCreated >= 25, icon: 'card' },
  ];

  useEffect(() => {
    loadUserData();
    checkAuthStatus();
  }, []);

  useEffect(() => {
    console.log('showAuthModal state changed to:', showAuthModal);
  }, [showAuthModal]);

  const checkAuthStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
    } catch (error) {
      console.error('Error checking auth status:', error);
    }
  };

  const handleGetCredits = async () => {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (!currentSession) {
        Alert.alert(
          'Authentication Required',
          'Please sign in to access credits and make purchases.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign In', onPress: () => setShowAuthModal(true) }
          ]
        );
        return;
      }
      
      router.push('/paywall');
    } catch (error) {
      console.error('Error checking authentication:', error);
      Alert.alert(
        'Error',
        'Unable to verify authentication status. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const loadUserData = async () => {
    setLoading(true);
    try {
      const creditData = await subscriptionService.getCurrentCredits();
      setCredits(creditData.total);

      const [history, notes, scanNotes, quizzes, flashCards] = await Promise.all([
        getAllHistory(),
        getAllNotes(),
        getAllScanNotes(),
        getAllQuizzes(),
        getAllFlashCardSets()
      ]);

      const allDates = [
        ...history.map(h => new Date(h.createdAt).toDateString()),
        ...notes.map(n => new Date(n.createdAt).toDateString()),
        ...scanNotes.map(sn => new Date(sn.createdAt).toDateString()),
        ...quizzes.map(q => new Date(q.createdAt).toDateString()),
        ...flashCards.map(fc => new Date(fc.createdAt).toDateString())
      ];
      const uniqueDays = new Set(allDates).size;

      setStats({
        problemsSolved: history.filter(h => h.feature === 'ai-scan').length,
        daysActive: uniqueDays,
        notesCreated: notes.length + scanNotes.length,
        totalScans: history.filter(h => h.feature === 'ai-scan').length,
        quizzesCreated: quizzes.length,
        flashCardsCreated: flashCards.length
      });
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = (action: typeof quickActions[0]) => {
    if (action.route) {
      router.push(action.route as any);
    } else {
      Alert.alert(action.title, `${action.title} feature coming soon!`);
    }
  };

  const handleAuthSuccess = (newSession: Session) => {
    setSession(newSession);
    setShowAuthModal(false);
    loadUserData();
  };

  const handleAccountSettingsPress = () => {
    console.log('Account Settings button pressed');
    setShowAuthModal(true);
  };

  const ProfileHeader = () => (
    <View style={[styles.profileHeader, { backgroundColor: colors.background }]}>
      {/* Gradient Background */}
      <View style={styles.gradientBackground}>
        <View style={[styles.gradientOverlay, { 
          backgroundColor: `linear-gradient(135deg, ${colors.gradientStart} 0%, ${colors.gradientEnd} 100%)`
        }]} />
      </View>
      
      <View style={styles.headerContent}>
        {/* Top Row - Avatar and Actions */}
        <View style={styles.headerTop}>
          <View style={styles.avatarSection}>
            <View style={[styles.avatarContainer, { 
              backgroundColor: colors.primary,
              shadowColor: colors.primary,
            }]}>
              <Text style={styles.avatarText}>
                {session?.user?.email?.charAt(0).toUpperCase() || 'U'}
              </Text>
              <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={[styles.iconButton, { backgroundColor: colors.glass }]}
              onPress={toggleTheme}
            >
              <Ionicons 
                name="sunny-outline"
                size={20} 
                color={colors.textPrimary} 
              />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.iconButton, { backgroundColor: colors.glass }]}
              onPress={handleGetCredits}
            >
              <Ionicons name="notifications-outline" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* User Info */}
        <View style={styles.userInfoSection}>
          <Text style={[styles.greeting, { color: colors.textPrimary }]}>
            {session ? 'Welcome back!' : 'Welcome to BookIQ!'}
          </Text>
          <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
            {session?.user?.email || 'user@bookiq.app'}
          </Text>
          
          {/* Credits Card */}
          <View style={[styles.creditsCard, { backgroundColor: colors.glass }]}>
            <View style={styles.creditsContent}>
              <View style={styles.creditsLeft}>
                <Text style={styles.creditsEmoji}>💎</Text>
                <View>
                  <Text style={[styles.creditsAmount, { color: colors.textPrimary }]}>
                    {credits.toLocaleString()}
                  </Text>
                  <Text style={[styles.creditsLabel, { color: colors.textSecondary }]}>
                    Credits Available
                  </Text>
                </View>
              </View>
              <TouchableOpacity 
                style={[styles.refreshButton, { backgroundColor: colors.primary }]}
                onPress={loadUserData}
                disabled={loading}
              >
                <Ionicons 
                  name={loading ? "refresh" : "add-outline"} 
                  size={18} 
                  color="#ffffff" 
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={handleAccountSettingsPress}
          >
            <Text style={styles.buttonText}>
              {session ? 'Account Settings' : 'Sign In'}
            </Text>
            <Ionicons name="arrow-forward" size={16} color="#ffffff" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.secondaryButton, { 
              backgroundColor: colors.glass,
              borderColor: colors.border
            }]}
            onPress={handleGetCredits}
          >
            <Text style={[styles.buttonTextSecondary, { color: colors.textPrimary }]}>
              Get Credits
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const StatsSection = () => (
    <View style={[styles.statsCard, { backgroundColor: colors.card }]}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Your Progress
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            Keep up the great work!
          </Text>
        </View>
        <View style={[styles.iconContainer, { backgroundColor: colors.primary }]}>
          <Ionicons name="trending-up-outline" size={20} color="#ffffff" />
        </View>
      </View>
      
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: colors.cardSecondary }]}>
          <View style={[styles.statIcon, { backgroundColor: colors.primary }]}>
            <Ionicons name="checkmark-done-outline" size={16} color="#ffffff" />
          </View>
          <Text style={[styles.statNumber, { color: colors.textPrimary }]}>
            {stats.problemsSolved}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Problems Solved
          </Text>
        </View>
        
        <View style={[styles.statCard, { backgroundColor: colors.cardSecondary }]}>
          <View style={[styles.statIcon, { backgroundColor: colors.success }]}>
            <Ionicons name="calendar-outline" size={16} color="#ffffff" />
          </View>
          <Text style={[styles.statNumber, { color: colors.textPrimary }]}>
            {stats.daysActive}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Days Active
          </Text>
        </View>
        
        <View style={[styles.statCard, { backgroundColor: colors.cardSecondary }]}>
          <View style={[styles.statIcon, { backgroundColor: colors.accent }]}>
            <Ionicons name="document-text-outline" size={16} color="#ffffff" />
          </View>
          <Text style={[styles.statNumber, { color: colors.textPrimary }]}>
            {stats.notesCreated}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Notes Created
          </Text>
        </View>
      </View>

      <View style={styles.additionalStats}>
        <View style={styles.additionalStatItem}>
          <Text style={[styles.additionalStatNumber, { color: colors.secondary }]}>
            {stats.totalScans}
          </Text>
          <Text style={[styles.additionalStatLabel, { color: colors.textTertiary }]}>
            Total Scans
          </Text>
        </View>
        <View style={styles.additionalStatItem}>
          <Text style={[styles.additionalStatNumber, { color: colors.warning }]}>
            {stats.quizzesCreated}
          </Text>
          <Text style={[styles.additionalStatLabel, { color: colors.textTertiary }]}>
            Quizzes
          </Text>
        </View>
        <View style={styles.additionalStatItem}>
          <Text style={[styles.additionalStatNumber, { color: colors.danger }]}>
            {stats.flashCardsCreated}
          </Text>
          <Text style={[styles.additionalStatLabel, { color: colors.textTertiary }]}>
            Flash Cards
          </Text>
        </View>
      </View>
    </View>
  );

  const QuickActionsSection = () => (
    <View style={[styles.quickActionsCard, { backgroundColor: colors.card }]}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Quick Actions
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            Jump into your studies
          </Text>
        </View>
        <View style={[styles.iconContainer, { backgroundColor: colors.warning }]}>
          <Ionicons name="flash-outline" size={20} color="#ffffff" />
        </View>
      </View>
      
      <View style={styles.quickActionsGrid}>
        {quickActions.map((action) => (
          <TouchableOpacity
            key={action.id}
            style={[styles.quickActionItem, { backgroundColor: colors.cardSecondary }]}
            onPress={() => handleQuickAction(action)}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: action.color }]}>
              <Ionicons name={action.icon as any} size={22} color="#ffffff" />
            </View>
            <Text style={[styles.quickActionText, { color: colors.textPrimary }]}>
              {action.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const AchievementsSection = () => (
    <View style={[styles.achievementsCard, { backgroundColor: colors.card }]}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Recent Achievements
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            Your milestones
          </Text>
        </View>
        <View style={[styles.iconContainer, { backgroundColor: colors.warning }]}>
          <Ionicons name="trophy-outline" size={20} color="#ffffff" />
        </View>
      </View>
      
      <View style={styles.achievementsList}>
        {achievements.slice(0, 3).map((achievement) => (
          <View key={achievement.id} style={[styles.achievementItem, { 
            backgroundColor: colors.cardSecondary,
            borderLeftColor: achievement.earned ? colors.success : colors.border,
          }]}>
            <View style={[styles.achievementIcon, { 
              backgroundColor: achievement.earned ? colors.success : colors.cardTertiary,
            }]}>
              <Ionicons 
                name={achievement.icon as any} 
                size={18} 
                color={achievement.earned ? "#ffffff" : colors.textTertiary} 
              />
            </View>
            <View style={styles.achievementContent}>
              <Text style={[styles.achievementTitle, { 
                color: achievement.earned ? colors.textPrimary : colors.textSecondary 
              }]}>
                {achievement.title}
              </Text>
              <Text style={[styles.achievementDescription, { color: colors.textTertiary }]}>
                {achievement.description}
              </Text>
            </View>
            {achievement.earned && (
              <View style={[styles.earnedBadge, { backgroundColor: colors.success }]}>
                <Ionicons name="checkmark" size={12} color="#ffffff" />
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  );

  const StudyStreakSection = () => (
    <View style={[styles.streakCard, { backgroundColor: colors.card }]}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Study Streak
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            Keep the momentum going!
          </Text>
        </View>
        <View style={[styles.iconContainer, { backgroundColor: colors.warning }]}>
          <Ionicons name="flame-outline" size={20} color="#ffffff" />
        </View>
      </View>
      
      <View style={styles.streakContent}>
        <View style={[styles.streakNumberCard, { backgroundColor: colors.cardSecondary }]}>
          <Text style={[styles.streakDays, { color: colors.warning }]}>
            {stats.daysActive}
          </Text>
          <Text style={[styles.streakLabel, { color: colors.textSecondary }]}>
            days
          </Text>
        </View>
        
        <View style={styles.streakProgress}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressTitle, { color: colors.textPrimary }]}>
              Weekly Goal
            </Text>
            <Text style={[styles.progressPercentage, { color: colors.textSecondary }]}>
              {Math.min((stats.daysActive / 7) * 100, 100).toFixed(0)}%
            </Text>
          </View>
          <View style={[styles.progressBar, { backgroundColor: colors.cardTertiary }]}>
            <View style={[styles.progressFill, { 
              backgroundColor: colors.warning,
              width: `${Math.min((stats.daysActive / 7) * 100, 100)}%`
            }]} />
          </View>
          <Text style={[styles.progressText, { color: colors.textTertiary }]}>
            {stats.daysActive >= 7 
              ? 'Excellent! You\'ve reached your weekly goal!' 
              : `${7 - stats.daysActive} more days to complete your goal`
            }
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <ProfileHeader />
        <StatsSection />
        <QuickActionsSection />
        <AchievementsSection />
        <StudyStreakSection />
      </ScrollView>
      
      <AuthModal 
        visible={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  
  // Profile Header
  profileHeader: {
    paddingTop: 60,
    paddingBottom: 32,
    position: 'relative',
  },
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gradientOverlay: {
    flex: 1,
    opacity: 0.1,
  },
  headerContent: {
    paddingHorizontal: 24,
    position: 'relative',
    zIndex: 1,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  avatarSection: {
    alignItems: 'flex-start',
  },
  avatarContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
  },
  statusDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: 3,
    borderColor: '#0a0a0b',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(10px)',
  },
  userInfoSection: {
    marginBottom: 32,
  },
  greeting: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  userEmail: {
    fontSize: 16,
    marginBottom: 24,
    opacity: 0.8,
  },
  creditsCard: {
    borderRadius: 20,
    padding: 20,
    backdropFilter: 'blur(20px)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  creditsContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  creditsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  creditsEmoji: {
    fontSize: 24,
  },
  creditsAmount: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 2,
  },
  creditsLabel: {
    fontSize: 14,
    opacity: 0.7,
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 8,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backdropFilter: 'blur(10px)',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  buttonTextSecondary: {
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Cards
  statsCard: {
    marginHorizontal: 24,
    marginBottom: 24,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  quickActionsCard: {
    marginHorizontal: 24,
    marginBottom: 24,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  achievementsCard: {
    marginHorizontal: 24,
    marginBottom: 24,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  streakCard: {
    marginHorizontal: 24,
    marginBottom: 24,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Stats
  statsGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    padding: 20,
    borderRadius: 18,
    alignItems: 'center',
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
    opacity: 0.8,
  },
  additionalStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  additionalStatItem: {
    alignItems: 'center',
  },
  additionalStatNumber: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  additionalStatLabel: {
    fontSize: 11,
    fontWeight: '500',
    opacity: 0.6,
  },
  
  // Quick Actions
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  quickActionItem: {
    width: '47%',
    alignItems: 'center',
    padding: 20,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  quickActionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  
  // Achievements
  achievementsList: {
    gap: 16,
  },
  achievementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 18,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  achievementIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  achievementContent: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  achievementDescription: {
    fontSize: 14,
    opacity: 0.8,
  },
  earnedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  
  // Study Streak
  streakContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  streakNumberCard: {
    alignItems: 'center',
    padding: 20,
    borderRadius: 18,
    minWidth: 100,
  },
  streakDays: {
    fontSize: 40,
    fontWeight: '900',
    marginBottom: 4,
  },
  streakLabel: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.8,
  },
  streakProgress: {
    flex: 1,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: '700',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 2,
  },
  progressText: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.8,
  },
}
);

export default Profile;
