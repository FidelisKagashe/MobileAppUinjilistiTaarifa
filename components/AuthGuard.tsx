// app/(auth)/AuthGuard.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lock, Fingerprint, Eye, EyeOff, User, Phone } from 'lucide-react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DataService } from '@/services/DataService';
import { LanguageService } from '@/services/LanguageService';
import { UserProfile } from '@/types/Report';
import { useTheme } from '@/app/providers/ThemeProvider';

interface AuthGuardProps {
  children: React.ReactNode;
}

const FAILED_ATTEMPTS_KEY = '@auth_failed_attempts';
const LOCK_UNTIL_KEY = '@auth_lock_until';
const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 60 * 1000; // 1 minute

export default function AuthGuard({ children }: AuthGuardProps) {
  const { theme } = useTheme();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [authMethod, setAuthMethod] = useState<'password' | 'biometric'>('password');
  const [currentLanguage, setCurrentLanguage] = useState<'sw' | 'en'>('sw');

  // New states for attempts & lockout
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState<number | null>(null); // timestamp in ms
  const [lockRemainingSec, setLockRemainingSec] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const lockTimerRef = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      await checkAuthStatus();
      await checkBiometricAvailability();
      await loadLanguage();
      await loadAttemptState();
    })();

    return () => {
      if (lockTimerRef.current) {
        clearInterval(lockTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // start / stop countdown when lockUntil changes
  useEffect(() => {
    if (lockTimerRef.current) {
      clearInterval(lockTimerRef.current);
      lockTimerRef.current = null;
    }

    if (lockUntil && lockUntil > Date.now()) {
      updateLockRemaining();
      lockTimerRef.current = setInterval(updateLockRemaining, 1000) as unknown as number;
    } else if (lockUntil && lockUntil <= Date.now()) {
      // lock expired - clear
      clearLock();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockUntil]);

  const updateLockRemaining = () => {
    if (!lockUntil) {
      setLockRemainingSec(0);
      return;
    }
    const remaining = Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000));
    setLockRemainingSec(remaining);
    if (remaining <= 0) {
      clearLock();
    }
  };

  const loadLanguage = async () => {
    try {
      await LanguageService.initialize();
      const lang = LanguageService.getCurrentLanguage();
      setCurrentLanguage(lang);
    } catch (error) {
      console.error('Language loading error:', error);
    }
  };

  const checkAuthStatus = async () => {
    await DataService.initialize();
    const hasPassword = await DataService.hasPassword();
    const hasProfile = await DataService.hasUserProfile();

    setIsFirstTime(!hasPassword);
    setNeedsProfile(!hasProfile);
  };

  const checkBiometricAvailability = async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(compatible && enrolled);
    } catch (e) {
      setBiometricAvailable(false);
    }
  };

  const loadAttemptState = async () => {
    try {
      const attemptsStr = await AsyncStorage.getItem(FAILED_ATTEMPTS_KEY);
      const lockUntilStr = await AsyncStorage.getItem(LOCK_UNTIL_KEY);

      const attempts = attemptsStr ? parseInt(attemptsStr, 10) || 0 : 0;
      const lockTs = lockUntilStr ? parseInt(lockUntilStr, 10) || null : null;

      setFailedAttempts(attempts || 0);

      if (lockTs && lockTs > Date.now()) {
        setLockUntil(lockTs);
      } else {
        // clear stale lock if any
        await AsyncStorage.removeItem(LOCK_UNTIL_KEY);
      }
    } catch (error) {
      console.warn('loadAttemptState error', error);
    }
  };

  const persistAttempts = async (attempts: number) => {
    try {
      await AsyncStorage.setItem(FAILED_ATTEMPTS_KEY, String(attempts));
    } catch (e) {
      console.warn('persistAttempts error', e);
    }
  };

  const persistLockUntil = async (ts: number | null) => {
    try {
      if (ts) {
        await AsyncStorage.setItem(LOCK_UNTIL_KEY, String(ts));
      } else {
        await AsyncStorage.removeItem(LOCK_UNTIL_KEY);
      }
    } catch (e) {
      console.warn('persistLockUntil error', e);
    }
  };

  const clearLock = async () => {
    if (lockTimerRef.current) {
      clearInterval(lockTimerRef.current);
      lockTimerRef.current = null;
    }
    setLockUntil(null);
    setLockRemainingSec(0);
    setFailedAttempts(0);
    setErrorMessage(null);
    await persistAttempts(0);
    await persistLockUntil(null);
  };

  const handleBiometricAuth = async () => {
    if (lockUntil && lockUntil > Date.now()) {
      // If locked, don't allow biometric either
      setErrorMessage(
        currentLanguage === 'sw'
          ? `Umefungwa kwa muda. Jaribu tena baada ya ${lockRemainingSec}s`
          : `Temporarily locked. Try again in ${lockRemainingSec}s`
      );
      return;
    }

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: currentLanguage === 'sw'
          ? 'Thibitisha kuingia DODOMA CTF'
          : 'Authenticate to access DODOMA CTF',
        fallbackLabel: currentLanguage === 'sw' ? 'Tumia password' : 'Use password',
        // @ts-ignore - expo type differences
        cancelLabel: currentLanguage === 'sw' ? 'Ghairi' : 'Cancel',
      });

      if (result.success) {
        // reset attempts on success
        await persistAttempts(0);
        setFailedAttempts(0);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Biometric authentication error:', error);
      Alert.alert(
        currentLanguage === 'sw' ? 'Hitilafu' : 'Error',
        currentLanguage === 'sw' ? 'Imeshindwa kuthibitisha. Jaribu tena.' : 'Authentication failed. Please try again.'
      );
    }
  };

  const handleSetupComplete = async () => {
    if (isFirstTime) {
      if (password !== confirmPassword) {
        Alert.alert(
          currentLanguage === 'sw' ? 'Hitilafu' : 'Error',
          currentLanguage === 'sw' ? 'Password hazifanani' : 'Passwords do not match'
        );
        return;
      }
      if (password.length < 4) {
        Alert.alert(
          currentLanguage === 'sw' ? 'Hitilafu' : 'Error',
          currentLanguage === 'sw' ? 'Password lazima iwe angalau herufi 4' : 'Password must be at least 4 characters'
        );
        return;
      }
    }

    if (needsProfile) {
      if (!fullName.trim()) {
        Alert.alert(
          currentLanguage === 'sw' ? 'Hitilafu' : 'Error',
          currentLanguage === 'sw' ? 'Jina kamili linahitajika' : 'Full name is required'
        );
        return;
      }
      if (!phoneNumber.trim()) {
        Alert.alert(
          currentLanguage === 'sw' ? 'Hitilafu' : 'Error',
          currentLanguage === 'sw' ? 'Namba ya simu inahitajika' : 'Phone number is required'
        );
        return;
      }
    }

    setLoading(true);
    try {
      if (isFirstTime) {
        await DataService.setPassword(password);
      }

      if (needsProfile) {
        const profile: UserProfile = {
          id: Date.now().toString(),
          fullName: fullName.trim(),
          phoneNumber: phoneNumber.trim(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await DataService.saveUserProfile(profile);
      }

      await DataService.updateSettings({
        authMethod,
        biometricEnabled: authMethod === 'biometric' && biometricAvailable
      });

      // setup complete - clear attempt state
      await clearLock();
      setIsAuthenticated(true);
    } catch (error) {
      Alert.alert(
        currentLanguage === 'sw' ? 'Hitilafu' : 'Error',
        currentLanguage === 'sw' ? 'Imeshindwa kusave taarifa. Jaribu tena.' : 'Failed to save information. Please try again.'
      );
      console.error('Setup error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordAuth = async () => {
    // If locked, show message and prevent attempts
    if (lockUntil && lockUntil > Date.now()) {
      setErrorMessage(
        currentLanguage === 'sw'
          ? `Umefungwa kwa muda. Jaribu tena baada ya ${lockRemainingSec}s`
          : `Temporarily locked. Try again in ${lockRemainingSec}s`
      );
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const isValid = await DataService.verifyPassword(password);
      if (isValid) {
        // success -> reset attempts and proceed
        await persistAttempts(0);
        await persistLockUntil(null);
        setFailedAttempts(0);
        setIsAuthenticated(true);
      } else {
        // incorrect password -> increment attempts
        const nextAttempts = failedAttempts + 1;
        setFailedAttempts(nextAttempts);
        await persistAttempts(nextAttempts);

        const attemptsLeft = Math.max(0, MAX_ATTEMPTS - nextAttempts);

        // show inline message
        if (nextAttempts >= MAX_ATTEMPTS) {
          const until = Date.now() + LOCK_DURATION_MS;
          setLockUntil(until);
          await persistLockUntil(until);
          setErrorMessage(
            currentLanguage === 'sw'
              ? `Umejaribu kuingia vibaya mara ${MAX_ATTEMPTS}. Jaribu tena baada ya dakika 1.`
              : `Too many failed attempts (${MAX_ATTEMPTS}). Try again in 1 minute.`
          );
        } else {
          setErrorMessage(
            currentLanguage === 'sw'
              ? `Password si sahihi. Jaribu tena. Jaribio zilizobaki: ${attemptsLeft}`
              : `Incorrect password. Try again. Attempts left: ${attemptsLeft}`
          );
        }
      }
    } catch (error) {
      console.error('Password auth error', error);
      Alert.alert(
        currentLanguage === 'sw' ? 'Hitilafu' : 'Error',
        currentLanguage === 'sw' ? 'Imeshindwa kuthibitisha' : 'Authentication failed'
      );
    } finally {
      setLoading(false);
    }
  };

  // --- UI rendering ---

  if (isAuthenticated) {
    return <>{children}</>;
  }

  // First time setup or profile setup
  if (isFirstTime || needsProfile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.authContainer}>
          {/* Logo/Header */}
          <View style={styles.logoContainer}>
            <View style={[styles.logoCircle, { backgroundColor: theme.primary }]}>
              <Lock size={32} color="#ffffff" />
            </View>
            <Text style={[styles.appTitle, { color: theme.text }]}>DODOMA CTF 2025</Text>
            <Text style={[styles.appSubtitle, { color: theme.textSecondary }]}>
              {currentLanguage === 'sw' ? 'Mfumo wa Taarifa za Uuzaji' : 'Student Canvassing Report System'}
            </Text>
          </View>

          {/* Setup Form */}
          <View style={[styles.formContainer, { backgroundColor: theme.card }]}>
            <Text style={[styles.formTitle, { color: theme.text }]}>
              {isFirstTime ? 'Sanidi Usalama' : 'Kamili Wasifu Wako'}
            </Text>
            <Text style={[styles.formSubtitle, { color: theme.textSecondary }]}>
              {isFirstTime
                ? (currentLanguage === 'sw' ? 'Tengeneza password ili kulinda taarifa zako' : 'Create a password to protect your data')
                : (currentLanguage === 'sw' ? 'Ingiza taarifa zako za kibinafsi' : 'Enter your personal information')
              }
            </Text>

            {/* Profile Fields */}
            {needsProfile && (
              <>
                <View style={styles.inputContainer}>
                  <User size={20} color={theme.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                    placeholder={currentLanguage === 'sw' ? 'Jina kamili' : 'Full name'}
                    placeholderTextColor={theme.textSecondary}
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Phone size={20} color={theme.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                    placeholder={currentLanguage === 'sw' ? 'Namba ya simu (mfano: +255123456789)' : 'Phone number (e.g: +255123456789)'}
                    placeholderTextColor={theme.textSecondary}
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    keyboardType="phone-pad"
                  />
                </View>
              </>
            )}

            {/* Password Fields */}
            {isFirstTime && (
              <>
                <View style={styles.inputContainer}>
                  <Lock size={20} color={theme.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.passwordInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                    placeholder={currentLanguage === 'sw' ? 'Tengeneza password' : 'Create password'}
                    placeholderTextColor={theme.textSecondary}
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff size={20} color={theme.textSecondary} />
                    ) : (
                      <Eye size={20} color={theme.textSecondary} />
                    )}
                  </TouchableOpacity>
                </View>

                <View style={styles.inputContainer}>
                  <Lock size={20} color={theme.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                    placeholder={currentLanguage === 'sw' ? 'Thibitisha password' : 'Confirm password'}
                    placeholderTextColor={theme.textSecondary}
                    secureTextEntry={!showPassword}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    autoCapitalize="none"
                  />
                </View>

                {/* Authentication Method Selection */}
                {biometricAvailable && (
                  <View style={styles.authMethodContainer}>
                    <Text style={[styles.authMethodTitle, { color: theme.text }]}>
                      {currentLanguage === 'sw' ? 'Chagua njia ya kuingia:' : 'Choose login method:'}
                    </Text>
                    <View style={styles.authMethodButtons}>
                      <TouchableOpacity
                        style={[
                          styles.authMethodButton,
                          { borderColor: theme.primary, backgroundColor: authMethod === 'password' ? theme.primary : theme.surface }
                        ]}
                        onPress={() => setAuthMethod('password')}
                      >
                        <Lock size={20} color={authMethod === 'password' ? '#ffffff' : theme.primary} />
                        <Text style={[
                          styles.authMethodText,
                          { color: authMethod === 'password' ? '#ffffff' : theme.primary }
                        ]}>Password</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.authMethodButton,
                          { borderColor: theme.primary, backgroundColor: authMethod === 'biometric' ? theme.primary : theme.surface }
                        ]}
                        onPress={() => setAuthMethod('biometric')}
                      >
                        <Fingerprint size={20} color={authMethod === 'biometric' ? '#ffffff' : theme.primary} />
                        <Text style={[
                          styles.authMethodText,
                          { color: authMethod === 'biometric' ? '#ffffff' : theme.primary }
                        ]}>Fingerprint</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </>
            )}

            <TouchableOpacity
              style={[styles.authButton, { backgroundColor: loading ? theme.textSecondary : theme.primary }]}
              onPress={handleSetupComplete}
              disabled={loading}
            >
              <Text style={[styles.authButtonText, { color: '#ffffff' }]}>
                {loading
                  ? (currentLanguage === 'sw' ? 'Inahifadhi...' : 'Saving...')
                  : (currentLanguage === 'sw' ? 'Kamili Usanidi' : 'Complete Setup')
                }
              </Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>
              {currentLanguage === 'sw' ? 'Salama • Offline • Imara' : 'Secure • Offline • Reliable'}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Login screen
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.authContainer}>
        {/* Logo/Header */}
        <View style={styles.logoContainer}>
          <View style={[styles.logoCircle, { backgroundColor: theme.primary }]}>
            <Lock size={32} color="#ffffff" />
          </View>
          <Text style={[styles.appTitle, { color: theme.text }]}>DODOMA CTF 2025</Text>
          <Text style={[styles.appSubtitle, { color: theme.textSecondary }]}>
            {currentLanguage === 'sw' ? 'Mfumo wa Taarifa za Uuzaji' : 'Student Canvassing Report System'}
          </Text>
        </View>

        {/* Authentication Form */}
        <View style={[styles.formContainer, { backgroundColor: theme.card }]}>
          <Text style={[styles.formTitle, { color: theme.text }]}>
            {currentLanguage === 'sw' ? 'Ingia kwenye Mfumo' : 'Login to System'}
          </Text>
          <Text style={[styles.formSubtitle, { color: theme.textSecondary }]}>
            {currentLanguage === 'sw'
              ? 'Ingiza password yako ili kufikia programu'
              : 'Enter your password to access the app'
            }
          </Text>

          <View style={styles.inputContainer}>
            <Lock size={20} color={theme.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.passwordInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
              placeholder={currentLanguage === 'sw' ? 'Ingiza password' : 'Enter password'}
              placeholderTextColor={theme.textSecondary}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              editable={!lockUntil || lockUntil <= Date.now()}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword(!showPassword)}
              disabled={Boolean(lockUntil && lockUntil > Date.now())}
            >
              {showPassword ? (
                <EyeOff size={20} color={theme.textSecondary} />
              ) : (
                <Eye size={20} color={theme.textSecondary} />
              )}
            </TouchableOpacity>
          </View>

          {/* inline error / attempts / lock message */}
          {errorMessage ? (
            <Text style={[styles.inlineError, { color: theme.error }]}>{errorMessage}</Text>
          ) : failedAttempts > 0 ? (
            <Text style={[styles.inlineError, { color: theme.textSecondary }]}>
              {currentLanguage === 'sw'
                ? `Jaribio zilizofanywa: ${failedAttempts} / ${MAX_ATTEMPTS}`
                : `Attempts: ${failedAttempts} / ${MAX_ATTEMPTS}`}
            </Text>
          ) : null}

          {/* If currently locked, show countdown */}
          {lockUntil && lockUntil > Date.now() && (
            <Text style={[styles.inlineError, { color: theme.error }]}>
              {currentLanguage === 'sw'
                ? `Umefungwa kwa muda. Jaribu tena baada ya ${lockRemainingSec}s`
                : `Temporarily locked. Try again in ${lockRemainingSec}s`}
            </Text>
          )}

          <TouchableOpacity
            style={[styles.authButton, { backgroundColor: loading ? theme.textSecondary : theme.primary }]}
            onPress={handlePasswordAuth}
            disabled={loading || Boolean(lockUntil && lockUntil > Date.now())}
          >
            <Text style={[styles.authButtonText, { color: '#ffffff' }]}>
              {loading
                ? (currentLanguage === 'sw' ? 'Inathibitisha...' : 'Authenticating...')
                : (currentLanguage === 'sw' ? 'Ingia' : 'Login')
              }
            </Text>
          </TouchableOpacity>

          {biometricAvailable && (
            <>
              <View style={styles.divider}>
                <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                <Text style={[styles.dividerText, { color: theme.textSecondary }]}>
                  {currentLanguage === 'sw' ? 'AU' : 'OR'}
                </Text>
                <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
              </View>

              <TouchableOpacity
                style={[styles.biometricButton, { backgroundColor: theme.primary + '20', borderColor: theme.primary }]}
                onPress={handleBiometricAuth}
                disabled={Boolean(lockUntil && lockUntil > Date.now())}
              >
                <Fingerprint size={20} color={theme.primary} />
                <Text style={[styles.biometricButtonText, { color: theme.primary }]}>
                  {currentLanguage === 'sw' ? 'Tumia Fingerprint' : 'Use Fingerprint'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>
            {currentLanguage === 'sw' ? 'Salama • Offline • Imara' : 'Secure • Offline • Reliable'}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 32,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  appSubtitle: {
    fontSize: 16,
  },
  formContainer: {
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  formSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  inputContainer: {
    position: 'relative',
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: 16,
    zIndex: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    paddingLeft: 48,
    fontSize: 16,
    flex: 1,
  },
  passwordInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    paddingLeft: 48,
    paddingRight: 50,
    fontSize: 16,
    flex: 1,
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
  },
  authMethodContainer: {
    marginBottom: 16,
  },
  authMethodTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
  },
  authMethodButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  authMethodButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  authMethodText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  authButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 14,
    marginHorizontal: 16,
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  biometricButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  inlineError: {
    marginBottom: 8,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    marginTop: 32,
  },
  footerText: {
    fontSize: 14,
  },
});
