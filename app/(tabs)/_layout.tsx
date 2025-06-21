import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

const COLORS = {
  primary: {
    start: '#4f46e5', // Indigo
    end: '#7c3aed', // Purple
  },
  surface: '#ffffff',
  text: {
    primary: '#1e293b',
    secondary: '#475569',
    light: '#94a3b8',
  },
};

export default function TabLayout() {
  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarShowLabel: true,
          tabBarActiveTintColor: COLORS.primary.start,
          tabBarInactiveTintColor: COLORS.text.light,
          tabBarLabelStyle: styles.tabBarLabel,
          tabBarBackground: () => (
            <LinearGradient
              colors={[COLORS.surface, COLORS.surface]}
              style={styles.tabBarBackground}
            />
          ),
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Explore',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="compass" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  tabBar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 20 : 10,
    left: 20,
    right: 20,
    elevation: 0,
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    height: 60,
    borderRadius: 30,
    shadowColor: COLORS.primary.start,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tabBarBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  tabBarLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: Platform.OS === 'ios' ? 0 : 4,
  },
});
