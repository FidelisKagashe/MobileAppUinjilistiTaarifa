// app/(auth)/AuthGuard.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Alert,
  Modal,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lock, Fingerprint, Eye, EyeOff, User, Phone } from 'lucide-react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DataService } from '@/services/DataService';
import { LanguageService } from '@/services/LanguageService';
import { UserProfile, WorkWeekInfo } from '@/types/Report';
import { useTheme } from '@/app/providers/ThemeProvider';
import { router } from 'expo-router';

interface AuthGuardProps {
  children: React.ReactNode;
}

const FAILED_ATTEMPTS_KEY = '@auth_failed_attempts';
const LOCK_UNTIL_KEY = '@auth_lock_until';
const FORCE_RELOGIN_KEY = '@auth_force_relogin'; // when set, biometric login is disabled until password is used
const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 60 * 1000; // 1 minute

// Developer fallback only for support (kept intentionally)
const DEVELOPER_FALLBACK = '147825@HazinaYaVitabu';

export default function AuthGuard({ children }: AuthGuardProps) {
  const { theme } = useTheme();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState(''); // used for password or PIN input
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

  // lock/attempts
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState<number | null>(null); // timestamp in ms
  const [lockRemainingSec, setLockRemainingSec] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // require password flag (set after an explicit logout/clear action)
  const [requirePassword, setRequirePassword] = useState(false);

  // first-time flow helpers
  const [showFirstTimeWelcome, setShowFirstTimeWelcome] = useState(false);
  const [workWeekInfo, setWorkWeekInfo] = useState<WorkWeekInfo | null>(null);
  const [authMethodSelection, setAuthMethodSelection] = useState<'password' | 'pin' | 'pattern' | 'biometric'>('password');
  const [pinCode, setPinCode] = useState('');
  const [confirmPinCode, setConfirmPinCode] = useState('');
  const [patternPoints, setPatternPoints] = useState<number[]>([]);
  const [confirmPatternPoints, setConfirmPatternPoints] = useState<number[]>([]);

  // instructions & recovery UI
  const [showInstructions, setShowInstructions] = useState(true); // show instructions before filling form (for first time)
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotCodeInput, setForgotCodeInput] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  // errors & inline feedback
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const lockTimerRef = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      await DataService.initialize();
      await loadLanguage();
      await checkAuthStatus();
      await checkBiometricAvailability();
      await loadAttemptState();

      // Load force-relogin flag - if set, demand password and disable biometric until password used
      try {
        const fr = await AsyncStorage.getItem(FORCE_RELOGIN_KEY);
        if (fr === '1') {
          setRequirePassword(true);
          setErrorMessage(
            LanguageService.getCurrentLanguage() === 'sw'
              ? 'Tafadhali tumia password — umefutwa/kutoka mfumo.'
              : 'Please use password — app was force-logged out.'
          );
        }
      } catch (e) {
        // ignore storage read errors
        console.warn('Failed reading FORCE_RELOGIN_KEY', e);
      }
    })();

    return () => {
      if (lockTimerRef.current) {
        clearInterval(lockTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // lock countdown
  useEffect(() => {
    if (lockTimerRef.current) {
      clearInterval(lockTimerRef.current);
      lockTimerRef.current = null;
    }

    if (lockUntil && lockUntil > Date.now()) {
      updateLockRemaining();
      lockTimerRef.current = setInterval(updateLockRemaining, 1000) as unknown as number;
    } else if (lockUntil && lockUntil <= Date.now()) {
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
    if (remaining <= 0) clearLock();
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
    try {
      const hasPassword = await DataService.hasPassword();
      const hasProfile = await DataService.hasUserProfile();
      setIsFirstTime(!hasPassword);
      setNeedsProfile(!hasProfile);

      // show instructions for new users (only when first time or needs profile)
      setShowInstructions(!hasPassword || !hasProfile);

      // read settings authMethod (safe)
      try {
        const settings = await DataService.getSettings();
        if (settings && settings.authMethod) {
          const m = settings.authMethod as string;
          if (m === 'pin' || m === 'pattern' || m === 'biometric' || m === 'password') {
            setAuthMethod(m as any);
          }
        }
      } catch {
        // ignore
      }
    } catch (error) {
      console.error('checkAuthStatus error', error);
    }
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
      if (ts) await AsyncStorage.setItem(LOCK_UNTIL_KEY, String(ts));
      else await AsyncStorage.removeItem(LOCK_UNTIL_KEY);
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

  // --- First-time / Setup flow ---
  const handleSetupComplete = async () => {
    setErrors({});
    const newErrors: Record<string, string> = {};

    if (isFirstTime) {
      if (authMethodSelection === 'password') {
        if (!password) newErrors.password = currentLanguage === 'sw' ? 'Tafadhali ingiza password' : 'Please enter a password';
        else if (password.length < 4) newErrors.password = currentLanguage === 'sw' ? 'Password lazima iwe angalau herufi 4' : 'Password must be at least 4 characters';

        if (!confirmPassword) newErrors.confirmPassword = currentLanguage === 'sw' ? 'Tafadhali thibitisha password' : 'Please confirm password';
        else if (password && password !== confirmPassword) newErrors.confirmPassword = currentLanguage === 'sw' ? 'Password hazifanani' : 'Passwords do not match';
      }

      if (authMethodSelection === 'pin') {
        if (!pinCode) newErrors.pin = currentLanguage === 'sw' ? 'Tafadhali ingiza PIN' : 'Please enter a PIN';
        else if (pinCode.length < 4) newErrors.pin = currentLanguage === 'sw' ? 'PIN lazima iwe angalau namba 4' : 'PIN must be at least 4 digits';

        if (!confirmPinCode) newErrors.confirmPin = currentLanguage === 'sw' ? 'Tafadhali thibitisha PIN' : 'Please confirm PIN';
        else if (pinCode && pinCode !== confirmPinCode) newErrors.confirmPin = currentLanguage === 'sw' ? 'PIN hazifanani' : 'PINs do not match';
      }

      if (authMethodSelection === 'pattern') {
        if (!patternPoints || patternPoints.length < 4) newErrors.pattern = currentLanguage === 'sw' ? 'Mchoro lazima uwe na angalau nukta 4' : 'Pattern must have at least 4 points';
        else if (JSON.stringify(patternPoints) !== JSON.stringify(confirmPatternPoints)) newErrors.pattern = currentLanguage === 'sw' ? 'Michoro haifanani' : 'Patterns do not match';
      }
    }

    if (needsProfile) {
      if (!fullName.trim()) newErrors.fullName = currentLanguage === 'sw' ? 'Jina kamili linahitajika' : 'Full name is required';
      if (!phoneNumber.trim()) newErrors.phone = currentLanguage === 'sw' ? 'Namba ya simu inahitajika' : 'Phone number is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setErrorMessage(currentLanguage === 'sw' ? 'Tafadhali jaza sehemu zilizorudishwa' : 'Please fill the highlighted fields');
      return;
    }

    setLoading(true);

    try {
      // store auth value via DataService (keeps consistent storage)
      if (isFirstTime) {
        if (authMethodSelection === 'password') {
          await DataService.setAuthValue(password, 'password');
        } else if (authMethodSelection === 'pin') {
          await DataService.setAuthValue(pinCode, 'pin');
        } else if (authMethodSelection === 'pattern') {
          await DataService.setAuthValue(JSON.stringify(patternPoints), 'pattern');
        } else if (authMethodSelection === 'biometric') {
          // store empty fallback but mark method biometric
          await DataService.setAuthValue('', 'biometric');
        }
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
        authMethod: authMethodSelection as 'password' | 'biometric' | 'pattern' | 'pin',
        biometricEnabled: authMethod === 'biometric' && biometricAvailable,
        language: currentLanguage,
      });

      // set first use date if not already
      await DataService.setFirstUseDate();

      // generate recovery code centrally and store (DataService method)
      try {
        const rc = await DataService.generateAndStoreRecoveryCode();
        Alert.alert(
          currentLanguage === 'sw' ? 'Recovery Code — Andika Mahali Salama' : 'Recovery Code — Write It Down',
          currentLanguage === 'sw'
            ? `Hifadhi au andika code hii mahali salama. Iwapo utasahau password, tumia code hii kurejesha.\n\nCode: ${rc}`
            : `Save or write this code somewhere safe. If you forget your password you can use it to recover.\n\nCode: ${rc}`,
          [{ text: currentLanguage === 'sw' ? 'Sawa' : 'OK' }]
        );
      } catch (e) {
        // fallback: attempt to get stored (if generate failed)
        console.warn('generate recovery code failed', e);
      }

      // record first login if needed
      const isFirstLogin = await DataService.isFirstTimeLogin();
      if (isFirstLogin) {
        await DataService.recordFirstLogin();
        const weekInfo = await DataService.getCurrentWorkWeek();
        setWorkWeekInfo(weekInfo);
        setShowFirstTimeWelcome(true);

        // ensure flags reflect saved state so we don't loop
        await checkAuthStatus();
        setLoading(false);
        return;
      }

      // finalize: clear locks and mark authenticated
      await clearLock();
      await checkAuthStatus();
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Setup error:', error);
      Alert.alert(
        currentLanguage === 'sw' ? 'Hitilafu' : 'Error',
        currentLanguage === 'sw' ? 'Imeshindwa kusave taarifa. Jaribu tena.' : 'Failed to save information. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFirstTimeWelcomeComplete = () => {
    setShowFirstTimeWelcome(false);
    setIsAuthenticated(true);
  };

  // --- Login flow ---
  const handlePasswordAuth = async () => {
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
      const isValid = await DataService.verifyAuthValue(password);
      if (isValid) {
        // if a force-relogin flag was set, remove it now (user logged in with password)
        try {
          const fr = await AsyncStorage.getItem(FORCE_RELOGIN_KEY);
          if (fr === '1') {
            await AsyncStorage.removeItem(FORCE_RELOGIN_KEY);
            setRequirePassword(false);
          }
        } catch (e) {
          // ignore
        }

        await persistAttempts(0);
        await persistLockUntil(null);
        setFailedAttempts(0);
        setIsAuthenticated(true);

        // record first login if needed
        const isFirstLogin = await DataService.isFirstTimeLogin();
        if (isFirstLogin) {
          await DataService.recordFirstLogin();
        }
      } else {
        const nextAttempts = failedAttempts + 1;
        setFailedAttempts(nextAttempts);
        await persistAttempts(nextAttempts);
        const attemptsLeft = Math.max(0, MAX_ATTEMPTS - nextAttempts);

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
              : `Incorrect credential. Attempts left: ${attemptsLeft}`
          );
        }
      }
    } catch (error) {
      console.error('Auth error', error);
      Alert.alert(
        currentLanguage === 'sw' ? 'Hitilafu' : 'Error',
        currentLanguage === 'sw' ? 'Imeshindwa kuthibitisha' : 'Authentication failed'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricAuth = async () => {
    if (requirePassword) {
      setErrorMessage(
        currentLanguage === 'sw'
          ? 'Tafadhali tumia password — biometric imezimwa baada ya logout.'
          : 'Please use password — biometric disabled after logout.'
      );
      return;
    }

    if (lockUntil && lockUntil > Date.now()) {
      setErrorMessage(
        currentLanguage === 'sw'
          ? `Umefungwa kwa muda. Jaribu tena baada ya ${lockRemainingSec}s`
          : `Temporarily locked. Try again in ${lockRemainingSec}s`
      );
      return;
    }

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: currentLanguage === 'sw' ? 'Thibitisha kuingia DODOMA CTF' : 'Authenticate to access DODOMA CTF',
        fallbackLabel: currentLanguage === 'sw' ? 'Tumia password' : 'Use password',
        // @ts-ignore
        cancelLabel: currentLanguage === 'sw' ? 'Ghairi' : 'Cancel',
      });

      if (result.success) {
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

  // --- Forgot password (offline recovery) ---
  const handleRecover = async () => {
    setForgotLoading(true);
    try {
      // verify via DataService
      const isValidCode = (await DataService.verifyRecoveryCode(forgotCodeInput)) || (forgotCodeInput === DEVELOPER_FALLBACK);

      if (!isValidCode) {
        Alert.alert(currentLanguage === 'sw' ? 'Hitilafu' : 'Error', currentLanguage === 'sw' ? 'Recovery code si sahihi' : 'Recovery code is incorrect');
        setForgotLoading(false);
        return;
      }

      if (!forgotNewPassword || forgotNewPassword.length < 4) {
        Alert.alert(currentLanguage === 'sw' ? 'Hitilafu' : 'Error', currentLanguage === 'sw' ? 'Tafadhali ingiza nywila mpya (ang. herufi 4)' : 'Please enter a new password (min 4 chars)');
        setForgotLoading(false);
        return;
      }

      if (forgotNewPassword !== forgotConfirmPassword) {
        Alert.alert(currentLanguage === 'sw' ? 'Hitilafu' : 'Error', currentLanguage === 'sw' ? 'Password hazifanani' : 'Passwords do not match');
        setForgotLoading(false);
        return;
      }

      // recover using DataService method (centralized)
      if (forgotCodeInput === DEVELOPER_FALLBACK) {
        // allow developer fallback to reset by directly setting password (but avoid removing recovery code)
        await DataService.setAuthValue(forgotNewPassword, 'password');
      } else {
        await DataService.recoverPasswordWithCode(forgotCodeInput, forgotNewPassword);
      }

      // clear attempts and close modal
      await clearLock();

      Alert.alert(
        currentLanguage === 'sw' ? 'Umefanikiwa' : 'Success',
        currentLanguage === 'sw' ? 'Nywila imewekwa upya. Tafadhali ingia sasa.' : 'Password reset. Please login now.',
        [{ text: currentLanguage === 'sw' ? 'Sawa' : 'OK', onPress: () => setShowForgotModal(false) }]
      );

      setForgotCodeInput('');
      setForgotNewPassword('');
      setForgotConfirmPassword('');
      // re-check auth state if needed
      await checkAuthStatus();
    } catch (error) {
      console.error('Recovery error', error);
      Alert.alert(currentLanguage === 'sw' ? 'Hitilafu' : 'Error', currentLanguage === 'sw' ? 'Imeshindikana kurejesha nywila' : 'Failed to recover password');
    } finally {
      setForgotLoading(false);
    }
  };

  // --- Pattern grid small helper ---
  const PatternGrid = ({ onPatternChange, currentPattern }: { onPatternChange: (pattern: number[]) => void; currentPattern: number[] }) => {
    const handlePointToggle = (point: number) => {
      const newPattern = currentPattern.includes(point) ? currentPattern.filter(p => p !== point) : [...currentPattern, point];
      onPatternChange(newPattern);
    };

    return (
      <View style={styles.patternGrid}>
        {Array.from({ length: 9 }, (_, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.patternPoint, currentPattern.includes(i) && { backgroundColor: theme.primary }]}
            onPress={() => handlePointToggle(i)}
          />
        ))}
      </View>
    );
  };

  // --- Logout helper (call from settings/logout UI) ---
  // This helper exits the app on Android; on iOS we navigate back to auth screen.
  const handleLogoutAndExit = async () => {
    try {
      // set force relogin flag so next app start requires password (disables biometric until password used)
      try {
        await AsyncStorage.setItem(FORCE_RELOGIN_KEY, '1');
      } catch (e) {
        console.warn('Failed to set force relogin flag', e);
      }

      await DataService.logout();
      // small delay to ensure storage cleared
      setTimeout(() => {
        if (Platform.OS === 'android') {
          BackHandler.exitApp();
        } else {
          // iOS and web: navigate to auth screen
          router.replace({ pathname: '/auth' } as any);
        }
      }, 250);
    } catch (error) {
      console.error('Logout and exit error', error);
      // fallback navigation
      router.replace({ pathname: '/auth' } as any);
    }
  };

  // --- UI Rendering ---
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // First-time welcome with week info after registration
  if (showFirstTimeWelcome && workWeekInfo) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.authContainer}>
          <View style={styles.logoContainer}>
            <View style={[styles.logoCircle, { backgroundColor: theme.success }]}>
              <User size={32} color="#ffffff" />
            </View>
            <Text style={[styles.appTitle, { color: theme.text }]}>{currentLanguage === 'sw' ? 'Karibu!' : 'Welcome!'}</Text>
            <Text style={[styles.appSubtitle, { color: theme.textSecondary }]}>{currentLanguage === 'sw' ? 'Hii ni mara yako ya kwanza kuingia' : 'This is your first time logging in'}</Text>
          </View>

          <View style={[styles.formContainer, { backgroundColor: theme.card }]}> 
            <Text style={[styles.formTitle, { color: theme.text }]}>{currentLanguage === 'sw' ? 'Wiki Yako ya Kazi' : 'Your Work Week'}</Text>
            <Text style={[styles.formSubtitle, { color: theme.textSecondary }]}>{currentLanguage === 'sw' ? 'Jumatatu hadi Ijumaa, kuishia saa 6:00 jioni' : 'Monday to Friday, ending at 6:00 PM'}</Text>

            {workWeekInfo.workDays.map((day, index) => (
              <View key={index} style={[styles.workDayItem, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
                <Text style={[styles.workDayName, { color: theme.text }]}>{day.dayName}</Text>
                <Text style={[styles.workDayDate, { color: theme.textSecondary }]}>{new Date(day.date).toLocaleDateString()}</Text>
                {day.isToday && <Text style={[styles.todayBadge, { color: theme.primary }]}>{currentLanguage === 'sw' ? 'Leo' : 'Today'}</Text>}
              </View>
            ))}

            <TouchableOpacity style={[styles.authButton, { backgroundColor: theme.primary }]} onPress={handleFirstTimeWelcomeComplete}>
              <Text style={[styles.authButtonText, { color: '#ffffff' }]}>{currentLanguage === 'sw' ? 'Anza Kazi' : 'Start Working'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Setup / Register screen (first time)
  if (isFirstTime || needsProfile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={[styles.authContainer, { paddingBottom: 40 }]} keyboardShouldPersistTaps="handled">
            {/* Header */}
            <View style={styles.logoContainer}>
              <View style={[styles.logoCircle, { backgroundColor: theme.primary }]}>
                <Lock size={32} color="#fff" />
              </View>
              <Text style={[styles.appTitle, { color: theme.text }]}>DODOMA CTF 2025</Text>
              <Text style={[styles.appSubtitle, { color: theme.textSecondary }]}>{currentLanguage === 'sw' ? 'Mfumo wa Taarifa za Uuzaji' : 'Student Canvassing Report System'}</Text>
            </View>

            {/* Instructions modal / card shown before allowing user to fill form */}
            {showInstructions ? (
              <View style={[styles.formContainer, { backgroundColor: theme.card }]}>
                <Text style={[styles.formTitle, { color: theme.text }]}>{currentLanguage === 'sw' ? 'Maelekezo ya Usalama' : 'Security Instructions'}</Text>
                <Text style={[styles.formSubtitle, { color: theme.textSecondary }]}> 
                  {currentLanguage === 'sw'
                    ? 'Tafadhali soma haya maelekezo kabla ya kujaza fomu. Utapata recovery code baada ya kujisajili; andika mahali salama.'
                    : 'Please read these instructions before proceeding. You will receive a recovery code after signup — write it down in a safe place.'}
                </Text>

                <View style={{ marginTop: 8 }}>
                  <Text style={{ color: theme.text, marginBottom: 6, fontWeight: '600' }}>{currentLanguage === 'sw' ? 'Hatua:' : 'Steps:'}</Text>
                  <Text style={{ color: theme.textSecondary }}>1. {currentLanguage === 'sw' ? 'Chagua lugha (Sw/En).' : 'Choose a language (Sw/En).'}</Text>
                  <Text style={{ color: theme.textSecondary }}>2. {currentLanguage === 'sw' ? 'Jaza form na utapokea recovery code. Andika au husisha kwa usalama.' : 'Fill the form and you will receive a recovery code. Write or store it safely.'}</Text>
                  <Text style={{ color: theme.textSecondary }}>3. {currentLanguage === 'sw' ? 'Kama umesahau nywila, tumia recovery code au muunganisho wa mtengenezaji (hutoa msaada).' : 'If you forget your password, use the recovery code or developer fallback (for support).'}</Text>
                </View>

                <View style={{ flexDirection: 'row', marginTop: 12, justifyContent: 'space-between' }}>
                  <TouchableOpacity style={[styles.authMethodButton, { flex: 0.48, borderColor: theme.primary }]} onPress={() => setCurrentLanguage('sw')}>
                    <Text style={[styles.authMethodText, { color: currentLanguage === 'sw' ? '#fff' : theme.primary }]}>{'Kiswahili'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.authMethodButton, { flex: 0.48, borderColor: theme.primary }]} onPress={() => setCurrentLanguage('en')}>
                    <Text style={[styles.authMethodText, { color: currentLanguage === 'en' ? '#fff' : theme.primary }]}>{'English'}</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', marginTop: 14 }}>
                  <TouchableOpacity style={[styles.authButton, { flex: 1, backgroundColor: theme.primary }]} onPress={() => setShowInstructions(false)}>
                    <Text style={[styles.authButtonText, { color: '#fff', textAlign: 'center' }]}>{currentLanguage === 'sw' ? 'Nimesoma, Endelea' : 'I have read, Continue'}</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={{ marginTop: 12, alignSelf: 'center' }} onPress={() => setShowForgotModal(true)}>
                  <Text style={{ color: theme.primary }}>{currentLanguage === 'sw' ? 'Umesahau password?' : 'Forgot password?'}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Main registration card */}
                <View style={[styles.formContainer, { backgroundColor: theme.card }]}>
                  <Text style={[styles.formTitle, { color: theme.text }]}>{isFirstTime ? (currentLanguage === 'sw' ? 'Sanidi Usalama' : 'Set up Security') : (currentLanguage === 'sw' ? 'Kamili Wasifu Wako' : 'Complete Your Profile')}</Text>

                  <Text style={[styles.formSubtitle, { color: theme.textSecondary, marginBottom: 14 }]}>
                    {isFirstTime ? (currentLanguage === 'sw' ? 'Tengeneza njia ya kuingia' : 'Choose a way to log in') : (currentLanguage === 'sw' ? 'Ingiza taarifa zako za kibinafsi' : 'Enter your personal information')}
                  </Text>

                  {needsProfile && (
                    <View style={{ marginBottom: 12 }}>
                      <View style={styles.inputContainer}>
                        <User size={20} color={theme.textSecondary} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                          placeholder={currentLanguage === 'sw' ? 'Jina kamili' : 'Full name'}
                          placeholderTextColor={theme.textSecondary}
                          value={fullName}
                          onChangeText={(t) => { setFullName(t); setErrors(prev => ({ ...prev, fullName: undefined })); }}
                          autoCapitalize="words"
                        />
                      </View>
                      {errors.fullName ? <Text style={[styles.fieldError, { color: theme.error }]}>{errors.fullName}</Text> : null}

                      <View style={styles.inputContainer}>
                        <Phone size={20} color={theme.textSecondary} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                          placeholder={currentLanguage === 'sw' ? 'Namba ya simu (mfano: +255123456789)' : 'Phone number (e.g: +255123456789)'}
                          placeholderTextColor={theme.textSecondary}
                          value={phoneNumber}
                          onChangeText={(t) => { setPhoneNumber(t); setErrors(prev => ({ ...prev, phone: undefined })); }}
                          keyboardType="phone-pad"
                        />
                      </View>
                      {errors.phone ? <Text style={[styles.fieldError, { color: theme.error }]}>{errors.phone}</Text> : null}
                    </View>
                  )}

                  {isFirstTime && (
                    <View style={[{ marginBottom: 12 }]}>
                      <Text style={[styles.authMethodTitle, { color: theme.text }]}>{currentLanguage === 'sw' ? 'Chagua njia ya kuingia:' : 'Choose authentication method:'}</Text>
                      <View style={[styles.authMethodButtons, { marginTop: 8 }]}> 
                        <TouchableOpacity
                          style={[
                            styles.authMethodButton,
                            {
                              borderColor: theme.primary,
                              backgroundColor: authMethodSelection === 'password' ? theme.primary : theme.surface,
                              marginRight: 8,
                            },
                          ]}
                          onPress={() => setAuthMethodSelection('password')}
                        >
                          <Lock size={16} color={authMethodSelection === 'password' ? '#fff' : theme.primary} />
                          <Text style={[styles.authMethodText, { color: authMethodSelection === 'password' ? '#fff' : theme.primary, marginLeft: 6 }]}>Password</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.authMethodButton,
                            {
                              borderColor: theme.primary,
                              backgroundColor: authMethodSelection === 'pin' ? theme.primary : theme.surface,
                              marginRight: 8,
                            },
                          ]}
                          onPress={() => setAuthMethodSelection('pin')}
                        >
                          <Text style={[styles.authMethodText, { color: authMethodSelection === 'pin' ? '#fff' : theme.primary }]}>PIN</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.authMethodButton,
                            {
                              borderColor: theme.primary,
                              backgroundColor: authMethodSelection === 'pattern' ? theme.primary : theme.surface,
                            },
                          ]}
                          onPress={() => setAuthMethodSelection('pattern')}
                        >
                          <Text style={[styles.authMethodText, { color: authMethodSelection === 'pattern' ? '#fff' : theme.primary }]}>Pattern</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* auth inputs */}
                  {isFirstTime && (
                    <View style={{ padding: 8, borderRadius: 10, backgroundColor: theme.surface }}>
                      {authMethodSelection === 'password' && (
                        <>
                          <View style={styles.inputContainer}>
                            <Lock size={20} color={theme.textSecondary} style={styles.inputIcon} />
                            <TextInput
                              style={[styles.passwordInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                              placeholder={currentLanguage === 'sw' ? 'Tengeneza password' : 'Create password'}
                              placeholderTextColor={theme.textSecondary}
                              secureTextEntry={!showPassword}
                              value={password}
                              onChangeText={(t) => { setPassword(t); setErrors(prev => ({ ...prev, password: undefined, confirmPassword: undefined })); }}
                              autoCapitalize="none"
                            />
                            <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)}>
                              {showPassword ? <EyeOff size={20} color={theme.textSecondary} /> : <Eye size={20} color={theme.textSecondary} />}
                            </TouchableOpacity>
                          </View>
                          {errors.password ? <Text style={[styles.fieldError, { color: theme.error }]}>{errors.password}</Text> : null}

                          <View style={styles.inputContainer}>
                            <Lock size={20} color={theme.textSecondary} style={styles.inputIcon} />
                            <TextInput
                              style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                              placeholder={currentLanguage === 'sw' ? 'Thibitisha password' : 'Confirm password'}
                              placeholderTextColor={theme.textSecondary}
                              secureTextEntry={!showPassword}
                              value={confirmPassword}
                              onChangeText={(t) => { setConfirmPassword(t); setErrors(prev => ({ ...prev, confirmPassword: undefined })); }}
                              autoCapitalize="none"
                            />
                          </View>
                          {errors.confirmPassword ? <Text style={[styles.fieldError, { color: theme.error }]}>{errors.confirmPassword}</Text> : null}

                          <Text style={[styles.hintText, { color: theme.textSecondary }]}>{currentLanguage === 'sw' ? 'Tumia nywila salama (herufi, namba, alama).' : 'Use a strong password (letters, numbers, symbols).'}</Text>
                        </>
                      )}

                      {authMethodSelection === 'pin' && (
                        <>
                          <View style={[styles.horizontalRow, { marginBottom: 8 }]}> 
                            <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}> 
                              <Lock size={20} color={theme.textSecondary} style={styles.inputIcon} />
                              <TextInput
                                style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                                placeholder={currentLanguage === 'sw' ? 'Tengeneza PIN (4+)' : 'Create PIN (4+ digits)'}
                                placeholderTextColor={theme.textSecondary}
                                secureTextEntry
                                value={pinCode}
                                onChangeText={(t) => { setPinCode(t); setErrors(prev => ({ ...prev, pin: undefined, confirmPin: undefined })); }}
                                keyboardType="numeric"
                                maxLength={8}
                              />
                            </View>

                            <View style={[styles.inputContainer, { flex: 1 }]}> 
                              <Lock size={20} color={theme.textSecondary} style={styles.inputIcon} />
                              <TextInput
                                style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                                placeholder={currentLanguage === 'sw' ? 'Thibitisha PIN' : 'Confirm PIN'}
                                placeholderTextColor={theme.textSecondary}
                                secureTextEntry
                                value={confirmPinCode}
                                onChangeText={(t) => { setConfirmPinCode(t); setErrors(prev => ({ ...prev, confirmPin: undefined })); }}
                                keyboardType="numeric"
                                maxLength={8}
                              />
                            </View>
                          </View>
                          {errors.pin ? <Text style={[styles.fieldError, { color: theme.error }]}>{errors.pin}</Text> : null}
                          {errors.confirmPin ? <Text style={[styles.fieldError, { color: theme.error }]}>{errors.confirmPin}</Text> : null}
                        </>
                      )}

                      {authMethodSelection === 'pattern' && (
                        <>
                          <Text style={[styles.patternLabel, { color: theme.text }]}>{currentLanguage === 'sw' ? 'Tengeneza mchoro wako' : 'Create your pattern'}</Text>
                          <PatternGrid onPatternChange={(p) => { setPatternPoints(p); setErrors(prev => ({ ...prev, pattern: undefined })); }} currentPattern={patternPoints} />
                          <Text style={[styles.patternLabel, { color: theme.text, marginTop: 6 }]}>{currentLanguage === 'sw' ? 'Thibitisha mchoro' : 'Confirm pattern'}</Text>
                          <PatternGrid onPatternChange={(p) => { setConfirmPatternPoints(p); setErrors(prev => ({ ...prev, pattern: undefined })); }} currentPattern={confirmPatternPoints} />
                          {errors.pattern ? <Text style={[styles.fieldError, { color: theme.error }]}>{errors.pattern}</Text> : null}
                        </>
                      )}
                    </View>
                  )}

                  {/* top-level error */}
                  {errorMessage ? <Text style={[styles.inlineError, { color: theme.error }]}>{errorMessage}</Text> : null}

                  <TouchableOpacity style={[styles.authButton, { backgroundColor: loading ? theme.textSecondary : theme.primary, marginTop: 18 }]} onPress={handleSetupComplete} disabled={loading}>
                    <Text style={[styles.authButtonText, { color: '#fff' }]}>{loading ? (currentLanguage === 'sw' ? 'Inahifadhi...' : 'Saving...') : (currentLanguage === 'sw' ? 'Kamili Usanidi' : 'Complete Setup')}</Text>
                  </TouchableOpacity>

                  {/* Forgot password link on register as requested */}
                  <TouchableOpacity style={{ marginTop: 12, alignSelf: 'center' }} onPress={() => setShowForgotModal(true)}>
                    <Text style={{ color: theme.primary }}>{currentLanguage === 'sw' ? 'Umesahau password?' : 'Forgot password?'}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.footer}>
                  <Text style={[styles.footerText, { color: theme.textSecondary }]}>{currentLanguage === 'sw' ? 'Salama • Offline • Imara' : 'Secure • Offline • Reliable'}</Text>
                </View>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Forgot password modal */}
        <Modal visible={showForgotModal} transparent animationType="slide">
          <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#00000066' }}>
            <View style={{ backgroundColor: theme.card, borderRadius: 12, padding: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: theme.text }}>{currentLanguage === 'sw' ? 'Rejesha Nywila' : 'Recover Password'}</Text>
              <Text style={{ color: theme.textSecondary, marginBottom: 8 }}>{currentLanguage === 'sw' ? 'Weka recovery code uliyopata wakati wa kujisajili' : 'Enter the recovery code you saved at signup'}</Text>

              <TextInput
                placeholder={currentLanguage === 'sw' ? 'Recovery code' : 'Recovery code'}
                placeholderTextColor={theme.textSecondary}
                value={forgotCodeInput}
                onChangeText={setForgotCodeInput}
                style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                autoCapitalize="characters"
              />

              <TextInput
                placeholder={currentLanguage === 'sw' ? 'Nywila mpya' : 'New password'}
                placeholderTextColor={theme.textSecondary}
                value={forgotNewPassword}
                onChangeText={setForgotNewPassword}
                secureTextEntry
                style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
              />

              <TextInput
                placeholder={currentLanguage === 'sw' ? 'Thibitisha nywila' : 'Confirm password'}
                placeholderTextColor={theme.textSecondary}
                value={forgotConfirmPassword}
                onChangeText={setForgotConfirmPassword}
                secureTextEntry
                style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
              />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
                <TouchableOpacity onPress={() => setShowForgotModal(false)} style={[styles.authMethodButton, { flex: 0.48 }]}>
                  <Text style={[styles.authMethodText, { textAlign: 'center' }]}>{currentLanguage === 'sw' ? 'Funga' : 'Cancel'}</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleRecover} disabled={forgotLoading} style={[styles.authMethodButton, { flex: 0.48, backgroundColor: theme.primary }]}>
                  {forgotLoading ? <ActivityIndicator color="#fff" /> : <Text style={[styles.authMethodText, { textAlign: 'center', color: '#fff' }]}>{currentLanguage === 'sw' ? 'Weka nywila' : 'Set password'}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // Login screen
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}> 
      <View style={styles.authContainer}>
        {/* Header */}
        <View style={styles.logoContainer}>
          <View style={[styles.logoCircle, { backgroundColor: theme.primary }]}>
            <Lock size={32} color="#ffffff" />
          </View>
          <Text style={[styles.appTitle, { color: theme.text }]}>DODOMA CTF 2025</Text>
          <Text style={[styles.appSubtitle, { color: theme.textSecondary }]}>{currentLanguage === 'sw' ? 'Mfumo wa Taarifa za Uuzaji' : 'Student Canvassing Report System'}</Text>
        </View>

        <View style={[styles.formContainer, { backgroundColor: theme.card }]}>
          <Text style={[styles.formTitle, { color: theme.text }]}>{currentLanguage === 'sw' ? 'Ingia kwenye Mfumo' : 'Login to System'}</Text>
          <Text style={[styles.formSubtitle, { color: theme.textSecondary }]}>{currentLanguage === 'sw' ? 'Ingiza password yako ili kufikia programu' : 'Enter your password to access the app'}</Text>

          <View style={styles.inputContainer}>
            <Lock size={20} color={theme.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.passwordInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
              placeholder={currentLanguage === 'sw' ? 'Ingiza password' : 'Enter password'}
              placeholderTextColor={theme.textSecondary}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={(t) => { setPassword(t); setErrors(prev => ({ ...prev, password: undefined })); setErrorMessage(null); }}
              autoCapitalize="none"
              editable={!lockUntil || lockUntil <= Date.now()}
            />
            <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)} disabled={Boolean(lockUntil && lockUntil > Date.now())}>
              {showPassword ? <EyeOff size={20} color={theme.textSecondary} /> : <Eye size={20} color={theme.textSecondary} />}
            </TouchableOpacity>
          </View>

          {errors.password ? <Text style={[styles.fieldError, { color: theme.error }]}>{errors.password}</Text> : null}
          {errorMessage ? <Text style={[styles.inlineError, { color: theme.error }]}>{errorMessage}</Text> : failedAttempts > 0 ? <Text style={[styles.inlineError, { color: theme.textSecondary }]}>{currentLanguage === 'sw' ? `Jaribio zilizofanywa: ${failedAttempts} / ${MAX_ATTEMPTS}` : `Attempts: ${failedAttempts} / ${MAX_ATTEMPTS}`}</Text> : null}

          {lockUntil && lockUntil > Date.now() && <Text style={[styles.inlineError, { color: theme.error }]}>{currentLanguage === 'sw' ? `Umefungwa kwa muda. Jaribu tena baada ya ${lockRemainingSec}s` : `Temporarily locked. Try again in ${lockRemainingSec}s`}</Text>}

          <TouchableOpacity style={[styles.authButton, { backgroundColor: loading ? theme.textSecondary : theme.primary }]} onPress={handlePasswordAuth} disabled={loading || Boolean(lockUntil && lockUntil > Date.now())}>
            <Text style={[styles.authButtonText, { color: '#ffffff' }]}>{loading ? (currentLanguage === 'sw' ? 'Inathibitisha...' : 'Authenticating...') : (currentLanguage === 'sw' ? 'Ingia' : 'Login')}</Text>
          </TouchableOpacity>

          {/* Forgot password link on login */}
          <TouchableOpacity style={{ marginTop: 12, alignSelf: 'center' }} onPress={() => setShowForgotModal(true)}>
            <Text style={{ color: theme.primary }}>{currentLanguage === 'sw' ? 'Umesahau password?' : 'Forgot password?'}</Text>
          </TouchableOpacity>

          {biometricAvailable && (
            <>
              <View style={styles.divider}>
                <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                <Text style={[styles.dividerText, { color: theme.textSecondary }]}>{currentLanguage === 'sw' ? 'AU' : 'OR'}</Text>
                <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
              </View>

              <TouchableOpacity style={[styles.biometricButton, { backgroundColor: theme.primary + '20', borderColor: theme.primary }]} onPress={handleBiometricAuth} disabled={Boolean(lockUntil && lockUntil > Date.now())}>
                <Fingerprint size={20} color={theme.primary} />
                <Text style={[styles.biometricButtonText, { color: theme.primary }]}>{currentLanguage === 'sw' ? 'Tumia Fingerprint' : 'Use Fingerprint'}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>{currentLanguage === 'sw' ? 'Salama • Offline • Imara' : 'Secure • Offline • Reliable'}</Text>
        </View>
      </View>

      {/* Forgot password modal (same as in setup) */}
      <Modal visible={showForgotModal} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#00000066' }}>
          <View style={{ backgroundColor: theme.card, borderRadius: 12, padding: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: theme.text }}>{currentLanguage === 'sw' ? 'Rejesha Nywila' : 'Recover Password'}</Text>
            <Text style={{ color: theme.textSecondary, marginBottom: 8 }}>{currentLanguage === 'sw' ? 'Weka recovery code uliyopata wakati wa kujisajili' : 'Enter the recovery code you saved at signup'}</Text>

            <TextInput
              placeholder={currentLanguage === 'sw' ? 'Recovery code' : 'Recovery code'}
              placeholderTextColor={theme.textSecondary}
              value={forgotCodeInput}
              onChangeText={setForgotCodeInput}
              style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
              autoCapitalize="characters"
            />

            <TextInput
              placeholder={currentLanguage === 'sw' ? 'Nywila mpya' : 'New password'}
              placeholderTextColor={theme.textSecondary}
              value={forgotNewPassword}
              onChangeText={setForgotNewPassword}
              secureTextEntry
              style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
            />

            <TextInput
              placeholder={currentLanguage === 'sw' ? 'Thibitisha nywila' : 'Confirm password'}
              placeholderTextColor={theme.textSecondary}
              value={forgotConfirmPassword}
              onChangeText={setForgotConfirmPassword}
              secureTextEntry
              style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
              <TouchableOpacity onPress={() => setShowForgotModal(false)} style={[styles.authMethodButton, { flex: 0.48 }]}>
                <Text style={[styles.authMethodText, { textAlign: 'center' }]}>{currentLanguage === 'sw' ? 'Funga' : 'Cancel'}</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleRecover} disabled={forgotLoading} style={[styles.authMethodButton, { flex: 0.48, backgroundColor: theme.primary }]}>
                {forgotLoading ? <ActivityIndicator color="#fff" /> : <Text style={[styles.authMethodText, { textAlign: 'center', color: '#fff' }]}>{currentLanguage === 'sw' ? 'Weka nywila' : 'Set password'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  authContainer: { flex: 1, justifyContent: 'center', padding: 32 },
  logoContainer: { alignItems: 'center', marginBottom: 48 },
  logoCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  appTitle: { fontSize: 28, fontWeight: 'bold', marginBottom: 4 },
  appSubtitle: { fontSize: 16 },
  formContainer: { padding: 24, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  formTitle: { fontSize: 20, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  formSubtitle: { fontSize: 14, textAlign: 'center', marginBottom: 24 },
  inputContainer: { position: 'relative', marginBottom: 16, flexDirection: 'row', alignItems: 'center' },
  inputIcon: { position: 'absolute', left: 16, zIndex: 1 },
  input: { borderWidth: 1, borderRadius: 8, padding: 16, paddingLeft: 48, fontSize: 16, flex: 1, marginBottom: 8 },
  passwordInput: { borderWidth: 1, borderRadius: 8, padding: 16, paddingLeft: 48, paddingRight: 50, fontSize: 16, flex: 1 },
  eyeButton: { position: 'absolute', right: 16 },
  authMethodContainer: { marginBottom: 16 },
  authMethodTitle: { fontSize: 14, fontWeight: '500', marginBottom: 12 },
  authMethodButtons: { flexDirection: 'row', gap: 8 },
  authMethodButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8, borderWidth: 1 },
  authMethodText: { fontSize: 14, fontWeight: '500', marginLeft: 6 },
  authButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 8, marginTop: 8 },
  authButtonText: { fontSize: 16, fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 14, marginHorizontal: 16 },
  biometricButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 8, borderWidth: 1 },
  biometricButtonText: { fontSize: 16, fontWeight: '600', marginLeft: 8 },
  inlineError: { marginBottom: 8, textAlign: 'center' },
  footer: { alignItems: 'center', marginTop: 32 },
  footerText: { fontSize: 14 },
  workDayItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1 },
  workDayName: { fontSize: 16, fontWeight: '600' },
  workDayDate: { fontSize: 14 },
  todayBadge: { fontSize: 12, fontWeight: '600' },
  patternGrid: { flexDirection: 'row', flexWrap: 'wrap', width: 120, height: 120, alignSelf: 'center', marginVertical: 16 },
  patternPoint: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e5e7eb', margin: 4 },
  patternLabel: { fontSize: 14, fontWeight: '500', marginBottom: 8, textAlign: 'center' },
  horizontalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hintText: { fontSize: 12, marginTop: 6 },
  fieldError: { fontSize: 12, marginTop: 6 },
});
