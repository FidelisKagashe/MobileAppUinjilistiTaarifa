import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Shield, Download, Upload, Trash2, Info, Lock, User, CircleHelp as HelpCircle, Phone, CreditCard as Edit } from 'lucide-react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { DataService } from '@/services/DataService';
import { UserProfile } from '@/types/Report';

export default function SettingsScreen() {
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  useEffect(() => {
    checkBiometricAvailability();
    loadSettings();
    loadUserProfile();
  }, []);

  const checkBiometricAvailability = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    setBiometricAvailable(compatible && enrolled);
  };

  const loadSettings = async () => {
    try {
      const settings = await DataService.getSettings();
      setBiometricEnabled(settings.biometricEnabled || false);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const loadUserProfile = async () => {
    try {
      const profile = await DataService.getUserProfile();
      setUserProfile(profile);
      if (profile) {
        setEditName(profile.fullName);
        setEditPhone(profile.phoneNumber);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const toggleBiometric = async (value: boolean) => {
    if (value && biometricAvailable) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Thibitisha ili kuwezesha kuingia kwa fingerprint',
        fallbackLabel: 'Tumia password',
      });

      if (result.success) {
        setBiometricEnabled(true);
        await DataService.updateSettings({ biometricEnabled: true });
      }
    } else {
      setBiometricEnabled(false);
      await DataService.updateSettings({ biometricEnabled: false });
    }
  };

  const saveProfileChanges = async () => {
    if (!userProfile) return;

    if (!editName.trim()) {
      Alert.alert('Hitilafu', 'Jina kamili linahitajika');
      return;
    }

    if (!editPhone.trim()) {
      Alert.alert('Hitilafu', 'Namba ya simu inahitajika');
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
      Alert.alert('Imehifadhiwa!', 'Wasifu umesasishwa kikamilifu');
    } catch (error) {
      Alert.alert('Hitilafu', 'Imeshindwa kusasisha wasifu');
    }
  };

  const clearAllData = () => {
    Alert.alert(
      'Futa Taarifa Zote',
      'Hii itafuta kabisa taarifa zako zote na haiwezi kurudishwa. Una uhakika?',
      [
        { text: 'Ghairi', style: 'cancel' },
        {
          text: 'Futa Zote',
          style: 'destructive',
          onPress: async () => {
            try {
              await DataService.clearAllData();
              Alert.alert('Imekamilika', 'Taarifa zote zimefutwa.');
            } catch (error) {
              Alert.alert('Hitilafu', 'Imeshindwa kufuta taarifa.');
            }
          },
        },
      ]
    );
  };

  const exportData = async () => {
    try {
      await DataService.exportAllData();
      Alert.alert('Imekamilika!', 'Taarifa zimehamishwa kikamilifu!');
    } catch (error) {
      Alert.alert('Hitilafu', 'Imeshindwa kuhamisha taarifa.');
    }
  };

  const changePassword = () => {
    Alert.alert(
      'Badilisha Password',
      'Utaratibu wa kubadilisha password utaongezwa katika toleo lijalo.',
      [{ text: 'Sawa' }]
    );
  };

  const SettingItem = ({ 
    title, 
    subtitle, 
    icon: Icon, 
    onPress, 
    showSwitch = false, 
    switchValue = false, 
    onSwitchChange,
    danger = false 
  }: any) => (
    <TouchableOpacity 
      style={styles.settingItem} 
      onPress={onPress}
      disabled={showSwitch}
    >
      <View style={styles.settingLeft}>
        <View style={[styles.settingIcon, danger && styles.settingIconDanger]}>
          <Icon size={20} color={danger ? '#dc2626' : '#1e3a8a'} />
        </View>
        <View style={styles.settingText}>
          <Text style={[styles.settingTitle, danger && styles.settingTitleDanger]}>
            {title}
          </Text>
          <Text style={styles.settingSubtitle}>{subtitle}</Text>
        </View>
      </View>
      {showSwitch && (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          trackColor={{ false: '#e5e7eb', true: '#1e3a8a' }}
          thumbColor={switchValue ? '#ffffff' : '#f3f4f6'}
        />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mipangilio</Text>
          <Text style={styles.headerSubtitle}>Simamia mapendeleo yako na taarifa</Text>
        </View>

        {/* User Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Wasifu wa Mtumiaji</Text>
          
          {editingProfile ? (
            <View style={styles.profileEditCard}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Jina Kamili</Text>
                <TextInput
                  style={styles.input}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Ingiza jina kamili"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Namba ya Simu</Text>
                <TextInput
                  style={styles.input}
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder="Ingiza namba ya simu"
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.profileEditActions}>
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={() => {
                    setEditingProfile(false);
                    setEditName(userProfile?.fullName || '');
                    setEditPhone(userProfile?.phoneNumber || '');
                  }}
                >
                  <Text style={styles.cancelButtonText}>Ghairi</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.saveButton}
                  onPress={saveProfileChanges}
                >
                  <Text style={styles.saveButtonText}>Hifadhi</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.profileCard}>
              <View style={styles.profileInfo}>
                <User size={24} color="#1e3a8a" />
                <View style={styles.profileDetails}>
                  <Text style={styles.profileName}>{userProfile?.fullName}</Text>
                  <Text style={styles.profilePhone}>{userProfile?.phoneNumber}</Text>
                </View>
              </View>
              <TouchableOpacity 
                style={styles.editProfileButton}
                onPress={() => setEditingProfile(true)}
              >
                <Edit size={16} color="#1e3a8a" />
                <Text style={styles.editProfileButtonText}>Badilisha</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Security Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Usalama</Text>
          
          <SettingItem
            title="Uthibitishaji wa Fingerprint"
            subtitle={biometricAvailable ? "Tumia fingerprint au face ID" : "Haipatikani kwenye kifaa hiki"}
            icon={Shield}
            showSwitch={true}
            switchValue={biometricEnabled}
            onSwitchChange={toggleBiometric}
          />

          <SettingItem
            title="Badilisha Password"
            subtitle="Sasisha password yako ya kuingia"
            icon={Lock}
            onPress={changePassword}
          />
        </View>

        {/* Data Management */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Usimamizi wa Taarifa</Text>
          
          <SettingItem
            title="Hamisha Taarifa"
            subtitle="Pakua taarifa zote kama faili la JSON"
            icon={Download}
            onPress={exportData}
          />

          <SettingItem
            title="Ingiza Taarifa"
            subtitle="Rejesha taarifa kutoka faili la backup"
            icon={Upload}
            onPress={() => Alert.alert('Taarifa', 'Utaratibu wa kuingiza taarifa utakuja hivi karibuni')}
          />

          <SettingItem
            title="Futa Taarifa Zote"
            subtitle="Futa kabisa taarifa zote"
            icon={Trash2}
            onPress={clearAllData}
            danger={true}
          />
        </View>

        {/* App Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Taarifa za Programu</Text>
          
          <SettingItem
            title="Kuhusu"
            subtitle="Toleo 2.0.0 - DODOMA CTF 2025"
            icon={Info}
            onPress={() => Alert.alert(
              'Kuhusu', 
              'DODOMA CTF 2025 Mfumo wa Taarifa za Uuzaji wa Wanafunzi\nToleo 2.0.0\n\nUmetengenezwa kwa Programu ya Uuzaji wa Wanafunzi wa Kanisa la SDA'
            )}
          />

          <SettingItem
            title="Msaada na Uongozi"
            subtitle="Pata msaada wa kutumia programu"
            icon={HelpCircle}
            onPress={() => Alert.alert(
              'Msaada', 
              'Kwa msaada, wasiliana na mratibu wa programu yako au idara ya IT.'
            )}
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © 2025 Kanisa la SDA - Programu ya DODOMA CTF ya Uuzaji wa Wanafunzi
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    padding: 24,
    backgroundColor: '#1e3a8a',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#bfdbfe',
  },
  section: {
    margin: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  profileCard: {
    backgroundColor: '#ffffff',
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
    color: '#1f2937',
    marginBottom: 2,
  },
  profilePhone: {
    fontSize: 14,
    color: '#6b7280',
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editProfileButtonText: {
    color: '#1e3a8a',
    fontWeight: '500',
    marginLeft: 4,
  },
  profileEditCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 8,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  profileEditActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 0.48,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#6b7280',
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 0.48,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: '500',
  },
  settingItem: {
    backgroundColor: '#ffffff',
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
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingIconDanger: {
    backgroundColor: '#fef2f2',
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  settingTitleDanger: {
    color: '#dc2626',
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  footer: {
    padding: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
  },
});