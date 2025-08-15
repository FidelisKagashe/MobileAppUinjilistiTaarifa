import React, { useState, useEffect } from 'react';
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
import { DataService } from '@/services/DataService';
import { UserProfile } from '@/types/Report';

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
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

  useEffect(() => {
    checkAuthStatus();
    checkBiometricAvailability();
  }, []);

  const checkAuthStatus = async () => {
    const hasPassword = await DataService.hasPassword();
    const hasProfile = await DataService.hasUserProfile();
    
    setIsFirstTime(!hasPassword);
    setNeedsProfile(!hasProfile);
  };

  const checkBiometricAvailability = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    setBiometricAvailable(compatible && enrolled);
  };

  const handleBiometricAuth = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Thibitisha kuingia DODOMA CTF',
        fallbackLabel: 'Tumia password',
        biometricsSecurityLevel: 'strong',
      });

      if (result.success) {
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Biometric authentication error:', error);
      Alert.alert('Hitilafu', 'Imeshindwa kuthibitisha. Jaribu tena.');
    }
  };

  const handleSetupComplete = async () => {
    if (isFirstTime) {
      // Validate password
      if (password !== confirmPassword) {
        Alert.alert('Hitilafu', 'Password hazifanani');
        return;
      }
      if (password.length < 4) {
        Alert.alert('Hitilafu', 'Password lazima iwe angalau herufi 4');
        return;
      }
    }

    if (needsProfile) {
      // Validate profile
      if (!fullName.trim()) {
        Alert.alert('Hitilafu', 'Jina kamili linahitajika');
        return;
      }
      if (!phoneNumber.trim()) {
        Alert.alert('Hitilafu', 'Namba ya simu inahitajika');
        return;
      }
    }

    setLoading(true);
    try {
      // Save password if first time
      if (isFirstTime) {
        await DataService.setPassword(password);
      }

      // Save profile if needed
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

      // Save auth method preference
      await DataService.updateSettings({ 
        authMethod,
        biometricEnabled: authMethod === 'biometric' && biometricAvailable 
      });

      setIsAuthenticated(true);
    } catch (error) {
      Alert.alert('Hitilafu', 'Imeshindwa kusave taarifa. Jaribu tena.');
      console.error('Setup error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordAuth = async () => {
    setLoading(true);
    try {
      const isValid = await DataService.verifyPassword(password);
      if (isValid) {
        setIsAuthenticated(true);
      } else {
        Alert.alert('Hitilafu', 'Password si sahihi');
      }
    } catch (error) {
      Alert.alert('Hitilafu', 'Imeshindwa kuthibitisha');
    } finally {
      setLoading(false);
    }
  };

  if (isAuthenticated) {
    return <>{children}</>;
  }

  // First time setup or profile setup
  if (isFirstTime || needsProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.authContainer}>
          {/* Logo/Header */}
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Lock size={32} color="#ffffff" />
            </View>
            <Text style={styles.appTitle}>DODOMA CTF 2025</Text>
            <Text style={styles.appSubtitle}>Mfumo wa Taarifa za Uuzaji</Text>
          </View>

          {/* Setup Form */}
          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>
              {isFirstTime ? 'Sanidi Usalama' : 'Kamili Wasifu Wako'}
            </Text>
            <Text style={styles.formSubtitle}>
              {isFirstTime 
                ? 'Tengeneza password ili kulinda taarifa zako'
                : 'Ingiza taarifa zako za kibinafsi'
              }
            </Text>

            {/* Profile Fields */}
            {needsProfile && (
              <>
                <View style={styles.inputContainer}>
                  <User size={20} color="#6b7280" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Jina kamili"
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Phone size={20} color="#6b7280" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Namba ya simu (mfano: +255123456789)"
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
                  <Lock size={20} color="#6b7280" style={styles.inputIcon} />
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Tengeneza password"
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
                      <EyeOff size={20} color="#6b7280" />
                    ) : (
                      <Eye size={20} color="#6b7280" />
                    )}
                  </TouchableOpacity>
                </View>

                <View style={styles.inputContainer}>
                  <Lock size={20} color="#6b7280" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Thibitisha password"
                    secureTextEntry={!showPassword}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    autoCapitalize="none"
                  />
                </View>

                {/* Authentication Method Selection */}
                {biometricAvailable && (
                  <View style={styles.authMethodContainer}>
                    <Text style={styles.authMethodTitle}>Chagua njia ya kuingia:</Text>
                    <View style={styles.authMethodButtons}>
                      <TouchableOpacity
                        style={[
                          styles.authMethodButton,
                          authMethod === 'password' && styles.authMethodButtonActive
                        ]}
                        onPress={() => setAuthMethod('password')}
                      >
                        <Lock size={20} color={authMethod === 'password' ? '#ffffff' : '#1e3a8a'} />
                        <Text style={[
                          styles.authMethodText,
                          authMethod === 'password' && styles.authMethodTextActive
                        ]}>Password</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.authMethodButton,
                          authMethod === 'biometric' && styles.authMethodButtonActive
                        ]}
                        onPress={() => setAuthMethod('biometric')}
                      >
                        <Fingerprint size={20} color={authMethod === 'biometric' ? '#ffffff' : '#1e3a8a'} />
                        <Text style={[
                          styles.authMethodText,
                          authMethod === 'biometric' && styles.authMethodTextActive
                        ]}>Fingerprint</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </>
            )}

            <TouchableOpacity
              style={[styles.authButton, loading && styles.authButtonDisabled]}
              onPress={handleSetupComplete}
              disabled={loading}
            >
              <Text style={styles.authButtonText}>
                {loading ? 'Inahifadhi...' : 'Kamili Usanidi'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Salama • Offline • Imara
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Login screen
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.authContainer}>
        {/* Logo/Header */}
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Lock size={32} color="#ffffff" />
          </View>
          <Text style={styles.appTitle}>DODOMA CTF 2025</Text>
          <Text style={styles.appSubtitle}>Mfumo wa Taarifa za Uuzaji</Text>
        </View>

        {/* Authentication Form */}
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>Ingia kwenye Mfumo</Text>
          <Text style={styles.formSubtitle}>
            Ingiza password yako ili kufikia programu
          </Text>

          <View style={styles.inputContainer}>
            <Lock size={20} color="#6b7280" style={styles.inputIcon} />
            <TextInput
              style={styles.passwordInput}
              placeholder="Ingiza password"
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
                <EyeOff size={20} color="#6b7280" />
              ) : (
                <Eye size={20} color="#6b7280" />
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.authButton, loading && styles.authButtonDisabled]}
            onPress={handlePasswordAuth}
            disabled={loading}
          >
            <Text style={styles.authButtonText}>
              {loading ? 'Inathibitisha...' : 'Ingia'}
            </Text>
          </TouchableOpacity>

          {biometricAvailable && (
            <>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>AU</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={styles.biometricButton}
                onPress={handleBiometricAuth}
              >
                <Fingerprint size={20} color="#1e3a8a" />
                <Text style={styles.biometricButtonText}>Tumia Fingerprint</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Salama • Offline • Imara
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
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
    backgroundColor: '#1e3a8a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  appSubtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  formContainer: {
    backgroundColor: '#ffffff',
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
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  formSubtitle: {
    fontSize: 14,
    color: '#6b7280',
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
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 16,
    paddingLeft: 48,
    fontSize: 16,
    flex: 1,
  },
  passwordInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
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
    color: '#374151',
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
    borderColor: '#1e3a8a',
    backgroundColor: '#ffffff',
  },
  authMethodButtonActive: {
    backgroundColor: '#1e3a8a',
  },
  authMethodText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e3a8a',
    marginLeft: 6,
  },
  authMethodTextActive: {
    color: '#ffffff',
  },
  authButton: {
    backgroundColor: '#1e3a8a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  authButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  authButtonText: {
    color: '#ffffff',
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
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    fontSize: 14,
    color: '#6b7280',
    marginHorizontal: 16,
  },
  biometricButton: {
    backgroundColor: '#eff6ff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e3a8a',
  },
  biometricButtonText: {
    color: '#1e3a8a',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  footer: {
    alignItems: 'center',
    marginTop: 32,
  },
  footerText: {
    fontSize: 14,
    color: '#9ca3af',
  },
});