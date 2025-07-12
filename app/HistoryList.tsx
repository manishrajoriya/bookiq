import { getAllHistory } from '@/services/historyStorage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
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

const FILTER_OPTIONS = [
  'All',
  'ai-scan',
  'notes',
  'notes-updated',
  'calculator',
  'quiz-maker',
  'study-notes',
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
  'default': '#888',
};

interface HistoryItem {
  id: number;
  imageUri: string | null;
  feature: string;
  extractedText: string;
  aiAnswer: string;
  createdAt: string;
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60);
  if (diffInHours < 24) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffInHours < 168) {
    return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const formatFeatureName = (feature: string): string => {
  return feature.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const HistoryCard: React.FC<{
  item: HistoryItem;
  isExpanded: boolean;
  onToggleExpand: () => void;
}> = ({ item, isExpanded, onToggleExpand }) => {
  const isNote = item.feature === 'notes' || item.feature === 'notes-updated';
  return (
    <View style={styles.cardOuterWrap}>
      <TouchableOpacity
        style={[styles.historyCard, { borderColor: '#333', backgroundColor: '#232323' }]}
        onPress={onToggleExpand}
        activeOpacity={0.95}
      >
        <View style={styles.cardHeader}>
          {item.imageUri ? (
            <Image source={{ uri: item.imageUri }} style={styles.cardImage} />
          ) : (
            <View style={[styles.imagePlaceholder, { backgroundColor: '#181818', borderColor: '#333' }]}> 
              <Ionicons
                name={isNote ? 'document-text' : 'image'}
                size={24}
                color={'#aaa'}
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
                <Text style={styles.featureBadgeText}>{formatFeatureName(item.feature)}</Text>
              </View>
              <Text style={[styles.timestamp, { color: '#aaa' }]}>{formatDate(item.createdAt)}</Text>
            </View>
            <Text
              numberOfLines={isExpanded ? undefined : 2}
              style={[styles.cardText, { color: '#fff' }, isNote && styles.noteTitle]}
            >
              {isNote ? item.extractedText : item.aiAnswer}
            </Text>
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={'#aaa'}
            style={styles.expandIcon}
          />
        </View>
        {isExpanded && (
          <View style={[styles.expandedContent, { borderTopColor: '#333' }]}> 
            <View style={[styles.expandedSection, { backgroundColor: '#181818' }]}> 
              <Text style={[styles.expandedLabel, { color: '#feca57' }]}>
                {isNote ? 'Note Content:' : 'Extracted Text:'}
              </Text>
              <ScrollView style={styles.expandedScrollView} showsVerticalScrollIndicator={false}>
                <Text style={[styles.expandedText, { color: '#aaa' }]}>
                  {isNote ? item.aiAnswer : item.extractedText}
                </Text>
              </ScrollView>
            </View>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const EmptyState: React.FC = () => (
  <View style={styles.emptyState}>
    <Ionicons name="document-text-outline" size={80} color={'#feca57'} style={{ marginBottom: 16 }} />
    <Text style={[styles.emptyTitle, { color: '#fff' }]}>No History Yet</Text>
    <Text style={[styles.emptySubtitle, { color: '#aaa' }]}>Start scanning documents or creating notes to see your AI study history here!</Text>
  </View>
);

const FilterSection: React.FC<{
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}> = ({ activeFilter, onFilterChange }) => (
  <View style={styles.filterSectionWrap}>
    <LinearGradient
      colors={['#232526', '#414345']}
      style={styles.filterBarGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollContent}>
        {FILTER_OPTIONS.map(filter => (
          <TouchableOpacity
            key={filter}
            style={[
              styles.filterChip,
              { backgroundColor: 'rgba(102, 126, 234, 0.12)', borderColor: 'rgba(102, 126, 234, 0.18)' },
              activeFilter === filter && { backgroundColor: '#feca57', borderColor: '#feca57' },
            ]}
            onPress={() => onFilterChange(filter)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterChipText,
                { color: activeFilter === filter ? '#181818' : '#eee' },
              ]}
            >
              {formatFeatureName(filter)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </LinearGradient>
  </View>
);

const HistoryList: React.FC = () => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const loadData = useCallback(async () => {
    try {
      const [historyData] = await Promise.all([
        getAllHistory(),
      ]);
      setHistory(historyData);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleToggleExpand = useCallback((id: number) => {
    setExpandedItem(current => (current === id ? null : id));
  }, []);

  const filteredHistory = history.filter(
    item => activeFilter === 'All' || item.feature === activeFilter
  );

  const renderHistoryItem = ({ item }: ListRenderItemInfo<HistoryItem>) => (
    <HistoryCard
      item={item}
      isExpanded={expandedItem === item.id}
      onToggleExpand={() => handleToggleExpand(item.id)}
    />
  );

  return (
    <LinearGradient
      colors={['#181818', '#232526']}
      style={styles.pageContainer}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={styles.stickyHeaderWrap}>
        <LinearGradient
          colors={['#232526', '#414345']}
          style={styles.pageHeader}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <TouchableOpacity onPress={() => router.back()} style={styles.backIcon}>
            <Ionicons name="arrow-back" size={24} color="#feca57" />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>History</Text>
        </LinearGradient>
      </View>
      <FilterSection activeFilter={activeFilter} onFilterChange={setActiveFilter} />
      <FlatList
        data={filteredHistory}
        keyExtractor={item => item.id.toString()}
        renderItem={renderHistoryItem}
        ListEmptyComponent={!loading ? <EmptyState /> : null}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#feca57']}
            tintColor={'#feca57'}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  pageContainer: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 54 : 24,
  },
  stickyHeaderWrap: {
    zIndex: 10,
    elevation: 10,
    marginBottom: 0,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderColor: '#222',
    marginBottom: 8,
    paddingTop: 8,
    backgroundColor: 'transparent',
  },
  backIcon: {
    padding: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(254,202,87,0.08)',
  },
  pageTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  filterSectionWrap: {
    marginBottom: 8,
    paddingTop: 2,
    paddingBottom: 2,
    backgroundColor: 'transparent',
  },
  filterBarGradient: {
    borderRadius: 16,
    marginHorizontal: 12,
    paddingVertical: 8,
    paddingHorizontal: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  filterScrollContent: {
    paddingHorizontal: 8,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 999,
    marginRight: 10,
    borderWidth: 1,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipText: {
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.2,
  },
  cardOuterWrap: {
    marginBottom: 18,
    marginHorizontal: 0,
  },
  historyCard: {
    borderRadius: 20,
    marginHorizontal: 18,
    backgroundColor: '#232323',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#232323',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 18,
  },
  cardImage: {
    width: 56,
    height: 56,
    borderRadius: 14,
    marginRight: 16,
  },
  imagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 14,
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
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginRight: 12,
    backgroundColor: '#feca57',
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureBadgeText: {
    color: '#181818',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.2,
  },
  timestamp: {
    fontSize: 12,
    marginLeft: 'auto',
    fontWeight: '500',
    color: '#aaa',
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
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
    color: '#feca57',
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    color: '#aaa',
  },
  listContent: {
    paddingBottom: 32,
    paddingTop: 8,
  },
});

export default HistoryList; 