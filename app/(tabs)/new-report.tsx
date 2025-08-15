import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Save, Plus, Trash2, Calendar, Clock } from 'lucide-react-native';
import { useForm, Controller, FieldErrors, Path } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { DataService } from '@/services/DataService';
import { DailyReport, BookSale, UserProfile } from '@/types/Report';
import { router } from 'expo-router';

// -- types
type FormValues = {
  hoursWorked: number;
  booksSold: number;
  dailyAmount: number;
  freeLiterature: number;
  vopActivities: number;
  churchAttendees: number;
  backSlidesVisited: number;
  prayersOffered: number;
  bibleStudies: number;
  baptismCandidates: number;
  baptismsPerformed: number;
  peopleVisited: number;
};

// -- validation
const schema = yup.object().shape({
  hoursWorked: yup.number().min(0, 'Masaa lazima yawe mazuri').required('Masaa ya kazi yanahitajika'),
  booksSold: yup.number().min(0, 'Vitabu vilivyouzwa lazima viwe mazuri').required(),
  dailyAmount: yup.number().min(0, 'Kiasi lazima kiwe kizuri').required(),
  freeLiterature: yup.number().min(0, 'Vitabu vya bure lazima viwe mazuri').required(),
  vopActivities: yup.number().min(0, 'Shughuli za VOP lazima ziwe nzuri').required(),
  churchAttendees: yup.number().min(0, 'Watu waliofika kanisani lazima wawe wazuri').required(),
  backSlidesVisited: yup.number().min(0, 'Waliotembelewa lazima wawe wazuri').required(),
  prayersOffered: yup.number().min(0, 'Maombi yaliyotolewa lazima yawe mazuri').required(),
  bibleStudies: yup.number().min(0, 'Masomo ya Biblia lazima yawe mazuri').required(),
  baptismCandidates: yup.number().min(0, 'Wagombea ubatizo lazima wawe wazuri').required(),
  baptismsPerformed: yup.number().min(0, 'Mabatizo yaliyofanywa lazima yawe mazuri').required(),
  peopleVisited: yup.number().min(0, 'Watu waliotembelewa lazima wawe wazuri').required(),
});

export default function NewReportScreen() {
  const [bookSales, setBookSales] = useState<BookSale[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [existingReport, setExistingReport] = useState<DailyReport | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<FormValues>({
    resolver: yupResolver(schema),
    defaultValues: {
      hoursWorked: 0,
      booksSold: 0,
      dailyAmount: 0,
      freeLiterature: 0,
      vopActivities: 0,
      churchAttendees: 0,
      backSlidesVisited: 0,
      prayersOffered: 0,
      bibleStudies: 0,
      baptismCandidates: 0,
      baptismsPerformed: 0,
      peopleVisited: 0,
    },
  });

  // keep watch values handy
  const watchedBooksSold = watch('booksSold');
  const watchedDailyAmount = watch('dailyAmount');

  useEffect(() => {
    loadUserProfile();
    // load selected date report on mount as well
    loadReportForDate(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // recalc totals when bookSales change
    const totalAmount = bookSales.reduce((sum, sale) => sum + (Number(sale.price) || 0) * (Number(sale.quantity) || 0), 0);
    const totalBooks = bookSales.reduce((sum, sale) => sum + (Number(sale.quantity) || 0), 0);
    // ensure numbers are set in form
    setValue('dailyAmount', totalAmount);
    setValue('booksSold', totalBooks);
  }, [bookSales, setValue]);

  useEffect(() => {
    // when selectedDate changes, load the report
    loadReportForDate(selectedDate);
  }, [selectedDate]);

  const loadUserProfile = async () => {
    try {
      const profile = await DataService.getUserProfile();
      setUserProfile(profile);
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const loadReportForDate = useCallback(async (date: string) => {
    try {
      const report = await DataService.getDailyReportByDate(date);
      if (report) {
        setExistingReport(report);
        // ensure bookSales numbers are numbers
        const normalized = report.bookSales?.map((s) => ({ ...s, price: Number(s.price) || 0, quantity: Number(s.quantity) || 0 })) || [];
        setBookSales(normalized);
        reset({
          hoursWorked: report.hoursWorked || 0,
          booksSold: report.booksSold || 0,
          dailyAmount: report.dailyAmount || 0,
          freeLiterature: report.freeLiterature || 0,
          vopActivities: report.vopActivities || 0,
          churchAttendees: report.churchAttendees || 0,
          backSlidesVisited: report.backSlidesVisited || 0,
          prayersOffered: report.prayersOffered || 0,
          bibleStudies: report.bibleStudies || 0,
          baptismCandidates: report.baptismCandidates || 0,
          baptismsPerformed: report.baptismsPerformed || 0,
          peopleVisited: report.peopleVisited || 0,
        });
      } else {
        setExistingReport(null);
        setBookSales([]);
        reset({
          hoursWorked: 0,
          booksSold: 0,
          dailyAmount: 0,
          freeLiterature: 0,
          vopActivities: 0,
          churchAttendees: 0,
          backSlidesVisited: 0,
          prayersOffered: 0,
          bibleStudies: 0,
          baptismCandidates: 0,
          baptismsPerformed: 0,
          peopleVisited: 0,
        });
      }
    } catch (error) {
      console.error('Error loading report for date:', error);
    }
  }, [reset]);

  const addBookSale = () => {
    setBookSales((prev) => [
      ...prev,
      { title: '', price: 0, quantity: 1, id: Date.now().toString() },
    ]);
  };

  const updateBookSale = (id: string, field: keyof BookSale, value: any) => {
    setBookSales((prev) => prev.map((sale) => (sale.id === id ? { ...sale, [field]: value } : sale)));
  };

  const removeBookSale = (id: string) => {
    Alert.alert('Thibitisha', 'Unataka kuondoa kitabu hiki?', [
      { text: 'Hapana' },
      { text: 'Ndiyo', onPress: () => setBookSales((prev) => prev.filter((s) => s.id !== id)) },
    ]);
  };

  const onSubmit = async (data: FormValues) => {
    if (!userProfile) {
      Alert.alert('Hitilafu', 'Wasifu wa mtumiaji haujapatikana');
      return;
    }

    setLoading(true);
    try {
      const reportDate = new Date(selectedDate);
      const weekStart = DataService.getWeekStartDate(reportDate);
      const isLocked = await DataService.isWeekLocked(weekStart);

      if (isLocked && !existingReport) {
        Alert.alert('Wiki Imefungwa', 'Huwezi kutengeneza taarifa mpya kwa wiki iliyofungwa. Unaweza tu kubadilisha taarifa zilizopo.', [
          { text: 'Sawa' },
        ]);
        setLoading(false);
        return;
      }

      // normalize bookSales to ensure numbers
      const normalizedBookSales = bookSales.map((s) => ({ ...s, price: Number(s.price) || 0, quantity: Number(s.quantity) || 0 }));

      const report: DailyReport = {
        ...data,
        id: existingReport?.id || `daily_${selectedDate}_${Date.now()}`,
        date: selectedDate,
        studentName: userProfile.fullName,
        phoneNumber: userProfile.phoneNumber,
        bookSales: normalizedBookSales,
        createdAt: existingReport?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await DataService.saveDailyReport(report);

      // refresh local state before navigation
      setExistingReport(report);
      await loadReportForDate(selectedDate);

      Alert.alert('Imehifadhiwa!', `Taarifa ya ${DataService.getDayName(new Date(selectedDate))} imehifadhiwa kikamilifu!`, [
        { text: 'Sawa', onPress: () => router.push('/') },
      ]);
    } catch (error) {
      console.error('Error saving daily report:', error);
      Alert.alert('Hitilafu', 'Imeshindwa kuhifadhi taarifa. Jaribu tena.');
    } finally {
      setLoading(false);
    }
  };

  const DateSelector = () => {
    const today = new Date();
    const dates: Date[] = [];

    for (let i = 5; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      dates.push(date);
    }

    return (
      <View style={styles.dateSelector}>
        <Text style={styles.dateSelectorTitle}>Chagua Tarehe:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {dates.map((date) => {
            const dateString = date.toISOString().split('T')[0];
            const isSelected = dateString === selectedDate;
            const dayName = DataService.getDayName(date);

            return (
              <TouchableOpacity
                key={dateString}
                style={[styles.dateButton, isSelected && styles.dateButtonSelected]}
                onPress={() => setSelectedDate(dateString)}
              >
                <Text style={[styles.dateDayName, isSelected && styles.dateTextSelected]}>{dayName}</Text>
                <Text style={[styles.dateNumber, isSelected && styles.dateTextSelected]}>{date.getDate()}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const InputField = ({
    name,
    label,
    placeholder,
    keyboardType = 'default',
    multiline = false,
  }: {
    name: keyof FormValues;
    label: string;
    placeholder?: string;
    keyboardType?: any;
    multiline?: boolean;
  }) => (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <Controller
        control={control}
        name={name as Path<FormValues>}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={[styles.input, (errors as FieldErrors<FormValues>)[name] && styles.inputError]}
            onBlur={onBlur}
            onChangeText={(text) => {
              // remove commas then parse number; empty string -> 0
              const cleaned = text.replace(/,/g, '');
              const parsed = cleaned === '' ? 0 : Number(cleaned);
              onChange(isNaN(parsed) ? 0 : parsed);
            }}
            value={value !== undefined && value !== null ? String(value) : ''}
            placeholder={placeholder}
            keyboardType={keyboardType}
            multiline={multiline}
          />
        )}
      />
      {(errors as FieldErrors<FormValues>)[name] && (
        <Text style={styles.errorText}>{(errors as FieldErrors<FormValues>)[name]?.message as string}</Text>
      )}
    </View>
  );

  // format helper to show money nicely without breaking layout
  const formatNumber = useCallback((n?: number) => {
    try {
      return (Number(n) || 0).toLocaleString();
    } catch {
      return String(n ?? 0);
    }
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoid}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Taarifa ya Kila Siku</Text>
            <Text style={styles.headerSubtitle}>{existingReport ? 'Badilisha taarifa' : 'Tengeneza taarifa mpya'}</Text>
          </View>

          <View style={styles.formContainer}>
            <DateSelector />

            <View style={styles.currentDateInfo}>
              <Calendar size={20} color="#1e3a8a" />
              <Text style={styles.currentDateText}>
                {DataService.getDayName(new Date(selectedDate))} - {new Date(selectedDate).toLocaleDateString()}
              </Text>
              {existingReport && (
                <View style={styles.existingBadge}>
                  <Text style={styles.existingBadgeText}>Tayari Imejazwa</Text>
                </View>
              )}
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formSectionTitle}>Masaa ya Kazi</Text>
              <InputField name="hoursWorked" label="Masaa ya Kazi Leo" placeholder="0" keyboardType="numeric" />
            </View>

            <View style={styles.formSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.formSectionTitle}>Uuzaji wa Vitabu</Text>
                <TouchableOpacity style={styles.addButton} onPress={addBookSale}>
                  <Plus size={20} color="#ffffff" />
                  <Text style={styles.addButtonText}>Ongeza Kitabu</Text>
                </TouchableOpacity>
              </View>

              {bookSales.map((sale) => (
                <View key={sale.id} style={styles.bookSaleCard}>
                  <View style={styles.bookSaleHeader}>
                    <Text style={styles.bookSaleTitle}>{sale.title ? sale.title : 'Kitabu'}</Text>
                    <TouchableOpacity onPress={() => removeBookSale(sale.id)}>
                      <Trash2 size={20} color="#dc2626" />
                    </TouchableOpacity>
                  </View>

                  <TextInput
                    style={styles.input}
                    placeholder="Jina la kitabu"
                    value={sale.title}
                    onChangeText={(text) => updateBookSale(sale.id, 'title', text)}
                  />

                  <View style={styles.bookSaleRow}>
                    <View style={styles.bookSaleField}>
                      <Text style={styles.inputLabel}>Bei (TSH)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="0"
                        keyboardType="numeric"
                        value={String(sale.price ?? 0)}
                        onChangeText={(text) => updateBookSale(sale.id, 'price', parseFloat(text.replace(/,/g, '')) || 0)}
                      />
                    </View>
                    <View style={styles.bookSaleField}>
                      <Text style={styles.inputLabel}>Idadi</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="0"
                        keyboardType="numeric"
                        value={String(sale.quantity ?? 0)}
                        onChangeText={(text) => updateBookSale(sale.id, 'quantity', parseInt(text) || 0)}
                      />
                    </View>
                  </View>

                  <Text style={styles.bookSaleTotal}>Jumla: TSH {formatNumber((Number(sale.price) || 0) * (Number(sale.quantity) || 0))}</Text>
                </View>
              ))}

              <View style={styles.salesSummary}>
                <Text style={styles.salesSummaryText}>
                  Jumla ya Vitabu: {String(watchedBooksSold)} | Jumla ya Fedha: TSH {formatNumber(watchedDailyAmount)}
                </Text>
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formSectionTitle}>Usambazaji wa Vitabu</Text>
              <InputField name="freeLiterature" label="Magazeti/Vitabu vya Bure Vilivyosambazwa" placeholder="0" keyboardType="numeric" />
              <InputField name="vopActivities" label="Shughuli za VOP (Voice of Prophecy)" placeholder="0" keyboardType="numeric" />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formSectionTitle}>Shughuli za Uongozaji</Text>
              <InputField name="churchAttendees" label="Watu Waliofika Kanisani" placeholder="0" keyboardType="numeric" />
              <InputField name="backSlidesVisited" label="Waliorudi Nyuma Waliotembelewa" placeholder="0" keyboardType="numeric" />
              <InputField name="prayersOffered" label="Maombi Yaliyotolewa" placeholder="0" keyboardType="numeric" />
              <InputField name="bibleStudies" label="Masomo ya Biblia Yaliyofundishwa" placeholder="0" keyboardType="numeric" />
              <InputField name="baptismCandidates" label="Watu Waliojiunga kwa Ubatizo" placeholder="0" keyboardType="numeric" />
              <InputField name="baptismsPerformed" label="Batizo zilizofanyika" placeholder="0" keyboardType="numeric" />
              <InputField name="peopleVisited" label="Idadi ya Watu Waliotembelewa" placeholder="0" keyboardType="numeric" />
            </View>

            <View style={styles.autoSaveInfo}>
              <Clock size={16} color="#059669" />
              <Text style={styles.autoSaveText}>Taarifa itahifadhiwa moja kwa moja baada ya kubonyeza "Hifadhi"</Text>
            </View>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit(onSubmit)}
              disabled={loading}
            >
              <Save size={20} color="#ffffff" />
              <Text style={styles.submitButtonText}>{loading ? 'Inahifadhi...' : existingReport ? 'Sasisha Taarifa' : 'Hifadhi Taarifa'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  keyboardAvoid: {
    flex: 1,
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
  formContainer: {
    padding: 16,
  },
  dateSelector: {
    marginBottom: 20,
  },
  dateSelectorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  dateButton: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
    minWidth: 60,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  dateButtonSelected: {
    backgroundColor: '#1e3a8a',
    borderColor: '#1e3a8a',
  },
  dateDayName: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  dateNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  dateTextSelected: {
    color: '#ffffff',
  },
  currentDateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  currentDateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 8,
    flex: 1,
  },
  existingBadge: {
    backgroundColor: '#059669',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  existingBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  formSection: {
    marginBottom: 24,
  },
  formSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  inputError: {
    borderColor: '#dc2626',
  },
  errorText: {
    fontSize: 12,
    color: '#dc2626',
    marginTop: 4,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  addButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    marginLeft: 6,
  },
  bookSaleCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  bookSaleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bookSaleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  bookSaleRow: {
    flexDirection: 'row',
    marginHorizontal: -6,
  },
  bookSaleField: {
    flex: 1,
    marginHorizontal: 6,
  },
  bookSaleTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
    textAlign: 'right',
    marginTop: 8,
  },
  salesSummary: {
    backgroundColor: '#1e3a8a',
    padding: 16,
    borderRadius: 8,
    marginTop: 12,
  },
  salesSummaryText: {
    color: '#ffffff',
    fontWeight: '600',
    textAlign: 'center',
  },
  autoSaveInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  autoSaveText: {
    fontSize: 14,
    color: '#059669',
    marginLeft: 8,
    flex: 1,
  },
  submitButton: {
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
    marginBottom: 32,
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
