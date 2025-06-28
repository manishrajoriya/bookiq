import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useThemeColor } from '../../hooks/useThemeColor';

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
  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'icon');
  const activeColor = useThemeColor({}, 'tint');
  const inactiveColor = useThemeColor({}, 'icon');

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: [styles.tabBar, { backgroundColor }],
          tabBarShowLabel: true,
          tabBarActiveTintColor: activeColor,
          tabBarInactiveTintColor: inactiveColor,
          tabBarLabelStyle: styles.tabBarLabel,
          tabBarBackground: () => (
            <LinearGradient
              colors={[backgroundColor, backgroundColor]}
              style={[styles.tabBarBackground, { borderColor }]}
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
  },
  tabBar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 20 : 10,
    left: 20,
    right: 20,
    elevation: 0,
    borderTopWidth: 0,
    height: 60,
    borderRadius: 30,
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
  },
  tabBarLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: Platform.OS === 'ios' ? 0 : 4,
  },
});
