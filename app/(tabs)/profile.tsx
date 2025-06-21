import {
    addCredits,
    getAllHistory,
    getAllNotes,
    getCredits
} from "@/services/historyStorage";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Image, ListRenderItemInfo, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const filterOptions = [
  "All",
  "ai-scan",
  "notes",
  "notes-updated",
  "calculator",
  "quiz-maker",
  "study-notes",
];

const featureColors: Record<string, string> = {
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
  // fallback
  'default': '#888'
};

interface HistoryItem {
  id: number;
  imageUri: string | null;
  feature: string;
  extractedText: string;
  aiAnswer: string;
  createdAt: string;
}

interface ProfileListHeaderProps {
  loading: boolean;
  credits: number;
  loadData: () => void;
  handleClearHistory: () => void;
  handleGetFreeCredits: () => void;
  stats: { problemsSolved: number; daysActive: number; notesCreated: number };
  activeFilter: string;
  setActiveFilter: React.Dispatch<React.SetStateAction<string>>;
}

const ProfileListHeader = ({
  loading,
  credits,
  loadData,
  handleClearHistory,
  handleGetFreeCredits,
  stats,
  activeFilter,
  setActiveFilter,
}: ProfileListHeaderProps) => (
  <>
    <View style={styles.profileHeader}>
      <View style={styles.avatar}>
        <Ionicons name="person-circle" size={64} color="#667eea" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.profileName}>Welcome Back!</Text>
        <Text style={styles.profileSub}>Your AI Study History</Text>
        <View style={styles.creditsRow}>
          <Ionicons
            name="logo-bitcoin"
            size={20}
            color="#feca57"
            style={{ marginRight: 6 }}
          />
          <Text style={styles.creditsText}>Credits: </Text>
          {loading ? (
            <Text style={styles.creditsValue}>...</Text>
          ) : (
            <Text style={styles.creditsValue}>{credits}</Text>
          )}
          <TouchableOpacity onPress={loadData} style={styles.refreshBtn}>
            <Ionicons name="refresh" size={18} color="#667eea" />
          </TouchableOpacity>
        </View>
      </View>
      <TouchableOpacity style={styles.clearBtn} onPress={handleClearHistory}>
        <Ionicons name="trash-outline" size={22} color="#ff6b6b" />
      </TouchableOpacity>
    </View>

    <View style={styles.creditsSection}>
      <TouchableOpacity
        style={styles.creditsButton}
        onPress={handleGetFreeCredits}
      >
        <Ionicons
          name="gift-outline"
          size={22}
          color="white"
          style={{ marginRight: 8 }}
        />
        <Text style={styles.creditsButtonText}>Get 10 Free Credits</Text>
      </TouchableOpacity>
    </View>

    <View style={styles.statsCard}>
      <Text style={styles.statsTitle}>Your Progress</Text>
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.problemsSolved}</Text>
          <Text style={styles.statLabel}>Problems Solved</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.daysActive}</Text>
          <Text style={styles.statLabel}>Days Active</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.notesCreated}</Text>
          <Text style={styles.statLabel}>Notes Created</Text>
        </View>
      </View>
    </View>

    <View style={styles.filterContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {filterOptions.map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[
              styles.filterButton,
              activeFilter === filter && styles.activeFilterButton,
            ]}
            onPress={() => setActiveFilter(filter)}
          >
            <Text
              style={[
                styles.filterButtonText,
                activeFilter === filter && styles.activeFilterButtonText,
              ]}
            >
              {filter.replace(/-/g, " ")}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  </>
);

const Profile = () => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeFilter, setActiveFilter] = useState("All");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [credits, setCredits] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    problemsSolved: 0,
    daysActive: 0,
    notesCreated: 0,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [historyData, creditsData, notesData] = await Promise.all([
      getAllHistory(),
      getCredits(),
      getAllNotes(),
    ]);
    setHistory(historyData);
    setCredits(creditsData);

    const problemsSolved = historyData.filter(
      (item) => item.feature !== "notes" && item.feature !== "notes-updated"
    ).length;
    const uniqueDays = new Set(
      historyData.map((item) => new Date(item.createdAt).toISOString().split("T")[0])
    );
    const daysActive = uniqueDays.size;
    const notesCreated = notesData.length;
    setStats({
      problemsSolved,
      daysActive,
      notesCreated,
    });

    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      console.log("PROFILE: Screen focused, loading data...");
      loadData();
    }, [loadData])
  );

  const handleExpand = (id: number) => {
    setExpanded(expanded === id ? null : id);
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Clear History',
      'Are you sure you want to clear all history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            // You need to implement this function in your historyStorage.ts
            //  await clearAllHistory();
            setHistory([]);
          }
        }
      ]
    );
  };

  const handleGetFreeCredits = async () => {
    setLoading(true);
    await addCredits(10);
    loadData(); // Re-fetch all data to update UI
  };

  const renderHistoryItem = ({ item }: ListRenderItemInfo<HistoryItem>) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => handleExpand(item.id)}
      activeOpacity={0.9}
    >
      {item.imageUri ? (
        <Image
          source={{ uri: item.imageUri }}
          style={styles.image}
        />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Ionicons
            name={
              item.feature === "notes" ||
              item.feature === "notes-updated"
                ? "journal-outline"
                : "image-outline"
            }
            size={28}
            color="#bbb"
          />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View style={styles.row}>
          <View
            style={[
              styles.featureBadge,
              {
                backgroundColor:
                  featureColors[item.feature] ||
                  featureColors["default"],
              },
            ]}
          >
            <Text style={styles.featureBadgeText}>
              {item.feature.replace(/-/g, " ")}
            </Text>
          </View>
          <Text style={styles.date}>
            {new Date(item.createdAt).toLocaleString()}
          </Text>
        </View>

        {item.feature === "notes" ||
        item.feature === "notes-updated" ? (
          <>
            <Text
              numberOfLines={2}
              style={styles.noteTitleInHistory}
            >
              {item.extractedText}
            </Text>
            {expanded === item.id && (
              <ScrollView style={styles.expandedBox}>
                <Text style={styles.expandedLabel}>
                  Note Content:
                </Text>
                <Text style={styles.expandedText}>
                  {item.aiAnswer}
                </Text>
              </ScrollView>
            )}
          </>
        ) : (
          <>
            <Text numberOfLines={2} style={styles.answer}>
              {item.aiAnswer}
            </Text>
            {expanded === item.id && (
              <ScrollView style={styles.expandedBox}>
                <Text style={styles.expandedLabel}>
                  Extracted Text:
                </Text>
                <Text style={styles.expandedText}>
                  {item.extractedText}
                </Text>
              </ScrollView>
            )}
          </>
        )}
      </View>
      <Ionicons
        name={expanded === item.id ? "chevron-up" : "chevron-down"}
        size={22}
        color="#bbb"
        style={{ marginLeft: 8 }}
      />
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#f8f9fa" }}>
      <FlatList
        data={history.filter(
          (item) => activeFilter === "All" || item.feature === activeFilter
        )}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderHistoryItem}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
        ListHeaderComponent={
          <ProfileListHeader
            loading={loading}
            credits={credits}
            loadData={loadData}
            handleClearHistory={handleClearHistory}
            handleGetFreeCredits={handleGetFreeCredits}
            stats={stats}
            activeFilter={activeFilter}
            setActiveFilter={setActiveFilter}
          />
        }
        ListEmptyComponent={
          history.length === 0 && !loading ? (
            <View style={styles.emptyBox}>
              <Ionicons name="time-outline" size={48} color="#e0e0e0" />
              <Text style={styles.emptyText}>
                No history yet. Start scanning to see your results here!
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 50, // Safe area
    paddingBottom: 10,
    backgroundColor: '#f7f8fa',
  },
  avatar: {
    marginRight: 16,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
  },
  profileSub: {
    color: '#888',
    fontSize: 14,
    marginTop: 2,
  },
  creditsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 2,
  },
  creditsText: {
    color: '#888',
    fontSize: 15,
    fontWeight: '500',
  },
  creditsValue: {
    color: '#feca57',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 2,
    marginRight: 4,
  },
  refreshBtn: {
    marginLeft: 4,
    padding: 2,
    borderRadius: 10,
  },
  clearBtn: {
    marginLeft: 'auto',
    alignSelf: 'flex-start',
    backgroundColor: '#fff0f0',
    borderRadius: 20,
    padding: 8,
  },
  creditsSection: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#f7f8fa",
    paddingBottom: 20,
  },
  creditsButton: {
    backgroundColor: "#667eea",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: "#667eea",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  creditsButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  filterContainer: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "#f7f8fa",
    paddingTop: 0,
    marginBottom: 10,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#eef2ff",
    marginRight: 10,
  },
  activeFilterButton: {
    backgroundColor: "#667eea",
  },
  filterButtonText: {
    color: "#4338ca",
    fontWeight: "600",
    textTransform: "capitalize",
  },
  activeFilterButtonText: {
    color: "white",
  },
  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 50,
  },
  emptyText: {
    color: '#bbb',
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  image: {
    width: 54,
    height: 54,
    borderRadius: 10,
    marginRight: 14,
    backgroundColor: '#e0e0e0',
  },
  imagePlaceholder: {
    width: 54,
    height: 54,
    borderRadius: 10,
    marginRight: 14,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  featureBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 2,
    marginRight: 8,
  },
  featureBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  answer: {
    color: '#333',
    marginTop: 2,
    fontSize: 15,
  },
  date: {
    color: '#aaa',
    fontSize: 12,
    marginLeft: 'auto',
  },
  expandedBox: {
    marginTop: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 10,
    maxHeight: 120,
  },
  expandedLabel: {
    fontWeight: 'bold',
    color: '#667eea',
    marginBottom: 4,
  },
  expandedText: {
    color: '#444',
    fontSize: 14,
  },
  noteTitleInHistory: {
    color: '#333',
    marginTop: 2,
    fontSize: 15,
    fontWeight: '500',
  },
  statsCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 16,
    marginTop: 0,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#f0f0f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  statsTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 20,
    textAlign: "center",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "800",
    color: "#667eea",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#f0f0f0",
  },
});

export default Profile;