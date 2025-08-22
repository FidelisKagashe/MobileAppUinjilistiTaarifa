// app/(auth)/ChangePasswordModal.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { Lock, Eye, EyeOff, X } from 'lucide-react-native';
import { DataService } from '@/services/DataService';
import { LanguageService, Translations } from '@/services/LanguageService';
import { useTheme } from '@/app/providers/ThemeProvider';

interface ChangePasswordModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type MsgType = 'error' | 'success' | 'info';
type InlineMsg = { type: MsgType; text: string } | null;

export default function ChangePasswordModal({ visible, onClose, onSuccess }: ChangePasswordModalProps) {
  const { theme } = useTheme();

  // UI state
  const [loading, setLoading] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<'sw' | 'en'>('sw');
  const [authMethod, setAuthMethod] = useState<'password' | 'pin' | 'pattern' | 'biometric'>('password');

  // change inputs
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const [currentPattern, setCurrentPattern] = useState<number[]>([]);
  const [newPattern, setNewPattern] = useState<number[]>([]);
  const [confirmPattern, setConfirmPattern] = useState<number[]>([]);

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // recovery flow
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryCodeInput, setRecoveryCodeInput] = useState('');

  // inline banner
  const [inlineMsg, setInlineMsg] = useState<InlineMsg>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // load language & auth method when modal opens
  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        await LanguageService.initialize();
        setCurrentLanguage(LanguageService.getCurrentLanguage());
        const method = await DataService.getAuthMethod();
        setAuthMethod(method);
      } catch (e) {
        // ignore
      }
    })();
    // clear fields when opened
    resetAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  const showInlineMessage = (text: string, type: MsgType = 'error', duration = 3000) => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setInlineMsg({ type, text });
    hideTimerRef.current = setTimeout(() => {
      setInlineMsg(null);
      hideTimerRef.current = null;
    }, duration);
  };

  const clearInlineMessage = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setInlineMsg(null);
  };

  const resetAll = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setCurrentPattern([]);
    setNewPattern([]);
    setConfirmPattern([]);
    setRecoveryCodeInput('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    clearInlineMessage();
    setLoading(false);
  };

  // validation helpers
  const minPasswordLen = 4;
  // t now expects keyof Translations so TypeScript is happy
  const t = (key: keyof Translations, fallback?: string) => LanguageService.t(key) ?? fallback;

  const validateAndSubmit = async () => {
    clearInlineMessage();

    // if recovery mode route to recovery handler
    if (recoveryMode) {
      return handleRecoverWithCode();
    }

    // validations by method
    if (authMethod === 'password') {
      if (!currentPassword.trim()) return showInlineMessage(currentLanguage === 'sw' ? 'Ingiza password ya sasa' : 'Enter current password');
      if (!newPassword.trim()) return showInlineMessage(currentLanguage === 'sw' ? 'Ingiza password mpya' : 'Enter new password');
      if (newPassword.length < minPasswordLen) return showInlineMessage(t('passwordTooShort', currentLanguage === 'sw' ? 'Password ni fupi' : 'Password too short'));
      if (newPassword !== confirmPassword) return showInlineMessage(t('passwordMismatch', currentLanguage === 'sw' ? 'Password hazifanani' : 'Passwords do not match'));
      if (currentPassword === newPassword) return showInlineMessage(currentLanguage === 'sw' ? 'Nywila mpya lazima itofautiane' : 'New password must be different');
    }

    if (authMethod === 'pin') {
      if (!currentPin) return showInlineMessage(currentLanguage === 'sw' ? 'Ingiza PIN ya sasa' : 'Enter current PIN');
      if (!newPin) return showInlineMessage(currentLanguage === 'sw' ? 'Ingiza PIN mpya' : 'Enter new PIN');
      if (newPin.length < 4) return showInlineMessage(currentLanguage === 'sw' ? 'PIN lazima iwe angalau namba 4' : 'PIN must be at least 4 digits');
      if (newPin !== confirmPin) return showInlineMessage(currentLanguage === 'sw' ? 'PIN hazifanani' : 'PINs do not match');
      if (currentPin === newPin) return showInlineMessage(currentLanguage === 'sw' ? 'PIN mpya lazima itofautiane' : 'New PIN must be different');
    }

    if (authMethod === 'pattern') {
      if (!currentPattern || currentPattern.length < 4) return showInlineMessage(currentLanguage === 'sw' ? 'Tafadhali chora mchoro wa sasa' : 'Please draw current pattern');
      if (!newPattern || newPattern.length < 4) return showInlineMessage(currentLanguage === 'sw' ? 'Mchoro mpya lazima uwe na angalau nukta 4' : 'New pattern must have at least 4 points');
      if (JSON.stringify(newPattern) !== JSON.stringify(confirmPattern)) return showInlineMessage(currentLanguage === 'sw' ? 'Michoro haifanani' : 'Patterns do not match');
      if (JSON.stringify(currentPattern) === JSON.stringify(newPattern)) return showInlineMessage(currentLanguage === 'sw' ? 'Mchoro mpya lazima utofautiane' : 'New pattern must be different');
    }

    // disallow changing biometric from here
    if (authMethod === 'biometric') {
      return showInlineMessage(currentLanguage === 'sw' ? 'Haiwezekani kubadilisha biometric hapa' : 'Cannot change biometric here');
    }

    setLoading(true);

    try {
      let currentCandidate = '';
      let newValue = '';

      if (authMethod === 'password') {
        currentCandidate = currentPassword;
        newValue = newPassword;
      } else if (authMethod === 'pin') {
        currentCandidate = currentPin;
        newValue = newPin;
      } else if (authMethod === 'pattern') {
        currentCandidate = JSON.stringify(currentPattern);
        newValue = JSON.stringify(newPattern);
      }

      const isValid = await DataService.verifyAuthValue(currentCandidate);
      if (!isValid) {
        showInlineMessage(currentLanguage === 'sw' ? 'Thibitisha password/PIN/mchoro ya sasa' : 'Current password/PIN/pattern is incorrect');
        setLoading(false);
        return;
      }

      await DataService.changePassword(currentCandidate, newValue);

      // Keep authMethod consistent in settings (no surprise)
      await DataService.updateSettings({ authMethod });

      showInlineMessage(currentLanguage === 'sw' ? 'Imefanikiwa. Thibitisha mpya imewekwa' : 'Success. Authentication value changed', 'success', 1800);

      setTimeout(() => {
        resetAll();
        onSuccess && onSuccess();
        onClose();
      }, 1200);
    } catch (error: any) {
      console.error('Change password error', error);
      showInlineMessage(error?.message || (currentLanguage === 'sw' ? 'Imeshindwa kubadilisha' : 'Failed to change password'));
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverWithCode = async () => {
    clearInlineMessage();

    if (!recoveryCodeInput || recoveryCodeInput.trim().length === 0) return showInlineMessage(currentLanguage === 'sw' ? 'Weka recovery code' : 'Enter recovery code');
    if (!newPassword.trim()) return showInlineMessage(currentLanguage === 'sw' ? 'Weka password mpya' : 'Enter new password');
    if (newPassword.length < minPasswordLen) return showInlineMessage(currentLanguage === 'sw' ? 'Password ni fupi' : 'Password too short');
    if (newPassword !== confirmPassword) return showInlineMessage(currentLanguage === 'sw' ? 'Password hazifanani' : 'Passwords do not match');

    setLoading(true);
    try {
      const ok = await DataService.verifyRecoveryCode(recoveryCodeInput.trim());
      if (!ok) {
        showInlineMessage(currentLanguage === 'sw' ? 'Recovery code si sahihi' : 'Invalid recovery code');
        setLoading(false);
        return;
      }

      // set new password (and make sure auth method is password)
      await DataService.recoverPasswordWithCode(recoveryCodeInput.trim(), newPassword);
      await DataService.updateSettings({ authMethod: 'password' });

      showInlineMessage(currentLanguage === 'sw' ? 'Nywila imewekwa kwa kutumia recovery code' : 'Password set using recovery code', 'success', 1800);

      setTimeout(() => {
        resetAll();
        onSuccess && onSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Recover error', err);
      showInlineMessage(err?.message || (currentLanguage === 'sw' ? 'Imeshindwa kurejesha' : 'Failed to recover'));
    } finally {
      setLoading(false);
    }
  };

  const PatternGrid = ({ pattern, onChange }: { pattern: number[]; onChange: (p: number[]) => void }) => {
    const toggle = (i: number) => {
      const exists = pattern.includes(i);
      const next = exists ? pattern.filter(p => p !== i) : [...pattern, i];
      onChange(next);
    };

    return (
      <View style={styles.patternGrid}>
        {Array.from({ length: 9 }, (_, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.patternPoint, pattern.includes(i) && { backgroundColor: theme.primary }]}
            onPress={() => toggle(i)}
            accessibilityLabel={`pattern-point-${i}`}
          />
        ))}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        resetAll();
        onClose();
      }}
    >
      <KeyboardAvoidingView style={[styles.container, { backgroundColor: theme.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { backgroundColor: theme.primary }]}>
          <Text style={[styles.headerTitle, { color: theme.surface }]}>
            {t('changePassword', currentLanguage === 'sw' ? 'Badilisha Nenosiri' : 'Change Password')}
          </Text>
          <TouchableOpacity
            onPress={() => {
              resetAll();
              onClose();
            }}
            style={styles.closeButton}
            accessibilityLabel="close-change-password"
          >
            <X size={24} color={theme.surface} />
          </TouchableOpacity>
        </View>

        {inlineMsg ? (
          <View style={[styles.inlineBanner, inlineMsg.type === 'error' ? { backgroundColor: theme.error } : inlineMsg.type === 'success' ? { backgroundColor: theme.success } : { backgroundColor: theme.primary }]}>
            <Text style={[styles.inlineBannerText, { color: '#fff' }]} numberOfLines={2}>{inlineMsg.text}</Text>
            <TouchableOpacity onPress={clearInlineMessage} style={styles.inlineBannerClose}>
              <X size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.content}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={[styles.description, { color: theme.textSecondary, flex: 1 }]}>
              {currentLanguage === 'sw' ? 'Badilisha njia ya kuingia: password, PIN au pattern' : 'Change your authentication (password, PIN or pattern)'}
            </Text>

            <TouchableOpacity onPress={() => { setRecoveryMode(m => !m); clearInlineMessage(); }}>
              <Text style={{ color: theme.primary, fontWeight: '600' }}>
                {recoveryMode ? (currentLanguage === 'sw' ? 'Rudi' : 'Back') : (currentLanguage === 'sw' ? 'Tumia Recovery Code' : 'Use Recovery Code')}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ marginBottom: 12 }}>
            {recoveryMode ? (
              <>
                <Text style={[styles.inputLabel, { color: theme.text }]}>{currentLanguage === 'sw' ? 'Recovery code' : 'Recovery code'}</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                  placeholder={currentLanguage === 'sw' ? 'Weka recovery code' : 'Enter recovery code'}
                  placeholderTextColor={theme.textSecondary}
                  value={recoveryCodeInput}
                  onChangeText={setRecoveryCodeInput}
                  autoCapitalize="characters"
                  editable={!loading}
                />

                <Text style={[styles.inputLabel, { color: theme.text, marginTop: 10 }]}>{currentLanguage === 'sw' ? 'Password mpya' : 'New password'}</Text>
                <View style={styles.inputContainer}>
                  <Lock size={20} color={theme.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.passwordInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                    placeholder={currentLanguage === 'sw' ? 'Weka password mpya' : 'Enter new password'}
                    placeholderTextColor={theme.textSecondary}
                    secureTextEntry={!showNewPassword}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    autoCapitalize="none"
                    editable={!loading}
                  />
                  <TouchableOpacity style={styles.eyeButton} onPress={() => setShowNewPassword(!showNewPassword)}>
                    {showNewPassword ? <EyeOff size={20} color={theme.textSecondary} /> : <Eye size={20} color={theme.textSecondary} />}
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                  placeholder={currentLanguage === 'sw' ? 'Thibitisha password mpya' : 'Confirm new password'}
                  placeholderTextColor={theme.textSecondary}
                  secureTextEntry={!showNewPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  autoCapitalize="none"
                  editable={!loading}
                />
              </>
            ) : (
              <>
                <Text style={[styles.inputLabel, { color: theme.text }]}>{currentLanguage === 'sw' ? 'Thibitisha sasa' : 'Current'}</Text>

                {authMethod === 'password' && (
                  <View style={styles.inputContainer}>
                    <Lock size={20} color={theme.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.passwordInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                      placeholder={currentLanguage === 'sw' ? 'Ingiza password ya sasa' : 'Enter current password'}
                      placeholderTextColor={theme.textSecondary}
                      secureTextEntry={!showCurrentPassword}
                      value={currentPassword}
                      onChangeText={setCurrentPassword}
                      autoCapitalize="none"
                      editable={!loading}
                    />
                    <TouchableOpacity style={styles.eyeButton} onPress={() => setShowCurrentPassword(!showCurrentPassword)}>
                      {showCurrentPassword ? <EyeOff size={20} color={theme.textSecondary} /> : <Eye size={20} color={theme.textSecondary} />}
                    </TouchableOpacity>
                  </View>
                )}

                {authMethod === 'pin' && (
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                    placeholder={currentLanguage === 'sw' ? 'Ingiza PIN ya sasa' : 'Enter current PIN'}
                    placeholderTextColor={theme.textSecondary}
                    value={currentPin}
                    onChangeText={setCurrentPin}
                    keyboardType="numeric"
                    secureTextEntry
                    editable={!loading}
                  />
                )}

                {authMethod === 'pattern' && <PatternGrid pattern={currentPattern} onChange={setCurrentPattern} />}
              </>
            )}
          </View>

          {!recoveryMode && (
            <View>
              <Text style={[styles.inputLabel, { color: theme.text }]}>{currentLanguage === 'sw' ? 'Mabadiliko mapya' : 'New value'}</Text>

              {authMethod === 'password' && (
                <>
                  <View style={styles.inputContainer}>
                    <Lock size={20} color={theme.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.passwordInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                      placeholder={currentLanguage === 'sw' ? 'Ingiza password mpya' : 'Enter new password'}
                      placeholderTextColor={theme.textSecondary}
                      secureTextEntry={!showNewPassword}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      autoCapitalize="none"
                      editable={!loading}
                    />
                    <TouchableOpacity style={styles.eyeButton} onPress={() => setShowNewPassword(!showNewPassword)}>
                      {showNewPassword ? <EyeOff size={20} color={theme.textSecondary} /> : <Eye size={20} color={theme.textSecondary} />}
                    </TouchableOpacity>
                  </View>

                  <TextInput
                    style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                    placeholder={currentLanguage === 'sw' ? 'Thibitisha password mpya' : 'Confirm new password'}
                    placeholderTextColor={theme.textSecondary}
                    secureTextEntry={!showNewPassword}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    autoCapitalize="none"
                    editable={!loading}
                  />
                </>
              )}

              {authMethod === 'pin' && (
                <>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                    placeholder={currentLanguage === 'sw' ? 'Tengeneza PIN mpya' : 'Create new PIN'}
                    placeholderTextColor={theme.textSecondary}
                    value={newPin}
                    onChangeText={setNewPin}
                    keyboardType="numeric"
                    secureTextEntry
                    editable={!loading}
                  />

                  <TextInput
                    style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                    placeholder={currentLanguage === 'sw' ? 'Thibitisha PIN mpya' : 'Confirm new PIN'}
                    placeholderTextColor={theme.textSecondary}
                    value={confirmPin}
                    onChangeText={setConfirmPin}
                    keyboardType="numeric"
                    secureTextEntry
                    editable={!loading}
                  />
                </>
              )}

              {authMethod === 'pattern' && (
                <>
                  <Text style={[styles.patternLabel, { color: theme.text }]}>{currentLanguage === 'sw' ? 'Chora mchoro mpya' : 'Draw new pattern'}</Text>
                  <PatternGrid pattern={newPattern} onChange={setNewPattern} />
                  <Text style={[styles.patternLabel, { color: theme.text }]}>{currentLanguage === 'sw' ? 'Thibitisha mchoro mpya' : 'Confirm new pattern'}</Text>
                  <PatternGrid pattern={confirmPattern} onChange={setConfirmPattern} />
                </>
              )}
            </View>
          )}

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: loading ? theme.textSecondary : theme.primary, marginTop: 18 }]}
            onPress={validateAndSubmit}
            disabled={loading}
          >
            <Text style={[styles.saveButtonText, { color: theme.surface }]}>
              {loading
                ? currentLanguage === 'sw' ? 'Inabadilisha...' : 'Changing...'
                : recoveryMode
                  ? (currentLanguage === 'sw' ? 'Weka kwa Recovery' : 'Set with Recovery')
                  : (currentLanguage === 'sw' ? 'Badilisha' : 'Change')}
            </Text>
          </TouchableOpacity>

          <Text style={[styles.hintText, { color: theme.textSecondary, marginTop: 12 }]}>
            {currentLanguage === 'sw'
              ? 'Recovery code itakwekwa wakati wa usajili. Andika mahali salama.'
              : 'A single recovery code is stored during setup. Please write it down in a safe place.'}
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: Platform.OS === 'ios' ? 64 : 20 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  closeButton: { padding: 4 },
  content: { flex: 1, padding: 20 },
  description: { fontSize: 14, marginBottom: 12, textAlign: 'left' },
  inputContainer: { position: 'relative', flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  inputIcon: { position: 'absolute', left: 12, zIndex: 1 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, paddingLeft: 44, fontSize: 16, marginBottom: 8 },
  passwordInput: { borderWidth: 1, borderRadius: 10, padding: 12, paddingLeft: 44, paddingRight: 44, fontSize: 16, marginBottom: 8 },
  eyeButton: { position: 'absolute', right: 12 },
  saveButton: { padding: 14, borderRadius: 10, alignItems: 'center' },
  saveButtonText: { fontSize: 16, fontWeight: '600' },
  inlineBanner: { marginHorizontal: 16, marginBottom: 12, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  inlineBannerText: { flex: 1, fontSize: 14, fontWeight: '600' },
  inlineBannerClose: { marginLeft: 12, padding: 6 },
  patternGrid: { flexDirection: 'row', flexWrap: 'wrap', width: 120, height: 120, alignSelf: 'center', marginVertical: 8 },
  patternPoint: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e5e7eb', margin: 4 },
  patternLabel: { fontSize: 14, fontWeight: '500', marginBottom: 8, textAlign: 'center' },
  inputLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  hintText: { fontSize: 12, marginTop: 6 },
});
