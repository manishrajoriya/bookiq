import { Ionicons } from '@expo/vector-icons';
import type { Session } from '@supabase/supabase-js';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import AuthModal from '../../components/AuthModal';
import { useThemeColor } from '../../hooks/useThemeColor';
import { useThemeContext } from '../../providers/ThemeProvider';
import {
    getAllFlashCardSets,
    getAllHistory,
    getAllNotes,
    getAllQuizzes,
    getAllScanNotes
} from '../../services/historyStorage';
import subscriptionService from '../../services/subscriptionService';
import { supabase } from '../../utils/supabase';

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
  
  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const iconColor = useThemeColor({}, 'icon');
  const tintColor = useThemeColor({}, 'tint');
  
  // Theme-aware color palette
  const colors = {
    primary: resolvedTheme === 'dark' ? '#0a7ea4' : tintColor, // Use light tint color for dark mode
    success: resolvedTheme === 'dark' ? '#10b981' : '#059669',
    warning: resolvedTheme === 'dark' ? '#f59e0b' : '#d97706',
    danger: resolvedTheme === 'dark' ? '#ef4444' : '#dc2626',
    accent: resolvedTheme === 'dark' ? '#06b6d4' : '#0891b2',
    secondary: resolvedTheme === 'dark' ? '#8b5cf6' : '#7c3aed',
    
    surface: resolvedTheme === 'dark' ? '#1e293b' : '#f8fafc',
    card: resolvedTheme === 'dark' ? '#1e293b' : '#ffffff',
    cardSecondary: resolvedTheme === 'dark' ? '#334155' : '#f8fafc',
    
    border: iconColor,
    overlay: 'rgba(0, 0, 0, 0.5)',
    
    // Better icon colors for dark mode
    iconPrimary: resolvedTheme === 'dark' ? '#ffffff' : iconColor,
    iconSecondary: resolvedTheme === 'dark' ? '#94a3b8' : iconColor,
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

  // Quick actions data
  const quickActions = [
    { id: 'study', icon: 'book-outline', title: 'Study Plans', route: '/study-notes' },
    { id: 'quiz', icon: 'help-circle-outline', title: 'Quiz Me', route: '/quiz-maker' },
    { id: 'flashcards', icon: 'card-outline', title: 'Flashcards', route: '/flash-cards' },
    { id: 'notes', icon: 'document-text-outline', title: 'History', route: '/HistoryList' },
    { id: 'progress', icon: 'trending-up-outline', title: 'Progress', route: '/explore' },
    { id: 'achievements', icon: 'trophy-outline', title: 'Achievements', route: '/explore' },
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
      // Check if user is authenticated
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (!currentSession) {
        // User is not authenticated, show auth modal
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
      
      // User is authenticated, proceed to credits page
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
      // Load credits from online storage only
      const creditData = await subscriptionService.getCurrentCredits();
      setCredits(creditData.total);

      // Load all data to calculate stats
      const [history, notes, scanNotes, quizzes, flashCards] = await Promise.all([
        getAllHistory(),
        getAllNotes(),
        getAllScanNotes(),
        getAllQuizzes(),
        getAllFlashCardSets()
      ]);

      // Calculate days active (simplified - count unique days with activity)
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
    // Reload user data after successful authentication
    loadUserData();
  };

  const handleAccountSettingsPress = () => {
    console.log('Account Settings button pressed');
    console.log('Current showAuthModal state:', showAuthModal);
    console.log('Current session:', session);
    setShowAuthModal(true);
    console.log('Set showAuthModal to true');
  };

  const ProfileHeader = () => (
    <View style={[styles.profileHeader, { backgroundColor }]}>
      <View style={styles.headerBackground}>
        <View style={styles.headerContent}>
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <View style={[styles.avatarContainer, { backgroundColor: colors.primary }]}>
              <Text style={[styles.avatarText, { color: '#ffffff' }]}>
                {session?.user?.email?.charAt(0).toUpperCase() || 'U'}
              </Text>
              <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
            </View>
          </View>

          {/* User Info */}
          <View style={styles.userInfo}>
            <Text style={[styles.greeting, { color: textColor }]}>
              {session ? 'Welcome back!' : 'Welcome to BookIQ!'}
            </Text>
            <Text style={[styles.userEmail, { color: colors.iconSecondary }]}>
              {session?.user?.email || 'user@bookiq.app'}
            </Text>
            
            {/* Credits Display */}
            <View style={styles.creditsRow}>
              <View style={[styles.creditsContainer, { backgroundColor: colors.cardSecondary }]}>
                <Text style={styles.creditsIcon}>💎</Text>
                <Text style={[styles.creditsText, { color: textColor }]}>
                  {credits.toLocaleString()} credits
                </Text>
              </View>
              <TouchableOpacity 
                style={[styles.refreshButton, { backgroundColor: colors.primary }]}
                onPress={loadUserData}
                disabled={loading}
              >
                <Ionicons 
                  name={loading ? "refresh" : "refresh-outline"} 
                  size={16} 
                  color="#ffffff" 
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Header Actions */}
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={[styles.iconButton, { backgroundColor: colors.cardSecondary }]}
              onPress={toggleTheme}
            >
              <Ionicons 
                name={resolvedTheme === 'dark' ? "sunny-outline" : "moon-outline"} 
                size={20} 
                color={colors.iconPrimary} 
              />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.iconButton, { backgroundColor: colors.cardSecondary }]}
              onPress={handleGetCredits}
            >
              <Ionicons name="settings-outline" size={20} color={colors.iconPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={handleAccountSettingsPress}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>
              {session ? 'Account Settings' : 'Sign In'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.secondaryButton, { 
              backgroundColor: colors.surface,
              borderColor: colors.border
            }]}
            onPress={handleGetCredits}
            activeOpacity={0.8}
          >
            <Text style={[styles.buttonTextSecondary, { color: textColor }]}>Get Credits</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const StatsSection = () => (
    <View style={[styles.statsCard, { 
      backgroundColor: colors.card,
      borderColor: colors.border
    }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>Your Progress</Text>
        <Ionicons name="trending-up-outline" size={24} color={colors.primary} />
      </View>
      
      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: colors.primary }]}>{stats.problemsSolved}</Text>
          <Text style={[styles.statLabel, { color: colors.iconSecondary }]}>Problems Solved</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: colors.success }]}>{stats.daysActive}</Text>
          <Text style={[styles.statLabel, { color: colors.iconSecondary }]}>Days Active</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: colors.accent }]}>{stats.notesCreated}</Text>
          <Text style={[styles.statLabel, { color: colors.iconSecondary }]}>Notes Created</Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: colors.secondary }]}>{stats.totalScans}</Text>
          <Text style={[styles.statLabel, { color: colors.iconSecondary }]}>Total Scans</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: colors.warning }]}>{stats.quizzesCreated}</Text>
          <Text style={[styles.statLabel, { color: colors.iconSecondary }]}>Quizzes</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: colors.danger }]}>{stats.flashCardsCreated}</Text>
          <Text style={[styles.statLabel, { color: colors.iconSecondary }]}>Flash Cards</Text>
        </View>
      </View>
    </View>
  );

  const QuickActionsSection = () => (
    <View style={[styles.quickActionsCard, { 
      backgroundColor: colors.card,
      borderColor: colors.border
    }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>Quick Actions</Text>
        <Ionicons name="flash-outline" size={24} color={colors.primary} />
      </View>
      
      <View style={styles.quickActionsGrid}>
        {quickActions.map((action) => (
          <TouchableOpacity
            key={action.id}
            style={[styles.quickActionItem, { 
              backgroundColor: colors.cardSecondary
            }]}
            onPress={() => handleQuickAction(action)}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: colors.primary }]}>
              <Ionicons name={action.icon as any} size={24} color="#ffffff" />
            </View>
            <Text style={[styles.quickActionText, { color: textColor }]}>
              {action.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const AchievementsSection = () => (
    <View style={[styles.achievementsCard, { 
      backgroundColor: colors.card,
      borderColor: colors.border
    }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>Recent Achievements</Text>
        <Ionicons name="trophy-outline" size={24} color={colors.primary} />
      </View>
      
      <View style={styles.achievementsList}>
        {achievements.slice(0, 3).map((achievement) => (
          <View key={achievement.id} style={[styles.achievementItem, { 
            backgroundColor: colors.cardSecondary
          }]}>
            <View style={[styles.achievementIcon, { 
              backgroundColor: achievement.earned ? colors.success : colors.border,
              opacity: achievement.earned ? 1 : 0.5
            }]}>
              <Ionicons 
                name={achievement.icon as any} 
                size={20} 
                color="#ffffff" 
              />
            </View>
            <View style={styles.achievementContent}>
              <Text style={[styles.achievementTitle, { color: textColor }]}>
                {achievement.title}
              </Text>
              <Text style={[styles.achievementDescription, { color: colors.iconSecondary }]}>
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
    <View style={[styles.streakCard, { 
      backgroundColor: colors.card,
      borderColor: colors.border
    }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>Study Streak</Text>
        <Ionicons name="flame-outline" size={24} color={colors.warning} />
      </View>
      
      <View style={styles.streakContent}>
        <View style={styles.streakNumber}>
          <Text style={[styles.streakDays, { color: colors.warning }]}>{stats.daysActive}</Text>
          <Text style={[styles.streakLabel, { color: colors.iconSecondary }]}>days</Text>
        </View>
        <View style={styles.streakProgress}>
          <View style={[styles.progressBar, { 
            backgroundColor: colors.cardSecondary
          }]}>
            <View style={[styles.progressFill, { 
              backgroundColor: colors.warning,
              width: `${Math.min((stats.daysActive / 7) * 100, 100)}%`
            }]} />
          </View>
          <Text style={[styles.progressText, { color: colors.iconSecondary }]}>
            {stats.daysActive >= 7 ? 'Great job! Keep it up!' : `${7 - stats.daysActive} more days to reach your goal!`}
          </Text>
        </View>
      </View>
    </View>
  );



  return (
    <View style={[styles.container, { backgroundColor }]}>
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
        onClose={() => {
          console.log('AuthModal closing');
          setShowAuthModal(false);
        }}
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
    paddingBottom: 32,
  },
  
  // Profile Header
  profileHeader: {
    paddingTop: 60,
    paddingBottom: 24,
  },
  headerBackground: {
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  avatarSection: {
    marginRight: 16,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  statusDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    position: 'absolute',
    bottom: -2,
    right: -2,
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  userInfo: {
    flex: 1,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    marginBottom: 16,
  },
  creditsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  creditsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    flex: 1,
  },
  creditsIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  creditsText: {
    fontSize: 16,
    fontWeight: '600',
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  buttonTextSecondary: {
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Cards
  statsCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  quickActionsCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  achievementsCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  streakCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  
  // Stats
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  
  // Quick Actions
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  quickActionItem: {
    width: '48%',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  
  // Achievements
  achievementsList: {
    gap: 12,
  },
  achievementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
  },
  achievementIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  achievementContent: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  achievementDescription: {
    fontSize: 14,
  },
  earnedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Study Streak
  streakContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  streakNumber: {
    alignItems: 'center',
  },
  streakDays: {
    fontSize: 36,
    fontWeight: '800',
  },
  streakLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  streakProgress: {
    flex: 1,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
  },
});

export default Profile;