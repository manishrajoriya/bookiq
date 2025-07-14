import { Ionicons } from '@expo/vector-icons';
import type { Session } from '@supabase/supabase-js';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useThemeColor } from '../hooks/useThemeColor';
import { useThemeContext } from '../providers/ThemeProvider';
import { supabase } from '../utils/supabase';

const { width: screenWidth } = Dimensions.get('window');

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
  onAuthSuccess?: (session: Session) => void;
}

interface ValidationErrors {
  email?: string;
  password?: string;
  general?: string;
}

interface RateLimitInfo {
  attempts: number;
  lastAttempt: number;
  blocked: boolean;
}

const AuthModal: React.FC<AuthModalProps> = ({ visible, onClose, onAuthSuccess }) => {
  const { resolvedTheme } = useThemeContext();
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  
  // Theme-aware colors
  const colors = {
    primary: resolvedTheme === 'dark' ? '#0a7ea4' : tintColor,
    success: resolvedTheme === 'dark' ? '#10b981' : '#059669',
    warning: resolvedTheme === 'dark' ? '#f59e0b' : '#d97706',
    danger: resolvedTheme === 'dark' ? '#ef4444' : '#dc2626',
    surface: resolvedTheme === 'dark' ? '#1e293b' : '#f8fafc',
    card: resolvedTheme === 'dark' ? '#1e293b' : '#ffffff',
    cardSecondary: resolvedTheme === 'dark' ? '#334155' : '#f8fafc',
    border: resolvedTheme === 'dark' ? '#475569' : '#e2e8f0',
    overlay: 'rgba(0, 0, 0, 0.6)',
    textPrimary: textColor,
    textSecondary: resolvedTheme === 'dark' ? '#94a3b8' : '#64748b',
  };

  // State management
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rateLimit, setRateLimit] = useState<RateLimitInfo>({ attempts: 0, lastAttempt: 0, blocked: false });
  const [networkError, setNetworkError] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  // Add state for delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  
  // Refs
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);
  const emailInputRef = useRef<TextInput>(null);

  // Rate limiting constants
  const MAX_ATTEMPTS = 5;
  const BLOCK_DURATION = 15 * 60 * 1000; // 15 minutes

  // 1. Add a single mode state
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot' | 'account'>('login');

  // 2. When session is present and modal is opened, switch to 'account' mode
  useEffect(() => {
    if (visible) {
      if (session) setMode('account');
      else setMode('login');
    }
  }, [visible, session]);

  // 3. Reset errors and fields when switching mode
  useEffect(() => {
    setValidationErrors({});
    setSuccessMsg('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setIsEmailVerified(false);
  }, [mode]);

  useEffect(() => {
    if (visible) {
      checkAuthStatus();
      setupAuthListener();
    }
  }, [visible]);

  // Track previous session to only auto-close on new login/signup
  const prevSessionRef = useRef<Session | null>(null);
  useEffect(() => {
    // Only close if session changed from null to a value (new login/signup)
    if (!prevSessionRef.current && session && visible) {
      setSuccessMsg('Email verified! Logging you in...');
      if (onAuthSuccess) onAuthSuccess(session);
      setTimeout(() => {
        resetAuthState();
        onClose();
      }, 1200);
    }
    prevSessionRef.current = session;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, visible]);

  const checkAuthStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      // Don't call onAuthSuccess here as it will close the modal immediately
      // Only call onAuthSuccess when there's a new sign-in event
    } catch (error) {
      console.error('Error checking auth status:', error);
      setNetworkError(true);
    }
  };

  const setupAuthListener = () => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change:', event, 'session:', !!session);
      
      if (event === 'SIGNED_IN' && session && onAuthSuccess) {
        setSession(session);
        onAuthSuccess(session);
        resetAuthState();
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
      } else if (event === 'TOKEN_REFRESHED') {
        setSession(session);
      }
    });

    return () => subscription.unsubscribe();
  };

  const resetAuthState = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setValidationErrors({});
    setSuccessMsg('');
    setLoading(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setNetworkError(false);
    setIsEmailVerified(false);
  };

  const validateEmail = (email: string): string | undefined => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) return 'Email is required';
    if (!emailRegex.test(email)) return 'Please enter a valid email address';
    return undefined;
  };

  const validatePassword = (password: string, isSignUp: boolean): string | undefined => {
    if (!password) return 'Password is required';
    if (isSignUp) {
      if (password.length < 8) return 'Password must be at least 8 characters';
      if (!/(?=.*[a-z])/.test(password)) return 'Password must contain at least one lowercase letter';
      if (!/(?=.*[A-Z])/.test(password)) return 'Password must contain at least one uppercase letter';
      if (!/(?=.*\d)/.test(password)) return 'Password must contain at least one number';
    }
    return undefined;
  };

  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};
    
    const emailError = validateEmail(email);
    if (emailError) errors.email = emailError;
    
    const passwordError = validatePassword(password, isSignUp);
    if (passwordError) errors.password = passwordError;
    
    if (isSignUp && password !== confirmPassword) {
      errors.password = 'Passwords do not match';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const checkRateLimit = (): boolean => {
    const now = Date.now();
    
    // Reset if block duration has passed
    if (rateLimit.blocked && (now - rateLimit.lastAttempt) > BLOCK_DURATION) {
      setRateLimit({ attempts: 0, lastAttempt: 0, blocked: false });
      return true;
    }
    
    // Check if blocked
    if (rateLimit.blocked) {
      const remainingTime = Math.ceil((BLOCK_DURATION - (now - rateLimit.lastAttempt)) / 1000 / 60);
      setValidationErrors({
        general: `Too many attempts. Please try again in ${remainingTime} minutes.`
      });
      return false;
    }
    
    return true;
  };

  const updateRateLimit = () => {
    const now = Date.now();
    const newAttempts = rateLimit.attempts + 1;
    const blocked = newAttempts >= MAX_ATTEMPTS;
    
    setRateLimit({
      attempts: newAttempts,
      lastAttempt: now,
      blocked
    });
  };

  const handleClose = () => {
    if (!loading) {
      resetAuthState();
      onClose();
    }
  };

  const handleLogin = async () => {
    if (!validateForm() || !checkRateLimit()) return;

    setLoading(true);
    setValidationErrors({});
    setSuccessMsg('');
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        updateRateLimit();
        
        // Handle specific error cases
        switch (error.message) {
          case 'Invalid login credentials':
            setValidationErrors({ general: 'Invalid email or password. Please check your credentials.' });
            break;
          case 'Email not confirmed':
            setValidationErrors({ general: 'Please check your email and click the confirmation link before signing in.' });
            setIsEmailVerified(false);
            break;
          case 'Too many requests':
            setValidationErrors({ general: 'Too many login attempts. Please wait a few minutes before trying again.' });
            break;
          default:
            setValidationErrors({ general: error.message });
        }
      } else {
        setSuccessMsg('Login successful! Welcome back!');
        if (data.session && onAuthSuccess) {
          onAuthSuccess(data.session);
        }
        setTimeout(() => handleClose(), 1500);
      }
    } catch (error: any) {
      updateRateLimit();
      setValidationErrors({ 
        general: 'Network error. Please check your connection and try again.' 
      });
      setNetworkError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!validateForm() || !checkRateLimit()) return;

    setLoading(true);
    setValidationErrors({});
    setSuccessMsg('');
    
    try {
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          emailRedirectTo: 'bookiq://auth-callback'
        }
      });
      
      if (error) {
        updateRateLimit();
        
        switch (error.message) {
          case 'User already registered':
            setValidationErrors({ email: 'An account with this email already exists. Please sign in instead.' });
            break;
          case 'Password should be at least 6 characters':
            setValidationErrors({ password: 'Password must be at least 8 characters long.' });
            break;
          default:
            setValidationErrors({ general: error.message });
        }
      } else {
        if (data.session) {
          // Auto-confirmed account
          setSuccessMsg('Account created successfully! Welcome to BookIQ!');
          if (onAuthSuccess) {
            onAuthSuccess(data.session);
          }
          setTimeout(() => handleClose(), 1500);
        } else {
          // Email confirmation required
          setSuccessMsg('Account created! Please check your email and click the confirmation link to activate your account.');
          setIsEmailVerified(false);
        }
      }
    } catch (error: any) {
      updateRateLimit();
      setValidationErrors({ 
        general: 'Network error. Please check your connection and try again.' 
      });
      setNetworkError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const emailError = validateEmail(email);
    if (emailError) {
      setValidationErrors({ email: emailError });
      return;
    }

    if (!checkRateLimit()) return;

    setLoading(true);
    setValidationErrors({});
    setSuccessMsg('');
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'bookiq://auth-callback'
      });
      
      if (error) {
        updateRateLimit();
        setValidationErrors({ general: error.message });
      } else {
        setSuccessMsg('Password reset email sent! Please check your inbox and follow the instructions.');
      }
    } catch (error: any) {
      updateRateLimit();
      setValidationErrors({ 
        general: 'Network error. Please check your connection and try again.' 
      });
      setNetworkError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!checkRateLimit()) return;

    setLoading(true);
    setValidationErrors({});
    setSuccessMsg('');
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({ 
        provider: 'google',
        options: {
          redirectTo: 'bookiq://auth-callback',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      });
      
      if (error) {
        updateRateLimit();
        setValidationErrors({ general: error.message });
      } else {
        setSuccessMsg('Redirecting to Google...');
      }
    } catch (error: any) {
      updateRateLimit();
      setValidationErrors({ 
        general: 'Network error. Please check your connection and try again.' 
      });
      setNetworkError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        Alert.alert('Error', 'Failed to sign out. Please try again.');
      } else {
        setSession(null);
        handleClose();
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resendConfirmationEmail = async () => {
    if (!email) {
      setValidationErrors({ email: 'Please enter your email address first.' });
      return;
    }

    setLoading(true);
    setValidationErrors({});
    
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: 'bookiq://auth-callback'
        }
      });
      
      if (error) {
        setValidationErrors({ general: error.message });
      } else {
        setSuccessMsg('Confirmation email resent! Please check your inbox.');
      }
    } catch (error: any) {
      setValidationErrors({ 
        general: 'Network error. Please check your connection and try again.' 
      });
    } finally {
      setLoading(false);
    }
  };

  // Add delete account handler (client-safe)
  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      // This requires a Supabase Edge Function called 'delete-user' with admin privileges
      const { error } = await supabase.functions.invoke('delete-user', { body: { userId: session?.user.id } });
      if (error) {
        Alert.alert('Error', error.message);
      } else {
        setSession(null);
        setShowDeleteConfirm(false);
        handleClose();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to delete account.');
    } finally {
      setDeletingAccount(false);
    }
  };

  const renderErrorBanner = () => {
    if (validationErrors.general) {
      return (
        <View style={[styles.errorBanner, { backgroundColor: colors.danger + '20' }]}>
          <Ionicons name="alert-circle" size={16} color={colors.danger} />
          <Text style={[styles.errorText, { color: colors.danger }]}>
            {validationErrors.general}
          </Text>
        </View>
      );
    }
    return null;
  };

  const renderSuccessBanner = () => {
    if (successMsg) {
      return (
        <View style={[styles.successBanner, { backgroundColor: colors.success + '20' }]}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={[styles.successText, { color: colors.success }]}>
            {successMsg}
          </Text>
        </View>
      );
    }
    return null;
  };

  const renderNetworkErrorBanner = () => {
    if (networkError) {
      return (
        <View style={[styles.warningBanner, { backgroundColor: colors.warning + '20' }]}>
          <Ionicons name="wifi-outline" size={16} color={colors.warning} />
          <Text style={[styles.warningText, { color: colors.warning }]}>
            Network connection issue detected. Please check your internet connection.
          </Text>
        </View>
      );
    }
    return null;
  };

  const renderInputField = (
    icon: string,
    placeholder: string,
    value: string,
    onChangeText: (text: string) => void,
    secureTextEntry?: boolean,
    showPasswordToggle?: boolean,
    error?: string,
    ref?: React.RefObject<TextInput | null>,
    returnKeyType?: 'next' | 'done',
    onSubmitEditing?: () => void,
    autoCapitalize?: 'none' | 'sentences',
    keyboardType?: 'default' | 'email-address'
  ) => (
    <View style={styles.inputWrapper}>
      <View style={[
        styles.inputContainer,
        error && { borderColor: colors.danger }
      ]}>
        <Ionicons name={icon as any} size={20} color={colors.textSecondary} style={styles.inputIcon} />
        <TextInput
          ref={ref}
          style={[styles.input, { color: colors.textPrimary }]}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          editable={!loading}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
        />
        {showPasswordToggle && (
          <TouchableOpacity
            style={styles.showHideBtn}
            onPress={() => {
              if (placeholder.toLowerCase().includes('confirm')) {
                setShowConfirmPassword(!showConfirmPassword);
              } else {
                setShowPassword(!showPassword);
              }
            }}
            disabled={loading}
          >
            <Ionicons 
              name={(placeholder.toLowerCase().includes('confirm') ? showConfirmPassword : showPassword) ? "eye-off-outline" : "eye-outline"} 
              size={20} 
              color={colors.textSecondary} 
            />
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <Text style={[styles.fieldError, { color: colors.danger }]}>
          {error}
        </Text>
      )}
    </View>
  );

  // 4. UI: Segmented control for login/signup
  const renderAuthTabs = () => (
    <View style={{ flexDirection: 'row', marginBottom: 24, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.cardSecondary }}>
      {['login', 'signup'].map((tab) => (
        <TouchableOpacity
          key={tab}
          style={{ flex: 1, paddingVertical: 12, backgroundColor: mode === tab ? colors.primary : 'transparent', alignItems: 'center' }}
          onPress={() => setMode(tab as 'login' | 'signup')}
          disabled={loading}
        >
          <Text style={{ color: mode === tab ? '#fff' : colors.textPrimary, fontWeight: '600' }}>{tab === 'login' ? 'Sign In' : 'Sign Up'}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // Move renderProfileSection above renderContent so it is defined before use
  const renderProfileSection = () => (
    <View style={[styles.profileContainer, { backgroundColor: colors.cardSecondary, borderRadius: 16, padding: 20, marginTop: 16 }]}> 
      <View style={styles.profileHeader}>
        <View style={[styles.avatarContainer, { backgroundColor: colors.primary }]}> 
          {session?.user?.user_metadata?.avatar_url ? (
            <Image 
              source={{ uri: session.user.user_metadata.avatar_url }} 
              style={styles.avatar} 
            />
          ) : (
            <Text style={styles.avatarText}>
              {session?.user?.email?.charAt(0).toUpperCase() || 'U'}
            </Text>
          )}
        </View>
        <View style={styles.profileInfo}>
          <Text style={[styles.profileName, { color: colors.textPrimary }]}> 
            {session?.user?.user_metadata?.full_name || 'User'}
          </Text>
          <Text style={[styles.profileEmail, { color: colors.textSecondary }]}> 
            {session?.user?.email}
          </Text>
          <View style={styles.verificationStatus}>
            <Ionicons 
              name={session?.user?.email_confirmed_at ? "checkmark-circle" : "alert-circle"} 
              size={16} 
              color={session?.user?.email_confirmed_at ? colors.success : colors.warning} 
            />
            <Text style={[styles.verificationText, { color: session?.user?.email_confirmed_at ? colors.success : colors.warning }]}> 
              {session?.user?.email_confirmed_at ? 'Email Verified' : 'Email Not Verified'}
            </Text>
          </View>
        </View>
      </View>
      <TouchableOpacity 
        style={[styles.logoutButton, { backgroundColor: colors.danger, marginTop: 16 }]} 
        onPress={handleLogout}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <>
            <Ionicons name="log-out-outline" size={20} color="#ffffff" />
            <Text style={styles.logoutButtonText}>Sign Out</Text>
          </>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.deleteButton, { marginTop: 12, borderColor: colors.danger }]}
        onPress={() => setShowDeleteConfirm(true)}
        disabled={deletingAccount}
        activeOpacity={0.8}
      >
        <Ionicons name="trash-outline" size={18} color={colors.danger} />
        <Text style={[styles.deleteButtonText, { color: colors.danger }]}>Delete Account</Text>
      </TouchableOpacity>
      {/* Delete confirmation modal */}
      <Modal
        visible={showDeleteConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalContent}>
            <Ionicons name="warning-outline" size={36} color={colors.danger} style={{ marginBottom: 12 }} />
            <Text style={[styles.deleteModalTitle, { color: colors.danger }]}>Delete Account?</Text>
            <Text style={[styles.deleteModalText, { color: colors.textSecondary }]}>This action is irreversible. Are you sure you want to delete your account?</Text>
            <View style={{ flexDirection: 'row', marginTop: 20 }}>
              <TouchableOpacity
                style={[styles.deleteModalBtn, { backgroundColor: colors.danger, marginRight: 8 }]}
                onPress={handleDeleteAccount}
                disabled={deletingAccount}
              >
                {deletingAccount ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '600' }}>Delete</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteModalBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}
                onPress={() => setShowDeleteConfirm(false)}
                disabled={deletingAccount}
              >
                <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );

  // 5. Render login/signup/forgot/account forms based on mode
  const renderContent = () => {
    if (mode === 'account') return renderProfileSection();
    return (
      <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={[styles.formTitle, { color: colors.textPrimary }]}>BookIQ {mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Sign Up' : 'Reset Password'}</Text>
        <Text style={[styles.formSubtitle, { color: colors.textSecondary }]}> 
          {mode === 'login' && 'Sign in to continue your learning journey'}
          {mode === 'signup' && 'Create an account to get started'}
          {mode === 'forgot' && 'Enter your email to receive a reset link'}
        </Text>
        {renderNetworkErrorBanner()}
        {renderErrorBanner()}
        {renderSuccessBanner()}
        {renderInputField('mail-outline', 'Email address', email, setEmail, false, false, validationErrors.email, emailInputRef, 'next', () => passwordInputRef.current?.focus(), 'none', 'email-address')}
        {(mode === 'login' || mode === 'signup') && renderInputField('lock-closed-outline', 'Password', password, setPassword, !showPassword, true, validationErrors.password, passwordInputRef, mode === 'signup' ? 'next' : 'done', () => mode === 'signup' && confirmPasswordInputRef.current?.focus())}
        {mode === 'signup' && renderInputField('lock-closed-outline', 'Confirm Password', confirmPassword, setConfirmPassword, !showConfirmPassword, true, validationErrors.password, confirmPasswordInputRef, 'done')}
        <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }, loading && { opacity: 0.7 }]} onPress={mode === 'forgot' ? handleForgotPassword : mode === 'signup' ? handleSignUp : handleLogin} disabled={loading} activeOpacity={0.8}>
          {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryButtonText}>{mode === 'forgot' ? 'Send Reset Email' : mode === 'signup' ? 'Create Account' : 'Sign In'}</Text>}
        </TouchableOpacity>
        {mode !== 'forgot' && (
          <View style={styles.dividerContainer}>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textSecondary }]}>or</Text>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          </View>
        )}
        {mode !== 'forgot' && (
          <TouchableOpacity style={[styles.googleButton, { backgroundColor: colors.cardSecondary, borderColor: colors.border }, loading && { opacity: 0.7 }]} onPress={handleGoogleLogin} disabled={loading} activeOpacity={0.8}>
            <Ionicons name="logo-google" size={20} color="#4285F4" />
            <Text style={[styles.googleButtonText, { color: colors.textPrimary }]}>Continue with Google</Text>
          </TouchableOpacity>
        )}
        {mode === 'signup' && !isEmailVerified && successMsg && (
          <TouchableOpacity style={[styles.resendButton, { borderColor: colors.primary }]} onPress={resendConfirmationEmail} disabled={loading}>
            <Text style={[styles.resendButtonText, { color: colors.primary }]}>Resend Confirmation Email</Text>
          </TouchableOpacity>
        )}
        <View style={styles.switchContainer}>
          {mode === 'login' && (
            <TouchableOpacity onPress={() => setMode('forgot')} disabled={loading} activeOpacity={0.7}>
              <Text style={[styles.switchText, { color: colors.primary }]}>Forgot Password?</Text>
            </TouchableOpacity>
          )}
          {mode === 'forgot' && (
            <TouchableOpacity onPress={() => setMode('login')} disabled={loading} activeOpacity={0.7}>
              <Text style={[styles.switchText, { color: colors.primary }]}>Back to Sign In</Text>
            </TouchableOpacity>
          )}
          {mode !== 'forgot' && (
            <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'signup' : 'login')} disabled={loading} activeOpacity={0.7}>
              <Text style={[styles.switchText, { color: colors.primary }]}>{mode === 'login' ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    );
  };

  // 6. In the modal, show tabs and content
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]}> 
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}> 
            <View style={styles.header}>
              <TouchableOpacity style={styles.closeButton} onPress={handleClose} disabled={loading} activeOpacity={0.7}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{mode === 'account' ? 'Account' : 'Authentication'}</Text>
              <View style={styles.placeholder} />
            </View>
            {mode === 'login' || mode === 'signup' ? renderAuthTabs() : null}
            {renderContent()}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: screenWidth * 0.9,
    maxWidth: 400,
    borderRadius: 24,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  placeholder: {
    width: 32,
  },
  
  // Auth Form
  formContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  inputWrapper: {
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  inputIcon: {
    position: 'absolute',
    left: 16,
    zIndex: 1,
  },
  input: {
    flex: 1,
    paddingHorizontal: 48,
    paddingVertical: 16,
    fontSize: 16,
  },
  showHideBtn: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
  fieldError: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  googleButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
  },
  resendButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  resendButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  switchContainer: {
    alignItems: 'center',
  },
  switchText: {
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  successText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  warningText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  
  // Profile Section
  profileContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 16,
    marginBottom: 8,
  },
  verificationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verificationText: {
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  logoutButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 4,
  },
  deleteButtonText: {
    marginLeft: 8,
    fontSize: 15,
    fontWeight: '600',
  },
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    width: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  deleteModalText: {
    fontSize: 15,
    textAlign: 'center',
  },
  deleteModalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AuthModal; 