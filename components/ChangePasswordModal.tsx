// components/ChangePasswordModal.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { Lock, Eye, EyeOff, X } from 'lucide-react-native';
import { DataService } from '@/services/DataService';
import { LanguageService } from '@/services/LanguageService';
import { useTheme } from '@/app/providers/ThemeProvider';

interface ChangePasswordModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ChangePasswordModal({ visible, onClose, onSuccess }: ChangePasswordModalProps) {
  const { theme } = useTheme();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const currentLanguage = LanguageService.getCurrentLanguage();

  const handleChangePassword = async () => {
    if (!currentPassword.trim()) {
      Alert.alert(
        LanguageService.t('error'),
        currentLanguage === 'sw' ? 'Ingiza password ya sasa' : 'Enter current password'
      );
      return;
    }

    if (!newPassword.trim()) {
      Alert.alert(
        LanguageService.t('error'),
        currentLanguage === 'sw' ? 'Ingiza password mpya' : 'Enter new password'
      );
      return;
    }

    if (newPassword.length < 4) {
      Alert.alert(
        LanguageService.t('error'),
        LanguageService.t('passwordTooShort')
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert(
        LanguageService.t('error'),
        LanguageService.t('passwordMismatch')
      );
      return;
    }

    if (currentPassword === newPassword) {
      Alert.alert(
        LanguageService.t('error'),
        currentLanguage === 'sw' ? 'Password mpya lazima iwe tofauti na ya zamani' : 'New password must be different from current password'
      );
      return;
    }

    setLoading(true);
    try {
      await DataService.changePassword(currentPassword, newPassword);
      
      Alert.alert(
        LanguageService.t('success'),
        LanguageService.t('passwordChanged'),
        [
          {
            text: LanguageService.t('ok'),
            onPress: () => {
              setCurrentPassword('');
              setNewPassword('');
              setConfirmPassword('');
              onSuccess();
              onClose();
            }
          }
        ]
      );
    } catch (error: any) {
      Alert.alert(
        LanguageService.t('error'),
        error.message || LanguageService.t('networkError')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.primary }]}>
          <Text style={[styles.headerTitle, { color: theme.surface }]}>
            {LanguageService.t('changePassword')}
          </Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <X size={24} color={theme.surface} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={[styles.description, { color: theme.textSecondary }]}>
            {currentLanguage === 'sw' 
              ? 'Ingiza password yako ya sasa na password mpya ili kubadilisha'
              : 'Enter your current password and new password to change'
            }
          </Text>

          {/* Current Password */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>
              {currentLanguage === 'sw' ? 'Password ya Sasa' : 'Current Password'}
            </Text>
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
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowCurrentPassword(!showCurrentPassword)}
              >
                {showCurrentPassword ? (
                  <EyeOff size={20} color={theme.textSecondary} />
                ) : (
                  <Eye size={20} color={theme.textSecondary} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* New Password */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>
              {currentLanguage === 'sw' ? 'Password Mpya' : 'New Password'}
            </Text>
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
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowNewPassword(!showNewPassword)}
              >
                {showNewPassword ? (
                  <EyeOff size={20} color={theme.textSecondary} />
                ) : (
                  <Eye size={20} color={theme.textSecondary} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm New Password */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>
              {currentLanguage === 'sw' ? 'Thibitisha Password Mpya' : 'Confirm New Password'}
            </Text>
            <View style={styles.inputContainer}>
              <Lock size={20} color={theme.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.passwordInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                placeholder={currentLanguage === 'sw' ? 'Thibitisha password mpya' : 'Confirm new password'}
                placeholderTextColor={theme.textSecondary}
                secureTextEntry={!showConfirmPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <EyeOff size={20} color={theme.textSecondary} />
                ) : (
                  <Eye size={20} color={theme.textSecondary} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Security Tips */}
          <View style={[styles.securityTips, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.securityTitle, { color: theme.text }]}>
              {currentLanguage === 'sw' ? 'Vidokezo vya Usalama:' : 'Security Tips:'}
            </Text>
            <Text style={[styles.securityTip, { color: theme.textSecondary }]}>
              • {currentLanguage === 'sw' ? 'Tumia angalau herufi 4' : 'Use at least 4 characters'}
            </Text>
            <Text style={[styles.securityTip, { color: theme.textSecondary }]}>
              • {currentLanguage === 'sw' ? 'Changanya herufi na namba' : 'Mix letters and numbers'}
            </Text>
            <Text style={[styles.securityTip, { color: theme.textSecondary }]}>
              • {currentLanguage === 'sw' ? 'Usitumie password rahisi' : 'Avoid common passwords'}
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={handleClose}
              disabled={loading}
            >
              <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>
                {LanguageService.t('cancel')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: loading ? theme.textSecondary : theme.primary }]}
              onPress={handleChangePassword}
              disabled={loading}
            >
              <Text style={[styles.saveButtonText, { color: theme.surface }]}>
                {loading 
                  ? (currentLanguage === 'sw' ? 'Inabadilisha...' : 'Changing...')
                  : (currentLanguage === 'sw' ? 'Badilisha' : 'Change')
                }
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 60,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  description: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: 16,
    zIndex: 1,
  },
  passwordInput: {
    borderWidth: 1,
    borderRadius: 12,
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
  securityTips: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
  },
  securityTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  securityTip: {
    fontSize: 14,
    marginBottom: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});