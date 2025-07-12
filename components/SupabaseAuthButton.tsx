import type { Session } from '@supabase/supabase-js';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../utils/supabase';

const GOOGLE_PROVIDER = 'google';

const SupabaseAuthButton = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [profileEmail, setProfileEmail] = useState('');
  const [profilePassword, setProfilePassword] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const passwordInputRef = useRef<TextInput>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  // Centralized state reset
  const resetAuthState = () => {
    setEmail('');
    setPassword('');
    setError('');
    setSuccessMsg('');
    setLoading(false);
    setShowPassword(false);
  };

  // Auth Actions
  const handleLogin = async () => {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    else {
      setModalVisible(false);
      resetAuthState();
    }
    setLoading(false);
  };

  const handleSignUp = async () => {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setError(error.message);
    else setSuccessMsg('Check your email to confirm your account.');
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) setError(error.message);
    else setSuccessMsg('Password reset email sent. Check your inbox.');
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    const { error } = await supabase.auth.signInWithOAuth({ provider: GOOGLE_PROVIDER });
    if (error) setError(error.message);
    setLoading(false);
  };

  const handleLogout = async () => {
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signOut();
    if (error) setError(error.message);
    setLoading(false);
    setLogoutConfirm(false);
  };

  // Profile Edit
  const handleProfileUpdate = async () => {
    setProfileLoading(true);
    setProfileMsg('');
    let msg = '';
    if (profileEmail && profileEmail !== session?.user.email) {
      const { error } = await supabase.auth.updateUser({ email: profileEmail });
      if (error) msg += error.message + '\n';
      else msg += 'Email updated. Check your inbox to confirm.\n';
    }
    if (profilePassword) {
      const { error } = await supabase.auth.updateUser({ password: profilePassword });
      if (error) msg += error.message + '\n';
      else msg += 'Password updated.\n';
    }
    setProfileMsg(msg.trim());
    setProfileLoading(false);
    setProfileEmail('');
    setProfilePassword('');
  };

  // Modal Content
  const renderAuthModal = () => (
    <Modal
      visible={modalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => !loading && setModalVisible(false)}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{isForgot ? 'Reset Password' : isSignUp ? 'Sign Up' : 'Login'}</Text>
            {error ? (
              <View style={styles.errorBanner} accessibilityRole="alert">
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
            {successMsg ? (
              <View style={styles.successBanner}>
                <Text style={styles.successText}>{successMsg}</Text>
              </View>
            ) : null}
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
              returnKeyType={!isForgot ? 'next' : 'done'}
              onSubmitEditing={() => !isForgot && passwordInputRef.current && passwordInputRef.current.focus()}
              blurOnSubmit={isForgot}
              accessibilityLabel="Email"
            />
            {!isForgot && (
              <View style={styles.passwordRow}>
                <TextInput
                  ref={passwordInputRef}
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                  returnKeyType="done"
                  accessibilityLabel="Password"
                />
                <TouchableOpacity
                  style={styles.showHideBtn}
                  onPress={() => setShowPassword((v) => !v)}
                  disabled={loading}
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Text style={styles.showHideText}>{showPassword ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>
            )}
            {isForgot ? (
              <TouchableOpacity style={styles.modalLoginBtn} onPress={handleForgotPassword} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalLoginBtnText}>Send Reset Email</Text>}
              </TouchableOpacity>
            ) : isSignUp ? (
              <TouchableOpacity style={styles.modalLoginBtn} onPress={handleSignUp} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalLoginBtnText}>Sign Up</Text>}
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity style={styles.modalLoginBtn} onPress={handleLogin} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalLoginBtnText}>Login</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleLogin} disabled={loading}>
                  <Text style={styles.googleBtnText}>Continue with Google</Text>
                </TouchableOpacity>
              </>
            )}
            <View style={styles.switchRow}>
              {!isForgot && (
                <TouchableOpacity onPress={() => { setIsSignUp(!isSignUp); resetAuthState(); }} disabled={loading}>
                  <Text style={styles.switchText}>{isSignUp ? 'Already have an account? Login' : "Don't have an account? Sign Up"}</Text>
                </TouchableOpacity>
              )}
              {!isSignUp && !isForgot && (
                <TouchableOpacity onPress={() => { setIsForgot(true); resetAuthState(); }} disabled={loading}>
                  <Text style={styles.switchText}>Forgot Password?</Text>
                </TouchableOpacity>
              )}
              {isForgot && (
                <TouchableOpacity onPress={() => { setIsForgot(false); resetAuthState(); }} disabled={loading}>
                  <Text style={styles.switchText}>Back to Login</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={() => !loading && setModalVisible(false)} disabled={loading}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  // Profile Edit Modal
  const renderProfileEditModal = () => (
    <Modal
      visible={showProfileEdit}
      transparent
      animationType="slide"
      onRequestClose={() => setShowProfileEdit(false)}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TextInput
              style={styles.input}
              placeholder="New Email"
              value={profileEmail}
              onChangeText={setProfileEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!profileLoading}
              accessibilityLabel="New Email"
            />
            <TextInput
              style={styles.input}
              placeholder="New Password"
              value={profilePassword}
              onChangeText={setProfilePassword}
              secureTextEntry
              editable={!profileLoading}
              accessibilityLabel="New Password"
            />
            {profileMsg ? <View style={styles.successBanner}><Text style={styles.successText}>{profileMsg}</Text></View> : null}
            <TouchableOpacity style={styles.modalLoginBtn} onPress={handleProfileUpdate} disabled={profileLoading}>
              {profileLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalLoginBtnText}>Update</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowProfileEdit(false)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  return (
    <View style={styles.wrapper}>
      {session ? (
        <>
          <View style={styles.loggedInBox}>
            {session.user.user_metadata?.avatar_url ? (
              <Image source={{ uri: session.user.user_metadata.avatar_url }} style={styles.avatar} />
            ) : null}
            <Text style={styles.text}>Logged in as</Text>
            <Text style={styles.email}>{session.user.email}</Text>
            <TouchableOpacity style={styles.profileEditBtn} onPress={() => setShowProfileEdit(true)}>
              <Text style={styles.profileEditBtnText}>Edit Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={() => setLogoutConfirm(true)}
              disabled={loading}
            >
              <Text style={styles.logoutBtnText}>{loading ? 'Logging out...' : 'Logout'}</Text>
            </TouchableOpacity>
          </View>
          {/* Logout confirmation modal */}
          <Modal
            visible={logoutConfirm}
            transparent
            animationType="fade"
            onRequestClose={() => setLogoutConfirm(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.confirmModal}>
                <Text style={styles.confirmText}>Are you sure you want to logout?</Text>
                <View style={styles.confirmActions}>
                  <TouchableOpacity style={styles.confirmBtn} onPress={handleLogout}>
                    <Text style={styles.confirmBtnText}>Yes</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setLogoutConfirm(false)}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
          {renderProfileEditModal()}
        </>
      ) : (
        <>
          <TouchableOpacity style={styles.loginBtn} onPress={() => { setModalVisible(true); resetAuthState(); }}>
            <Text style={styles.loginBtnText}>Login / Sign Up</Text>
          </TouchableOpacity>
          {renderAuthModal()}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    marginVertical: 16,
  },
  loginBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 24,
    marginTop: 8,
  },
  loginBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  loggedInBox: {
    backgroundColor: '#e6f7ff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginTop: 8,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 12,
  },
  text: {
    fontSize: 16,
    color: '#333',
  },
  email: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
    marginVertical: 8,
  },
  logoutBtn: {
    backgroundColor: '#ff3b30',
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 20,
    marginTop: 8,
  },
  logoutBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    width: 320,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 18,
    color: '#007AFF',
  },
  input: {
    width: '100%',
    padding: 10,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    fontSize: 16,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  showHideBtn: {
    marginLeft: 8,
    padding: 8,
  },
  showHideText: {
    color: '#007AFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  modalLoginBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 24,
    marginTop: 12,
    width: '100%',
    alignItems: 'center',
  },
  modalLoginBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  googleBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#4285F4',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 40,
    marginTop: 12,
    width: '100%',
    alignItems: 'center',
  },
  googleBtnText: {
    color: '#4285F4',
    fontWeight: 'bold',
    fontSize: 16,
  },
  closeBtn: {
    marginTop: 16,
    padding: 8,
  },
  closeBtnText: {
    color: '#007AFF',
    fontSize: 16,
  },
  errorBanner: {
    backgroundColor: '#ffe5e5',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    width: '100%',
  },
  errorText: {
    color: '#d32f2f',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  successBanner: {
    backgroundColor: '#e5ffe5',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    width: '100%',
  },
  successText: {
    color: '#388e3c',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 12,
  },
  switchText: {
    color: '#007AFF',
    fontSize: 14,
    marginHorizontal: 8,
    textDecorationLine: 'underline',
  },
  confirmModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: 280,
    alignItems: 'center',
  },
  confirmText: {
    fontSize: 18,
    marginBottom: 18,
    color: '#333',
    textAlign: 'center',
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  confirmBtn: {
    backgroundColor: '#ff3b30',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    marginRight: 8,
  },
  confirmBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancelBtn: {
    backgroundColor: '#ccc',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  cancelBtnText: {
    color: '#333',
    fontWeight: 'bold',
    fontSize: 16,
  },
  profileEditBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  profileEditBtnText: {
    color: '#007AFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default SupabaseAuthButton; 