import { usePurchases } from '@/providers/PurchasesProvider';
import { useThemeContext } from '@/providers/ThemeProvider';
import {
    addCredits,
    getAllHistory,
    getAllNotes,
    getCredits
} from "@/services/historyStorage";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    Alert,
    FlatList,
    Image,
    ListRenderItemInfo,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import AuthScreen from '../../components/AuthScreen';
import { useAuth } from '../../providers/AuthProvider';

// Dynamic color scheme based on theme
const getColors = (isDark: boolean) => ({
    primary: '#667eea',
    secondary: '#4338ca',
    accentColor: '#feca57',
    dangerColor: '#ff6b6b',
    backgroundColor: isDark ? '#0f0f0f' : '#f8f9fa',
    cardColor: isDark ? '#1a1a1a' : '#ffffff',
    headerBackground: isDark ? '#1a1a1a' : '#f7f8fa',
    borderColor: isDark ? '#333333' : '#f0f0f0',
    iconColor: isDark ? '#9BA1A6' : '#888',
    textColor: {
        primary: isDark ? '#ffffff' : '#1a1a1a',
        secondary: isDark ? '#cccccc' : '#666',
        light: isDark ? '#999999' : '#aaa',
        white: '#ffffff',
    },
});

// Constants
const FILTER_OPTIONS = [
    "All",
    "ai-scan",
    "notes",
    "notes-updated",
    "calculator",
    "quiz-maker",
    "study-notes",
];

const FEATURE_COLORS: Record<string, string> = {
    'ai-scan': '#667eea',
    'calculator': '#764ba2',
    'quiz-maker': '#f093fb',
    'study-notes': '#4facfe',
    'flash-cards': '#43e97b',
    'homework': '#fa709a',
    'magic-eraser': '#ff6b6b',
    'voice-notes': '#4ecdc4',
    'pdf-scanner': '#45b7d1',
    'mind-maps': '#96ceb4',
    'notes': '#feca57',
    'notes-updated': '#fca5a5',
    'timer': '#feca57',
    'translator': '#ff9ff3',
    'default': '#888'
};

// Types
interface HistoryItem {
    id: number;
    imageUri: string | null;
    feature: string;
    extractedText: string;
    aiAnswer: string;
    createdAt: string;
}

interface Stats {
    problemsSolved: number;
    daysActive: number;
    notesCreated: number;
}

interface ProfileHeaderProps {
    loading: boolean;
    credits: number;
    onRefresh: () => void;
    onClearHistory: () => void;
    onGetFreeCredits: () => void;
    onGoPro: () => void;
    onToggleTheme: () => void;
    isDark: boolean;
}

interface StatsCardProps {
    stats: Stats;
    loading: boolean;
    colors: ReturnType<typeof getColors>;
}

interface FilterSectionProps {
    activeFilter: string;
    onFilterChange: (filter: string) => void;
    colors: ReturnType<typeof getColors>;
}

// Helper Functions
const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) { // 7 days
        return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const formatFeatureName = (feature: string): string => {
    return feature.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase());
};

// Components
const ProfileHeader: React.FC<ProfileHeaderProps> = ({
    loading,
    credits,
    onRefresh,
    onClearHistory,
    onGetFreeCredits,
    onGoPro,
    onToggleTheme,
    isDark,
}) => {
    const colors = getColors(isDark);
    
    return (
        <View style={[styles.profileHeader, { backgroundColor: colors.headerBackground }]}>
            <View style={styles.headerContent}>
                <View style={styles.userSection}>
                    <View style={styles.avatar}>
                        <Ionicons name="person-circle" size={64} color={colors.accentColor} />
                    </View>
                    <View style={styles.userInfo}>
                        <Text style={[styles.welcomeText, { color: colors.textColor.primary }]}>Welcome Back!</Text>
                        <Text style={[styles.subtitleText, { color: colors.textColor.secondary }]}>Your AI Study Journey</Text>
                        
                        <View style={styles.creditsContainer}>
                            <View style={styles.creditsInfo}>
                                <Ionicons name="diamond" size={18} color={colors.accentColor} />
                                <Text style={[styles.creditsLabel, { color: colors.textColor.secondary }]}>Credits: </Text>
                                <Text style={[styles.creditsValue, { color: colors.accentColor }]}>
                                    {loading ? '...' : credits.toLocaleString()}
                                </Text>
                            </View>
                            <TouchableOpacity 
                                onPress={onRefresh} 
                                style={[styles.refreshButton, { backgroundColor: 'rgba(102, 126, 234, 0.1)' }]}
                                disabled={loading}
                            >
                                <Ionicons 
                                    name="refresh" 
                                    size={16} 
                                    color={loading ? colors.textColor.light : colors.accentColor} 
                                />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
                
                <View style={styles.headerActions}>
                    <TouchableOpacity 
                        style={[styles.themeButton, { backgroundColor: 'rgba(102, 126, 234, 0.1)' }]} 
                        onPress={onToggleTheme}
                    >
                        <Ionicons 
                            name={isDark ? "sunny-outline" : "moon-outline"} 
                            size={20} 
                            color={colors.accentColor} 
                        />
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                        style={[styles.clearButton, { backgroundColor: 'rgba(255, 107, 107, 0.1)' }]} 
                        onPress={onClearHistory}
                    >
                        <Ionicons name="trash-outline" size={20} color={colors.dangerColor} />
                    </TouchableOpacity>
                </View>
            </View>
            
            <View style={styles.buttonGroup}>
                <TouchableOpacity
                    style={[styles.proButton, { backgroundColor: colors.accentColor }]}
                    onPress={onGoPro}
                >
                    <Ionicons name="rocket" size={20} color={colors.textColor.white} />
                    <Text style={[styles.creditsButtonText, { color: colors.textColor.white }]}>Go PRO</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const StatsCard: React.FC<StatsCardProps> = ({ stats, loading, colors }) => (
    <View style={[styles.statsCard, { backgroundColor: colors.cardColor, borderColor: colors.borderColor }]}>
        <Text style={[styles.sectionTitle, { color: colors.textColor.primary }]}>Your Progress</Text>
        <View style={styles.statsGrid}>
            <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: colors.accentColor }]}>
                    {loading ? '...' : stats.problemsSolved}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textColor.secondary }]}>Problems Solved</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.borderColor }]} />
            <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: colors.accentColor }]}>
                    {loading ? '...' : stats.daysActive}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textColor.secondary }]}>Days Active</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.borderColor }]} />
            <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: colors.accentColor }]}>
                    {loading ? '...' : stats.notesCreated}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textColor.secondary }]}>Notes Created</Text>
            </View>
        </View>
    </View>
);

const FilterSection: React.FC<FilterSectionProps> = ({ activeFilter, onFilterChange, colors }) => (
    <View style={[styles.filterSection, { backgroundColor: colors.headerBackground }]}>
        <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScrollContent}
        >
            {FILTER_OPTIONS.map((filter) => (
                <TouchableOpacity
                    key={filter}
                    style={[
                        styles.filterChip,
                        { backgroundColor: 'rgba(102, 126, 234, 0.1)', borderColor: 'rgba(102, 126, 234, 0.2)' },
                        activeFilter === filter && { backgroundColor: colors.accentColor, borderColor: colors.accentColor },
                    ]}
                    onPress={() => onFilterChange(filter)}
                    activeOpacity={0.7}
                >
                    <Text
                        style={[
                            styles.filterChipText,
                            { color: colors.textColor.secondary },
                            activeFilter === filter && { color: colors.textColor.white },
                        ]}
                    >
                        {formatFeatureName(filter)}
                    </Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
    </View>
);

const HistoryCard: React.FC<{
    item: HistoryItem;
    isExpanded: boolean;
    onToggleExpand: () => void;
    colors: ReturnType<typeof getColors>;
}> = ({ item, isExpanded, onToggleExpand, colors }) => {
    const isNote = item.feature === "notes" || item.feature === "notes-updated";
    
    return (
        <TouchableOpacity
            style={[styles.historyCard, { backgroundColor: colors.cardColor, borderColor: colors.borderColor }]}
            onPress={onToggleExpand}
            activeOpacity={0.95}
        >
            <View style={styles.cardHeader}>
                {item.imageUri ? (
                    <Image source={{ uri: item.imageUri }} style={styles.cardImage} />
                ) : (
                    <View style={[styles.imagePlaceholder, { backgroundColor: colors.backgroundColor, borderColor: colors.borderColor }]}>
                        <Ionicons
                            name={isNote ? "document-text" : "image"}
                            size={24}
                            color={colors.textColor.light}
                        />
                    </View>
                )}
                
                <View style={styles.cardContent}>
                    <View style={styles.cardMeta}>
                        <View
                            style={[
                                styles.featureBadge,
                                {
                                    backgroundColor: FEATURE_COLORS[item.feature] || FEATURE_COLORS.default,
                                },
                            ]}
                        >
                            <Text style={styles.featureBadgeText}>
                                {formatFeatureName(item.feature)}
                            </Text>
                        </View>
                        <Text style={[styles.timestamp, { color: colors.textColor.light }]}>{formatDate(item.createdAt)}</Text>
                    </View>
                    
                    <Text
                        numberOfLines={isExpanded ? undefined : 2}
                        style={[styles.cardText, { color: colors.textColor.primary }, isNote && styles.noteTitle]}
                    >
                        {isNote ? item.extractedText : item.aiAnswer}
                    </Text>
                </View>
                
                <Ionicons
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={colors.textColor.light}
                    style={styles.expandIcon}
                />
            </View>
            
            {isExpanded && (
                <View style={[styles.expandedContent, { borderTopColor: colors.borderColor }]}>
                    <View style={[styles.expandedSection, { backgroundColor: colors.backgroundColor }]}>
                        <Text style={[styles.expandedLabel, { color: colors.accentColor }]}>
                            {isNote ? "Note Content:" : "Extracted Text:"}
                        </Text>
                        <ScrollView 
                            style={styles.expandedScrollView}
                            showsVerticalScrollIndicator={false}
                        >
                            <Text style={[styles.expandedText, { color: colors.textColor.secondary }]}>
                                {isNote ? item.aiAnswer : item.extractedText}
                            </Text>
                        </ScrollView>
                    </View>
                </View>
            )}
        </TouchableOpacity>
    );
};

const EmptyState: React.FC<{ colors: ReturnType<typeof getColors> }> = ({ colors }) => (
    <View style={styles.emptyState}>
        <View style={[styles.emptyIconContainer, { backgroundColor: colors.backgroundColor, borderColor: colors.borderColor }]}>
            <Ionicons name="document-text-outline" size={64} color={colors.textColor.light} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.textColor.primary }]}>No History Yet</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textColor.secondary }]}>
            Start scanning documents or creating notes to see your AI study history here!
        </Text>
    </View>
);

// Main Component
const Profile: React.FC = () => {
    const { user, loading: authLoading, signIn, signUp, signOut } = useAuth();
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [activeFilter, setActiveFilter] = useState("All");
    const [expandedItem, setExpandedItem] = useState<number | null>(null);
    const [credits, setCredits] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState<Stats>({
        problemsSolved: 0,
        daysActive: 0,
        notesCreated: 0,
    });
    const { isPro } = usePurchases();
    const router = useRouter();
    
    // Theme context
    const { resolvedTheme, toggleTheme } = useThemeContext();
    const COLORS = getColors(resolvedTheme === 'dark');

    const [showAuth, setShowAuth] = useState(false);

    const loadData = useCallback(async () => {
        try {
            const [historyData, creditsData, notesData] = await Promise.all([
                getAllHistory(),
                getCredits(),
                getAllNotes(),
            ]);
            
            setHistory(historyData);
            setCredits(creditsData);

            // Calculate stats
            const problemsSolved = historyData.filter(
                (item) => item.feature !== "notes" && item.feature !== "notes-updated"
            ).length;
            
            const uniqueDays = new Set(
                historyData.map((item) => 
                    new Date(item.createdAt).toISOString().split("T")[0]
                )
            );
            
            setStats({
                problemsSolved,
                daysActive: uniqueDays.size,
                notesCreated: notesData.length,
            });
        } catch (error) {
            console.error("Error loading profile data:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            console.log("Profile screen focused, loading data...");
            loadData();
        }, [loadData])
    );

    const handleRefresh = useCallback(() => {
        setRefreshing(true);
        loadData();
    }, [loadData]);

    const handleToggleExpand = useCallback((id: number) => {
        setExpandedItem(current => current === id ? null : id);
    }, []);

    const handleClearHistory = useCallback(() => {
        Alert.alert(
            'Clear History',
            'Are you sure you want to clear all your study history? This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear All',
                    style: 'destructive',
                    onPress: () => {
                        // Implement clearAllHistory function
                        setHistory([]);
                        setExpandedItem(null);
                    }
                }
            ]
        );
    }, []);

    const handleGetFreeCredits = useCallback(async () => {
        try {
            setLoading(true);
            await addCredits(10);
            await loadData();
            Alert.alert("Success", "10 free credits have been added to your account!");
        } catch (error) {
            console.error("Error adding credits:", error);
        }
    }, [loadData]);

    const handleGoPro = () => {
        router.push('/paywall');
    };

    const filteredHistory = history.filter(
        (item) => activeFilter === "All" || item.feature === activeFilter
    );

    const renderHistoryItem = ({ item }: ListRenderItemInfo<HistoryItem>) => (
        <HistoryCard
            item={item}
            isExpanded={expandedItem === item.id}
            onToggleExpand={() => handleToggleExpand(item.id)}
            colors={COLORS}
        />
    );

    const ListHeaderComponent = (
        <>
            <ProfileHeader
                loading={loading}
                credits={credits}
                onRefresh={handleRefresh}
                onClearHistory={handleClearHistory}
                onGetFreeCredits={handleGetFreeCredits}
                onGoPro={handleGoPro}
                onToggleTheme={toggleTheme}
                isDark={resolvedTheme === 'dark'}
            />
            {user ? (
                <TouchableOpacity
                    style={{ alignSelf: 'flex-end', marginRight: 24, marginBottom: 8, backgroundColor: '#ff6b6b', padding: 10, borderRadius: 8 }}
                    onPress={signOut}
                >
                    <Text style={{ color: 'white', fontWeight: '700' }}>Sign Out</Text>
                </TouchableOpacity>
            ) : (
                <TouchableOpacity
                    style={{ alignSelf: 'flex-end', marginRight: 24, marginBottom: 8, backgroundColor: '#667eea', padding: 10, borderRadius: 8 }}
                    onPress={() => setShowAuth(true)}
                >
                    <Text style={{ color: 'white', fontWeight: '700' }}>Login / Sign Up</Text>
                </TouchableOpacity>
            )}
            <StatsCard stats={stats} loading={loading} colors={COLORS} />
            <FilterSection
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
                colors={COLORS}
            />
            <Text style={[styles.historyTitle, { color: COLORS.textColor.primary }]}>Recent Activity</Text>
        </>
    );

    return (
        <View style={[styles.container, { backgroundColor: COLORS.backgroundColor }]}> 
            <View style={{ height: 24 }} />
            {showAuth && (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'center', alignItems: 'center' }}>
                    <AuthScreen onAuthSuccess={() => setShowAuth(false)} onClose={() => setShowAuth(false)} />
                </View>
            )}
            <FlatList
                data={filteredHistory}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderHistoryItem}
                ListHeaderComponent={ListHeaderComponent}
                ListEmptyComponent={!loading ? <EmptyState colors={COLORS} /> : null}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        colors={[COLORS.accentColor]}
                        tintColor={COLORS.accentColor}
                    />
                }
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
};

// Styles
const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    listContent: {
        paddingBottom: 20,
    },
    profileHeader: {
        paddingTop: Platform.OS === 'ios' ? 60 : 50,
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    userSection: {
        flexDirection: 'row',
        flex: 1,
    },
    avatar: {
        marginRight: 16,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    userInfo: {
        flex: 1,
    },
    welcomeText: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 2,
    },
    subtitleText: {
        fontSize: 14,
        marginBottom: 12,
    },
    creditsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    creditsInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    creditsLabel: {
        fontSize: 15,
        marginLeft: 6,
        fontWeight: '500',
    },
    creditsValue: {
        fontSize: 18,
        fontWeight: '700',
        marginLeft: 4,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    themeButton: {
        borderRadius: 16,
        padding: 12,
    },
    refreshButton: {
        padding: 8,
        borderRadius: 12,
    },
    clearButton: {
        borderRadius: 16,
        padding: 12,
    },
    buttonGroup: {
        flexDirection: 'row',
        marginTop: 16,
        gap: 8,
    },
    creditsButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 6,
        gap: 8,
    },
    proButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 6,
        gap: 8,
    },
    creditsButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },
    statsCard: {
        borderRadius: 20,
        padding: 24,
        marginHorizontal: 20,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
        borderWidth: 1,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 20,
        textAlign: 'center',
    },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
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
    statDivider: {
        width: 1,
        height: 40,
    },
    filterSection: {
        paddingVertical: 16,
        marginBottom: 8,
    },
    filterScrollContent: {
        paddingHorizontal: 20,
    },
    filterChip: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 20,
        marginRight: 12,
        borderWidth: 1,
    },
    filterChipText: {
        fontWeight: '600',
        fontSize: 14,
    },
    historyCard: {
        borderRadius: 16,
        marginHorizontal: 20,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 16,
    },
    cardImage: {
        width: 56,
        height: 56,
        borderRadius: 12,
        marginRight: 16,
    },
    imagePlaceholder: {
        width: 56,
        height: 56,
        borderRadius: 12,
        marginRight: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderStyle: 'dashed',
    },
    cardContent: {
        flex: 1,
    },
    cardMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    featureBadge: {
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 4,
        marginRight: 12,
    },
    featureBadgeText: {
        color: '#ffffff',
        fontWeight: '600',
        fontSize: 11,
    },
    timestamp: {
        fontSize: 12,
        marginLeft: 'auto',
        fontWeight: '500',
    },
    cardText: {
        fontSize: 15,
        lineHeight: 22,
    },
    noteTitle: {
        fontWeight: '600',
    },
    expandIcon: {
        marginLeft: 12,
        marginTop: 4,
    },
    expandedContent: {
        borderTopWidth: 1,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    expandedSection: {
        borderRadius: 12,
        padding: 16,
    },
    expandedLabel: {
        fontWeight: '600',
        fontSize: 14,
        marginBottom: 8,
    },
    expandedScrollView: {
        maxHeight: 120,
    },
    expandedText: {
        fontSize: 14,
        lineHeight: 20,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        paddingHorizontal: 40,
    },
    emptyIconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        borderWidth: 2,
        borderStyle: 'dashed',
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        marginBottom: 8,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
    },
    historyTitle: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 20,
        textAlign: 'center',
    },
});

export default Profile;