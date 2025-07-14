import type { Session } from '@supabase/supabase-js';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AuthModal from './AuthModal';

const AuthExample: React.FC = () => {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Authentication Example</Text>
      
      <TouchableOpacity 
        style={styles.button}
        onPress={() => setShowAuthModal(true)}
      >
        <Text style={styles.buttonText}>
          {session ? 'Account Settings' : 'Sign In / Sign Up'}
        </Text>
      </TouchableOpacity>

      {session && (
        <View style={styles.userInfo}>
          <Text style={styles.userText}>
            Logged in as: {session.user.email}
          </Text>
        </View>
      )}

      <AuthModal 
        visible={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={(session) => {
          setSession(session);
          setShowAuthModal(false);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  userInfo: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  userText: {
    fontSize: 16,
  },
});

export default AuthExample; 