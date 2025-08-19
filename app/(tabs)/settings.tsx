// app/(tabs)/settings.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Shield,
  Download,
  Upload,
  Trash2,
  Info,
  Lock,
  User,
  CircleHelp as HelpCircle,
  Phone,
  CreditCard as Edit,
  LogOut,
  Moon,
  Sun,
  Globe,
} from 'lucide-react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { DataService } from '@/services/DataService';
import { LanguageService, Translations } from '@/services/LanguageService';
import { UserProfile } from '@/types/Report';
import { router } from 'expo-router';
import { useTheme } from '../providers/ThemeProvider';
import ChangePasswordModal from '@/components/ChangePasswordModal';

type LangKey = 'sw' | 'en';

export default function SettingsScreen() {
  const { theme, mode, setMode } = useTheme();

  const [loading, setLoading] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [translations, setTranslations] = useState<Translations | null>(null);
  const [currentLanguage, setCurrentLanguage] = useState<LangKey>('sw');

  // Change password modal state
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

  useEffect(() => {
    let unsub: (() => void) | null = null;

    (async () => {
      // ensure LanguageService is initialized before we try to read translations
      try {
        await LanguageService.initialize();
      } catch (e) {
        console.warn('LanguageService.initialize failed', e);
      }

      try {
        await checkBiometricAvailability();
        await loadAll();
      } catch (e) {
        console.error('init load error', e);
      } finally {
        setLoading(false);
      }
    })();

    // subscribe to language changes so UI updates automatically
    unsub = LanguageService.subscribe(() => {
      try {
        setTranslations(LanguageService.getCurrentTranslations());
        setCurrentLanguage(LanguageService.getCurrentLanguage());
      } catch (e) {
        console.warn('Language subscription callback error', e);
      }
    });

    return () => {
      if (unsub) unsub();
    };
  }, []);

  const loadAll = async () => {
    try {
      const settings = await DataService.getSettings();
      const profile = await DataService.getUserProfile();
      // getCurrentTranslations is synchronous in the service, no need to await
      const trans = LanguageService.getCurrentTranslations();

      setTranslations(trans);
      setUserProfile(profile);
      if (profile) {
        setEditName(profile.fullName || '');
        setEditPhone(profile.phoneNumber || '');
      }

      setCurrentLanguage((settings && (settings.language === 'en' ? 'en' : 'sw')) || 'sw');
      setBiometricEnabled(Boolean(settings?.biometricEnabled));
    } catch (error) {
      console.error('Error loading settings screen data:', error);
    }
  };

  const checkBiometricAvailability = async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(compatible && enrolled);
    } catch (err) {
      setBiometricAvailable(false);
    }
  };

  const toggleBiometric = async (value: boolean) => {
    try {
      if (value && biometricAvailable) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: translations?.save ?? 'Thibitisha ili kuwezesha kuingia kwa fingerprint',
          fallbackLabel: translations?.ok ?? 'Tumia password',
        });

        if (result.success) {
          setBiometricEnabled(true);
          await DataService.updateSettings({ biometricEnabled: true });
        }
      } else {
        setBiometricEnabled(false);
        await DataService.updateSettings({ biometricEnabled: false });
      }
    } catch (error) {
      console.error('toggleBiometric error:', error);
      Alert.alert(translations?.error ?? 'Hitilafu', translations?.networkError ?? 'Imeshindwa kubadilisha uthibitishaji wa biometric.');
    }
  };

  const saveProfileChanges = async () => {
    if (!userProfile) return;

    if (!editName.trim()) {
      Alert.alert(translations?.error ?? 'Hitilafu', translations?.fieldRequired ?? 'Jina kamili linahitajika');
      return;
    }

    if (!editPhone.trim()) {
      Alert.alert(translations?.error ?? 'Hitilafu', translations?.invalidPhone ?? 'Namba ya simu inahitajika');
      return;
    }

    try {
      const updatedProfile: UserProfile = {
        ...userProfile,
        fullName: editName.trim(),
        phoneNumber: editPhone.trim(),
        updatedAt: new Date().toISOString(),
      };

      await DataService.saveUserProfile(updatedProfile);
      setUserProfile(updatedProfile);
      setEditingProfile(false);
      Alert.alert(translations?.success ?? 'Imehifadhiwa!', translations?.profileUpdated ?? 'Wasifu umesasishwa kikamilifu');
    } catch (error) {
      console.error('saveProfileChanges error:', error);
      Alert.alert(translations?.error ?? 'Hitilafu', translations?.networkError ?? 'Imeshindwa kusasisha wasifu');
    }
  };

  const clearAllData = () => {
    Alert.alert(
      translations?.of ? 'Futa Taarifa Zote' : 'Futa Taarifa Zote',
      'Hii itafuta kabisa taarifa zako zote na haiwezi kurudishwa. Una uhakika?',
      [
        { text: translations?.cancel ?? 'Ghairi', style: 'cancel' },
        {
          text: 'Futa Zote',
          style: 'destructive',
          onPress: async () => {
            try {
              await DataService.clearAllData();
              Alert.alert(translations?.success ?? 'Imekamilika', translations?.dataCleared ?? 'Taarifa zote zimefutwa.');
            } catch (error) {
              console.error('clearAllData error:', error);
              Alert.alert(translations?.error ?? 'Hitilafu', translations?.networkError ?? 'Imeshindwa kufuta taarifa.');
            }
          },
        },
      ]
    );
  };

  const exportData = async () => {
    try {
      const json = await DataService.exportAllData();
      console.log('exported data length', json.length);
      Alert.alert(translations?.success ?? 'Imekamilika!', translations?.dataExported ?? 'Taarifa zimehamishwa kikamilifu!');
    } catch (error) {
      console.error('exportData error:', error);
      Alert.alert(translations?.error ?? 'Hitilafu', translations?.networkError ?? 'Imeshindwa kuhamisha taarifa.');
    }
  };

  const changePassword = () => {
    setShowChangePasswordModal(true);
  };

  const handlePasswordChangeSuccess = () => {
    // Optionally show success message or refresh data
    console.log('Password changed successfully');
  };

  const handleLogout = () => {
    Alert.alert(
      currentLanguage === 'sw' ? 'Toka' : 'Logout',
      currentLanguage === 'sw' ? 'Una uhakika unataka kutoka?' : 'Are you sure you want to logout?',
      [
        { text: currentLanguage === 'sw' ? 'Ghairi' : 'Cancel', style: 'cancel' },
        {
          text: currentLanguage === 'sw' ? 'Toka' : 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await DataService.logout();
              // Force complete app restart by clearing navigation stack
              router.dismissAll();
              router.replace('/(tabs)');
            } catch (error) {
              console.error('logout error:', error);
              Alert.alert(
                currentLanguage === 'sw' ? translations?.error ?? 'Hitilafu' : 'Error',
                currentLanguage === 'sw' ? 'Imeshindwa kutoka' : 'Failed to logout'
              );
            }
          },
        },
      ]
    );
  };

  const toggleTheme = async () => {
    try {
      const newTheme = mode === 'dark' ? 'light' : 'dark';
      await setMode(newTheme);
      await DataService.updateSettings({ theme: newTheme });
    } catch (error) {
      console.error('toggleTheme error:', error);
      Alert.alert(translations?.error ?? 'Hitilafu', 'Imeshindwa kubadili muonekano.');
    }
  };

  const toggleLanguage = async () => {
    try {
      const newLang: LangKey = currentLanguage === 'sw' ? 'en' : 'sw';
      await LanguageService.setLanguage(newLang);
      // LanguageService.subscribe will update translations and currentLanguage for us,
      // but update local state immediately so the UI feels snappy
      setCurrentLanguage(newLang);
      setTranslations(LanguageService.getCurrentTranslations());
      await DataService.updateSettings({ language: newLang });
    } catch (error) {
      console.error('toggleLanguage error:', error);
      Alert.alert(translations?.error ?? 'Hitilafu', 'Imeshindwa kubadilisha lugha.');
    }
  };

  const SettingItem = ({
    title,
    subtitle,
    icon: Icon,
    onPress,
    showSwitch = false,
    switchValue = false,
    onSwitchChange,
    danger = false,
  }: any) => (
    <TouchableOpacity
      style={[
        styles.settingItem,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
        },
      ]}
      onPress={onPress}
      disabled={showSwitch}
      activeOpacity={0.8}
    >
      <View style={styles.settingLeft}>
        <View
          style={[
            styles.settingIcon,
            { backgroundColor: (danger ? theme.error : theme.primary) + '20' },
          ]}
        >
          <Icon size={20} color={danger ? theme.error : theme.primary} />
        </View>
        <View style={styles.settingText}>
          <Text style={[styles.settingTitle, { color: danger ? theme.error : theme.text }]}>{title}</Text>
          <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
        </View>
      </View>
      {showSwitch && (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          trackColor={{ false: theme.border, true: theme.primary }}
          thumbColor={switchValue ? '#ffffff' : '#f3f4f6'}
        />
      )}
    </TouchableOpacity>
  );

  const dynamicStyles = useMemo(() => createDynamicStyles(theme), [theme]);

  if (loading || !translations) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={{ marginTop: 40, alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.text, marginTop: 12 }]}>{translations?.loading ?? 'Loading...'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.primary }]}>
          <Text style={[styles.headerTitle, { color: theme.surface }]}>{translations.settings}</Text>
          <Text style={[styles.headerSubtitle, { color: theme.surface + '80' }]}> 
            {currentLanguage === 'sw' ? 'Simamia mapendeleo yako na taarifa' : 'Manage your preferences and data'}
          </Text>
        </View>

        {/* User Profile Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{translations.userProfile}</Text>

          {editingProfile ? (
            <View style={dynamicStyles.profileEditCard}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>{translations.fullName}</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder={translations.fullName}
                  placeholderTextColor={theme.textSecondary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>{translations.phoneNumber}</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder={translations.phoneNumber}
                  keyboardType="phone-pad"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>

              <View style={styles.profileEditActions}>
                <TouchableOpacity
                  style={[styles.cancelButton, { backgroundColor: theme.surface }]}
                  onPress={() => {
                    setEditingProfile(false);
                    setEditName(userProfile?.fullName || '');
                    setEditPhone(userProfile?.phoneNumber || '');
                  }}
                >
                  <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>{translations.cancel}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveButton, { backgroundColor: theme.primary }]}
                  onPress={saveProfileChanges}
                >
                  <Text style={[styles.saveButtonText, { color: theme.surface }]}>{translations.save}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={[dynamicStyles.profileCard]}>
              <View style={styles.profileInfo}>
                <User size={24} color={theme.primary} />
                <View style={styles.profileDetails}>
                  <Text style={[styles.profileName, { color: theme.text }]}>{userProfile?.fullName || '-'}</Text>
                  <Text style={[styles.profilePhone, { color: theme.textSecondary }]}>{userProfile?.phoneNumber || '-'}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.editProfileButton, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => setEditingProfile(true)}
              >
                <Edit size={16} color={theme.primary} />
                <Text style={[styles.editProfileButtonText, { color: theme.primary, marginLeft: 8 }]}>{translations.edit}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Appearance & Language */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {translations.appearanceLanguage}
          </Text>

          <SettingItem
            title={translations.theme}
            subtitle={mode === 'light' ? translations.lightMode : translations.darkMode}
            icon={mode === 'light' ? Sun : Moon}
            showSwitch
            switchValue={mode === 'dark'}
            onSwitchChange={toggleTheme}
          />

          <SettingItem
            title={translations.language}
            subtitle={currentLanguage === 'sw' ? translations.swahili : translations.english}
            icon={Globe}
            showSwitch
            switchValue={currentLanguage === 'en'}
            onSwitchChange={toggleLanguage}
          />
        </View>

        {/* Security Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{translations.security}</Text>

          <SettingItem
            title={translations.fingerprintAuth}
            subtitle={
              biometricAvailable
                ? currentLanguage === 'sw'
                  ? 'Tumia fingerprint au face ID'
                  : 'Use fingerprint or face ID'
                : currentLanguage === 'sw'
                ? 'Haipatikani kwenye kifaa hiki'
                : 'Not available on this device'
            }
            icon={Shield}
            showSwitch
            switchValue={biometricEnabled}
            onSwitchChange={toggleBiometric}
          />

          <SettingItem
            title={translations.changePassword}
            subtitle={currentLanguage === 'sw' ? 'Sasisha password yako ya kuingia' : 'Update your login password'}
            icon={Lock}
            onPress={changePassword}
          />

          <SettingItem title={translations.logout} subtitle={currentLanguage === 'sw' ? 'Toka kwenye mfumo' : 'Sign out of the app'} icon={LogOut} onPress={handleLogout} danger />
        </View>

        {/* Data Management */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{translations.dataManagement}</Text>

          <SettingItem title={translations.exportData} subtitle={translations.dataExported} icon={Download} onPress={exportData} />

          <SettingItem
            title={translations.importData}
            subtitle={currentLanguage === 'sw' ? 'Rejesha taarifa kutoka faili la backup' : 'Restore data from a backup file'}
            icon={Upload}
            onPress={() => Alert.alert(translations.help ?? 'Taarifa', 'Utaratibu wa kuingiza taarifa utakuja hivi karibuni')}
          />

          <SettingItem title={translations.clearAllData} subtitle={currentLanguage === 'sw' ? 'Futa kabisa taarifa zote' : 'Delete all stored data'} icon={Trash2} onPress={clearAllData} danger />
        </View>

        {/* App Information */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{translations.appInfo}</Text>

          <SettingItem
            title={translations.about}
            subtitle={'Toleo 2.0.0 - DODOMA CTF 2025'}
            icon={Info}
            onPress={() =>
              Alert.alert(
                translations.about ?? 'Kuhusu',
                'DODOMA CTF 2025 Mfumo wa Taarifa za Uuzaji wa Wanafunzi\nToleo 2.0.0\n\nUmetengenezwa kwa Programu ya Uuzaji wa Wanafunzi wa Kanisa la SDA'
              )
            }
          />

          <SettingItem
            title={translations.help}
            subtitle={currentLanguage === 'sw' ? 'Pata msaada wa kutumia programu' : 'Get help using the app'}
            icon={HelpCircle}
            onPress={() => Alert.alert(translations.help ?? 'Msaada', 'Kwa msaada, wasiliana na mratibu wa programu yako au idara ya IT.')}
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>© 2025 Kanisa la SDA - Programu ya DODOMA CTF ya Uuzaji wa Wanafunzi</Text>
        </View>
      </ScrollView>
      
      <ChangePasswordModal
        visible={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
        onSuccess={handlePasswordChangeSuccess}
      />
    </SafeAreaView>
  );
}

const createDynamicStyles = (theme: any) =>
  StyleSheet.create({
    profileCard: {
      backgroundColor: theme.card,
      padding: 16,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    profileEditCard: {
      backgroundColor: theme.card,
      padding: 16,
      borderRadius: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
  });

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
  },
  section: {
    margin: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  loadingText: {
    textAlign: 'center',
    fontSize: 16,
    marginTop: 32,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileDetails: {
    marginLeft: 12,
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  profilePhone: {
    fontSize: 14,
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  editProfileButtonText: {
    fontWeight: '500',
    marginLeft: 4,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  profileEditActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 0.48,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelButtonText: {
    fontWeight: '500',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 0.48,
    alignItems: 'center',
  },
  saveButtonText: {
    fontWeight: '500',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
  },
  footer: {
    padding: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
  },
});
