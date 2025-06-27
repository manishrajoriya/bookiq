import { usePurchases } from '@/providers/PurchasesProvider';
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

const COLORS = {
    primary: '#667eea',
    secondary: '#4338ca',
    accent: '#feca57',
    success: '#43e97b',
    danger: '#ff6b6b',
    background: '#f8f9fa',
    cardBackground: '#ffffff',
    headerBackground: '#f7f8fa',
    text: {
        primary: '#1a1a1a',
        secondary: '#666',
        tertiary: '#888',
        light: '#aaa',
        white: '#ffffff'
    },
    border: '#f0f0f0'
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
}

interface StatsCardProps {
    stats: Stats;
    loading: boolean;
}

interface FilterSectionProps {
    activeFilter: string;
    onFilterChange: (filter: string) => void;
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
}) => (
    <View style={styles.profileHeader}>
        <View style={styles.headerContent}>
            <View style={styles.userSection}>
                <View style={styles.avatar}>
                    <Ionicons name="person-circle" size={64} color={COLORS.primary} />
                </View>
                <View style={styles.userInfo}>
                    <Text style={styles.welcomeText}>Welcome Back!</Text>
                    <Text style={styles.subtitleText}>Your AI Study Journey</Text>
                    
                    <View style={styles.creditsContainer}>
                        <View style={styles.creditsInfo}>
                            <Ionicons name="diamond" size={18} color={COLORS.accent} />
                            <Text style={styles.creditsLabel}>Credits: </Text>
                            <Text style={styles.creditsValue}>
                                {loading ? '...' : credits.toLocaleString()}
                            </Text>
                        </View>
                        <TouchableOpacity 
                            onPress={onRefresh} 
                            style={styles.refreshButton}
                            disabled={loading}
                        >
                            <Ionicons 
                                name="refresh" 
                                size={16} 
                                color={loading ? COLORS.text.light : COLORS.primary} 
                            />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
            
            <TouchableOpacity 
                style={styles.clearButton} 
                onPress={onClearHistory}
            >
                <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
            </TouchableOpacity>
        </View>
        
        <View style={styles.buttonGroup}>

            <TouchableOpacity
                style={styles.proButton}
                onPress={onGoPro}
                // disabled={true}
            >
                <Ionicons name="rocket" size={20} color={COLORS.text.white} />
                <Text style={styles.creditsButtonText}>Go PRO</Text>
            </TouchableOpacity>
        </View>
    </View>
);

const StatsCard: React.FC<StatsCardProps> = ({ stats, loading }) => (
    <View style={styles.statsCard}>
        <Text style={styles.sectionTitle}>Your Progress</Text>
        <View style={styles.statsGrid}>
            <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                    {loading ? '...' : stats.problemsSolved}
                </Text>
                <Text style={styles.statLabel}>Problems Solved</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                    {loading ? '...' : stats.daysActive}
                </Text>
                <Text style={styles.statLabel}>Days Active</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                    {loading ? '...' : stats.notesCreated}
                </Text>
                <Text style={styles.statLabel}>Notes Created</Text>
            </View>
        </View>
    </View>
);

const FilterSection: React.FC<FilterSectionProps> = ({ activeFilter, onFilterChange }) => (
    <View style={styles.filterSection}>
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
                        activeFilter === filter && styles.activeFilterChip,
                    ]}
                    onPress={() => onFilterChange(filter)}
                    activeOpacity={0.7}
                >
                    <Text
                        style={[
                            styles.filterChipText,
                            activeFilter === filter && styles.activeFilterChipText,
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
}> = ({ item, isExpanded, onToggleExpand }) => {
    const isNote = item.feature === "notes" || item.feature === "notes-updated";
    
    return (
        <TouchableOpacity
            style={styles.historyCard}
            onPress={onToggleExpand}
            activeOpacity={0.95}
        >
            <View style={styles.cardHeader}>
                {item.imageUri ? (
                    <Image source={{ uri: item.imageUri }} style={styles.cardImage} />
                ) : (
                    <View style={styles.imagePlaceholder}>
                        <Ionicons
                            name={isNote ? "document-text" : "image"}
                            size={24}
                            color={COLORS.text.light}
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
                        <Text style={styles.timestamp}>{formatDate(item.createdAt)}</Text>
                    </View>
                    
                    <Text
                        numberOfLines={isExpanded ? undefined : 2}
                        style={[styles.cardText, isNote && styles.noteTitle]}
                    >
                        {isNote ? item.extractedText : item.aiAnswer}
                    </Text>
                </View>
                
                <Ionicons
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={COLORS.text.light}
                    style={styles.expandIcon}
                />
            </View>
            
            {isExpanded && (
                <View style={styles.expandedContent}>
                    <View style={styles.expandedSection}>
                        <Text style={styles.expandedLabel}>
                            {isNote ? "Note Content:" : "Extracted Text:"}
                        </Text>
                        <ScrollView 
                            style={styles.expandedScrollView}
                            showsVerticalScrollIndicator={false}
                        >
                            <Text style={styles.expandedText}>
                                {isNote ? item.aiAnswer : item.extractedText}
                            </Text>
                        </ScrollView>
                    </View>
                </View>
            )}
        </TouchableOpacity>
    );
};

const EmptyState: React.FC = () => (
    <View style={styles.emptyState}>
        <View style={styles.emptyIconContainer}>
            <Ionicons name="document-text-outline" size={64} color={COLORS.text.light} />
        </View>
        <Text style={styles.emptyTitle}>No History Yet</Text>
        <Text style={styles.emptySubtitle}>
            Start scanning documents or creating notes to see your AI study history here!
        </Text>
    </View>
);

// Main Component
const Profile: React.FC = () => {
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
            />
            <StatsCard stats={stats} loading={loading} />
            <FilterSection
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
            />
            <Text style={styles.historyTitle}>Recent Activity</Text>
        </>
    );

    return (
        <View style={styles.container}>
            <FlatList
                data={filteredHistory}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderHistoryItem}
                ListHeaderComponent={ListHeaderComponent}
                ListEmptyComponent={!loading ? <EmptyState /> : null}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        colors={[COLORS.primary]}
                        tintColor={COLORS.primary}
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
        backgroundColor: COLORS.background,
    },
    listContent: {
        paddingBottom: 20,
    },
    profileHeader: {
        backgroundColor: COLORS.headerBackground,
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
        shadowColor: COLORS.primary,
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
        color: COLORS.text.primary,
        marginBottom: 2,
    },
    subtitleText: {
        fontSize: 14,
        color: COLORS.text.secondary,
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
        color: COLORS.text.secondary,
        marginLeft: 6,
        fontWeight: '500',
    },
    creditsValue: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.accent,
        marginLeft: 4,
    },
    refreshButton: {
        padding: 8,
        borderRadius: 12,
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
    },
    clearButton: {
        backgroundColor: 'rgba(255, 107, 107, 0.1)',
        borderRadius: 16,
        padding: 12,
        marginLeft: 16,
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
        backgroundColor: COLORS.secondary,
        paddingVertical: 12,
        borderRadius: 12,
        shadowColor: COLORS.secondary,
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
        backgroundColor: COLORS.accent,
        paddingVertical: 12,
        borderRadius: 12,
        shadowColor: COLORS.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 6,
        gap: 8,
    },
    creditsButtonText: {
        color: COLORS.text.white,
        fontSize: 14,
        fontWeight: '600',
    },
    statsCard: {
        backgroundColor: COLORS.cardBackground,
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
        borderColor: COLORS.border,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.text.primary,
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
        color: COLORS.primary,
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: COLORS.text.secondary,
        textAlign: 'center',
        fontWeight: '500',
    },
    statDivider: {
        width: 1,
        height: 40,
        backgroundColor: COLORS.border,
    },
    filterSection: {
        paddingVertical: 16,
        backgroundColor: COLORS.headerBackground,
        marginBottom: 8,
    },
    filterScrollContent: {
        paddingHorizontal: 20,
    },
    filterChip: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
        marginRight: 12,
        borderWidth: 1,
        borderColor: 'rgba(102, 126, 234, 0.2)',
    },
    activeFilterChip: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    filterChipText: {
        color: COLORS.secondary,
        fontWeight: '600',
        fontSize: 14,
    },
    activeFilterChipText: {
        color: COLORS.text.white,
    },
    historyCard: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: 16,
        marginHorizontal: 20,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: COLORS.border,
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
        backgroundColor: COLORS.border,
    },
    imagePlaceholder: {
        width: 56,
        height: 56,
        borderRadius: 12,
        marginRight: 16,
        backgroundColor: COLORS.background,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
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
        color: COLORS.text.white,
        fontWeight: '600',
        fontSize: 11,
    },
    timestamp: {
        color: COLORS.text.light,
        fontSize: 12,
        marginLeft: 'auto',
        fontWeight: '500',
    },
    cardText: {
        color: COLORS.text.primary,
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
        borderTopColor: COLORS.border,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    expandedSection: {
        backgroundColor: COLORS.background,
        borderRadius: 12,
        padding: 16,
    },
    expandedLabel: {
        fontWeight: '600',
        color: COLORS.primary,
        fontSize: 14,
        marginBottom: 8,
    },
    expandedScrollView: {
        maxHeight: 120,
    },
    expandedText: {
        color: COLORS.text.secondary,
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
        backgroundColor: COLORS.background,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        borderWidth: 2,
        borderColor: COLORS.border,
        borderStyle: 'dashed',
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: COLORS.text.primary,
        marginBottom: 8,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: 16,
        color: COLORS.text.secondary,
        textAlign: 'center',
        lineHeight: 24,
    },
    historyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.text.primary,
        marginBottom: 20,
        textAlign: 'center',
    },
});

export default Profile;