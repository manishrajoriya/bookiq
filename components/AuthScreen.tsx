import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../providers/AuthProvider';

interface AuthScreenProps {
  mode?: 'login' | 'signup';
  onAuthSuccess?: () => void;
  onClose?: () => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ mode = 'login', onAuthSuccess, onClose }) => {
  const { signIn, signUp } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'signup'>(mode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      if (authMode === 'login') {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
      if (onAuthSuccess) onAuthSuccess();
    } catch (e: any) {
      setError(e.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{authMode === 'login' ? 'Login' : 'Sign Up'}</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <TouchableOpacity
        style={styles.button}
        onPress={handleAuth}
        disabled={loading || !email || !password}
      >
        {loading ? <ActivityIndicator color="#fff" /> : (
          <Text style={styles.buttonText}>{authMode === 'login' ? 'Login' : 'Sign Up'}</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}>
        <Text style={styles.switchText}>
          {authMode === 'login' ? "Don't have an account? Sign Up" : 'Already have an account? Login'}
        </Text>
      </TouchableOpacity>
      {onClose && (
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>Close</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: '#fff',
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    margin: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
  },
  input: {
    width: 240,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#667eea',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
    width: 240,
  },
  buttonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
  },
  switchText: {
    color: '#667eea',
    textAlign: 'center',
    marginBottom: 8,
  },
  error: {
    color: 'red',
    marginBottom: 8,
  },
  closeButton: {
    marginTop: 8,
    padding: 8,
  },
  closeButtonText: {
    color: '#888',
    fontSize: 14,
  },
});

export default AuthScreen; 