// app/(tabs)/new-report.tsx
import React, { useEffect, useState } from 'react';
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
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { DataService } from '@/services/DataService';
import { LanguageService } from '@/services/LanguageService';
import { DailyReport, BookSale, UserProfile } from '@/types/Report';
import { router } from 'expo-router';
import { useTheme } from '../providers/ThemeProvider';

// --- Defaults & validation ---
type FormData = {
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

const DEFAULT_VALUES: FormData = {
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
};

const schema = yup.object().shape({
  hoursWorked: yup.number().min(0).required(),
  booksSold: yup.number().min(0).required(),
  dailyAmount: yup.number().min(0).required(),
  freeLiterature: yup.number().min(0).required(),
  vopActivities: yup.number().min(0).required(),
  churchAttendees: yup.number().min(0).required(),
  backSlidesVisited: yup.number().min(0).required(),
  prayersOffered: yup.number().min(0).required(),
  bibleStudies: yup.number().min(0).required(),
  baptismCandidates: yup.number().min(0).required(),
  baptismsPerformed: yup.number().min(0).required(),
  peopleVisited: yup.number().min(0).required(),
});

export default function NewReportScreen() {
  const { theme } = useTheme();

  const [bookSales, setBookSales] = useState<BookSale[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [existingReport, setExistingReport] = useState<DailyReport | null>(null);

  // small tick to force rerender on language change
  const [langTick, setLangTick] = useState(0);

  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<FormData>({
    resolver: yupResolver(schema),
    defaultValues: DEFAULT_VALUES,
  });

  // Initialize services on mount
  useEffect(() => {
    (async () => {
      await DataService.initialize();
      await LanguageService.initialize();
      await DataService.setFirstUseDate();
      loadUserProfile();

      // subscribe to language changes to re-render UI
      const unsubscribe = LanguageService.subscribe(() => setLangTick((t) => t + 1));
      return unsubscribe;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load report when selectedDate changes
  useEffect(() => {
    loadReportForDate(selectedDate);
  }, [selectedDate]);

  // Recalculate totals when bookSales change
  useEffect(() => {
    const totalAmount = bookSales.reduce((sum, sale) => sum + (sale.price || 0) * (sale.quantity || 0), 0);
    const totalBooks = bookSales.reduce((sum, sale) => sum + (sale.quantity || 0), 0);
    setValue('dailyAmount', totalAmount);
    setValue('booksSold', totalBooks);
  }, [bookSales, setValue]);

  const loadUserProfile = async () => {
    try {
      const profile = await DataService.getUserProfile();
      setUserProfile(profile);
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const loadReportForDate = async (date: string) => {
    try {
      const report = await DataService.getDailyReportByDate(date);
      if (report) {
        setExistingReport(report);
        setBookSales(Array.isArray(report.bookSales) ? report.bookSales : []);

        reset({
          hoursWorked: report.hoursWorked ?? 0,
          booksSold: report.booksSold ?? 0,
          dailyAmount: report.dailyAmount ?? 0,
          freeLiterature: report.freeLiterature ?? 0,
          vopActivities: report.vopActivities ?? 0,
          churchAttendees: report.churchAttendees ?? 0,
          backSlidesVisited: report.backSlidesVisited ?? 0,
          prayersOffered: report.prayersOffered ?? 0,
          bibleStudies: report.bibleStudies ?? 0,
          baptismCandidates: report.baptismCandidates ?? 0,
          baptismsPerformed: report.baptismsPerformed ?? 0,
          peopleVisited: report.peopleVisited ?? 0,
        });
      } else {
        setExistingReport(null);
        setBookSales([]);
        reset(DEFAULT_VALUES);
      }
    } catch (error) {
      console.error('Error loading report for date:', error);
    }
  };

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
    setBookSales((prev) => prev.filter((sale) => sale.id !== id));
  };

  const onSubmit = async (data: any) => {
    if (!userProfile) {
      Alert.alert(LanguageService.t('error'), LanguageService.t('validationError'));
      return;
    }

    const reportDate = new Date(selectedDate);
    const weekStart = DataService.getWeekStartDate(reportDate);
    const isLocked = DataService.isWeekLocked(weekStart);

    if (isLocked && !existingReport) {
      Alert.alert(LanguageService.t('weekLocked'), LanguageService.t('weekLocked'));
      return;
    }

    setLoading(true);

    try {
      const safeNumber = (v: any) => {
        const n = Number(v);
        return Number.isNaN(n) ? 0 : n;
      };

      const report: DailyReport = {
        id: existingReport?.id || `daily_${selectedDate}_${Date.now()}`,
        date: selectedDate,
        studentName: userProfile.fullName,
        phoneNumber: userProfile.phoneNumber,
        hoursWorked: safeNumber(data.hoursWorked),
        booksSold: safeNumber(data.booksSold),
        dailyAmount: safeNumber(data.dailyAmount),
        freeLiterature: safeNumber(data.freeLiterature),
        vopActivities: safeNumber(data.vopActivities),
        churchAttendees: safeNumber(data.churchAttendees),
        backSlidesVisited: safeNumber(data.backSlidesVisited),
        prayersOffered: safeNumber(data.prayersOffered),
        bibleStudies: safeNumber(data.bibleStudies),
        baptismCandidates: safeNumber(data.baptismCandidates),
        baptismsPerformed: safeNumber(data.baptismsPerformed),
        peopleVisited: safeNumber(data.peopleVisited),
        bookSales: Array.isArray(bookSales) ? bookSales : [],
        createdAt: existingReport?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await DataService.saveDailyReport(report);

      // verification readback
      const saved = await DataService.getDailyReportByDate(selectedDate);
      if (!saved) throw new Error(LanguageService.t('networkError'));

      // update UI
      setExistingReport(saved);
      setBookSales(Array.isArray(saved.bookSales) ? saved.bookSales : []);

      Alert.alert(LanguageService.t('success'), LanguageService.t('reportSaved'), [
        {
          text: LanguageService.t('ok'),
          onPress: () => {
            reset(DEFAULT_VALUES);
            setBookSales([]);
            router.push('/');
          },
        },
      ]);
    } catch (error: any) {
      console.error('Error saving daily report:', error);
      Alert.alert(LanguageService.t('error'), error?.message || LanguageService.t('networkError'));
    } finally {
      setLoading(false);
    }
  };

  const DateSelector = () => {
    const today = new Date();
    const weekStart = DataService.getWeekStartDate(today);
    const dates: Date[] = [];

    for (let i = 0; i < 6; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      const dayOfWeek = date.getDay();
      if (dayOfWeek >= 0 && dayOfWeek <= 5) dates.push(date);
    }

    return (
      <View style={styles.dateSelector}>
        <Text style={[styles.dateSelectorTitle, { color: theme.text }]}>{LanguageService.t('selectDay')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {dates.map((date) => {
            const dateString = date.toISOString().split('T')[0];
            const isSelected = dateString === selectedDate;
            const dayName = LanguageService.getDayName(date);
            const isToday = dateString === new Date().toISOString().split('T')[0];
            return (
              <TouchableOpacity
                key={dateString}
                style={[
                  styles.dateButton,
                  {
                    backgroundColor: isSelected ? theme.primary : theme.card,
                    borderColor: isSelected ? theme.primary : theme.border,
                  },
                  isToday ? { borderColor: theme.success, borderWidth: 2 } : null,
                ]}
                onPress={() => setSelectedDate(dateString)}
              >
                <Text style={[styles.dateDayName, { color: isSelected ? theme.surface : theme.textSecondary, fontWeight: isToday ? '700' : '400' }]}>{dayName.substring(0, 3)}</Text>
                <Text style={[styles.dateNumber, { color: isSelected ? theme.surface : theme.text }]}>{date.getDate()}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const InputField = ({ name, label, placeholder, keyboardType = 'default', multiline = false }: { name: keyof FormData; label: string; placeholder: string; keyboardType?: any; multiline?: boolean; }) => (
    <View style={styles.inputGroup}>
      <Text style={[styles.inputLabel, { color: theme.text }]}>{label}</Text>
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={[styles.input, (errors as any)[name] && styles.inputError, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
            onBlur={onBlur}
            onChangeText={(text) => onChange(text)}
            value={value?.toString()}
            placeholder={placeholder}
            placeholderTextColor={theme.textSecondary}
            keyboardType={keyboardType}
            multiline={multiline}
          />
        )}
      />
      {(errors as any)[name] && <Text style={[styles.errorText, { color: theme.error }]}>{(errors as any)[name]?.message}</Text>}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoid}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={[styles.header, { backgroundColor: theme.primary }]}>
            <Text style={[styles.headerTitle, { color: theme.surface }]}>{LanguageService.t('dailyReport')}</Text>
            <Text style={[styles.headerSubtitle, { color: theme.surface + 'cc' }]}>{existingReport ? LanguageService.t('updateReport') : LanguageService.t('saveReport')}</Text>
          </View>

          <View style={styles.formContainer}>
            <DateSelector />

            <View style={[styles.currentDateInfo, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Calendar size={20} color={theme.primary} />
              <Text style={[styles.currentDateText, { color: theme.text }]}>{LanguageService.getDayName(new Date(selectedDate))} - {new Date(selectedDate).toLocaleDateString()}</Text>
              {existingReport && (
                <View style={[styles.existingBadge, { backgroundColor: theme.success }]}>
                  <Text style={[styles.existingBadgeText, { color: theme.surface }]}>{LanguageService.t('completed')}</Text>
                </View>
              )}
            </View>

            <View style={styles.formSection}>
              <Text style={[styles.formSectionTitle, { color: theme.text }]}>{LanguageService.t('workHours')}</Text>
              <InputField name="hoursWorked" label={LanguageService.t('workHours')} placeholder="0" keyboardType="numeric" />
            </View>

            <View style={styles.formSection}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.formSectionTitle, { color: theme.text }]}>{LanguageService.t('bookSales')}</Text>
                <TouchableOpacity style={[styles.addButton, { backgroundColor: theme.primary }]} onPress={addBookSale}>
                  <Plus size={20} color={theme.surface} />
                  <Text style={[styles.addButtonText, { color: theme.surface }]}>{LanguageService.t('addBook')}</Text>
                </TouchableOpacity>
              </View>

              {bookSales.map((sale) => (
                <View key={sale.id} style={[styles.bookSaleCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <View style={styles.bookSaleHeader}>
                    <Text style={[styles.bookSaleTitle, { color: theme.text }]}>{LanguageService.t('bookTitle')}</Text>
                    <TouchableOpacity onPress={() => removeBookSale(sale.id)}>
                      <Trash2 size={20} color={theme.error} />
                    </TouchableOpacity>
                  </View>

                  <TextInput
                    style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                    placeholder={LanguageService.t('bookTitle')}
                    placeholderTextColor={theme.textSecondary}
                    value={sale.title}
                    onChangeText={(text) => updateBookSale(sale.id, 'title', text)}
                  />

                  <View style={styles.bookSaleRow}>
                    <View style={styles.bookSaleField}>
                      <Text style={[styles.inputLabel, { color: theme.text }]}>{LanguageService.t('price')}</Text>
                      <TextInput style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]} placeholder="0" keyboardType="numeric" value={sale.price?.toString()} onChangeText={(text) => updateBookSale(sale.id, 'price', parseFloat(text) || 0)} />
                    </View>
                    <View style={styles.bookSaleField}>
                      <Text style={[styles.inputLabel, { color: theme.text }]}>{LanguageService.t('quantity')}</Text>
                      <TextInput style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]} placeholder="1" keyboardType="numeric" value={sale.quantity?.toString()} onChangeText={(text) => updateBookSale(sale.id, 'quantity', parseInt(text) || 1)} />
                    </View>
                  </View>

                  <Text style={[styles.bookSaleTotal, { color: theme.success }]}>{LanguageService.t('total')}: TSH {((sale.price || 0) * (sale.quantity || 0)).toLocaleString()}</Text>
                </View>
              ))}

              <View style={[styles.salesSummary, { backgroundColor: theme.primary }]}>
                <Text style={[styles.salesSummaryText, { color: theme.surface }]}>{LanguageService.t('booksSold')}: {watch('booksSold')} | {LanguageService.t('totalSales')}: TSH {Number(watch('dailyAmount') || 0).toLocaleString()}</Text>
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={[styles.formSectionTitle, { color: theme.text }]}>{LanguageService.t('literatureDistribution')}</Text>
              <InputField name="freeLiterature" label={LanguageService.t('freeLiterature')} placeholder="0" keyboardType="numeric" />
              <InputField name="vopActivities" label={LanguageService.t('vopActivities')} placeholder="0" keyboardType="numeric" />
            </View>

            <View style={styles.formSection}>
              <Text style={[styles.formSectionTitle, { color: theme.text }]}>{LanguageService.t('ministryActivities')}</Text>
              <InputField name="churchAttendees" label={LanguageService.t('churchAttendees')} placeholder="0" keyboardType="numeric" />
              <InputField name="backSlidesVisited" label={LanguageService.t('backSlidesVisited')} placeholder="0" keyboardType="numeric" />
              <InputField name="prayersOffered" label={LanguageService.t('prayersOffered')} placeholder="0" keyboardType="numeric" />
              <InputField name="bibleStudies" label={LanguageService.t('bibleStudies')} placeholder="0" keyboardType="numeric" />
              <InputField name="baptismCandidates" label={LanguageService.t('baptismCandidates')} placeholder="0" keyboardType="numeric" />
              <InputField name="baptismsPerformed" label={LanguageService.t('baptismsPerformed')} placeholder="0" keyboardType="numeric" />
              <InputField name="peopleVisited" label={LanguageService.t('peopleVisited')} placeholder="0" keyboardType="numeric" />
            </View>

            <View style={[styles.autoSaveInfo, { backgroundColor: theme.success + '10' }]}>
              <Clock size={16} color={theme.success} />
              <Text style={[styles.autoSaveText, { color: theme.success }]}>{LanguageService.t('saveReport')}</Text>
            </View>

            <TouchableOpacity
              style={[
                styles.submitButton,
                loading ? { backgroundColor: theme.textSecondary } : { backgroundColor: theme.success }
              ]}
              onPress={handleSubmit(onSubmit)}
              disabled={loading}
            >
              <Save size={20} color={theme.surface} />
              <Text style={[styles.submitButtonText, { color: theme.surface }]}>{loading ? LanguageService.t('loading') : (existingReport ? LanguageService.t('updateReport') : LanguageService.t('saveReport'))}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardAvoid: { flex: 1 },
  header: { padding: 24 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  headerSubtitle: { fontSize: 14 },
  formContainer: { padding: 16 },
  dateSelector: { marginBottom: 20 },
  dateSelectorTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  dateButton: { padding: 12, borderRadius: 8, marginRight: 8, alignItems: 'center', minWidth: 60, borderWidth: 1 },
  dateDayName: { fontSize: 12, marginBottom: 4 },
  dateNumber: { fontSize: 16, fontWeight: '600' },
  dateButtonToday: {},
  dateTextToday: {},
  currentDateInfo: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 8, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2, borderWidth: 1 },
  currentDateText: { fontSize: 16, fontWeight: '600', marginLeft: 8, flex: 1 },
  existingBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  existingBadgeText: { fontSize: 12, fontWeight: '600' },
  formSection: { marginBottom: 24 },
  formSectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 14, fontWeight: '500', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16 },
  inputError: { borderColor: '#dc2626' },
  errorText: { fontSize: 12, marginTop: 4 },
  addButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 },
  addButtonText: { fontWeight: '600', marginLeft: 6 },
  bookSaleCard: { padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1 },
  bookSaleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  bookSaleTitle: { fontSize: 16, fontWeight: '600', marginBottom: 0 },
  bookSaleRow: { flexDirection: 'row', marginHorizontal: -6 },
  bookSaleField: { flex: 1, marginHorizontal: 6 },
  bookSaleTotal: { fontSize: 16, fontWeight: '600', textAlign: 'right', marginTop: 8 },
  salesSummary: { padding: 16, borderRadius: 8, marginTop: 12 },
  salesSummaryText: { fontWeight: '600', textAlign: 'center' },
  autoSaveInfo: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, marginBottom: 16 },
  autoSaveText: { fontSize: 14, marginLeft: 8, flex: 1 },
  submitButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, marginTop: 24, marginBottom: 32 },
  submitButtonText: { fontSize: 16, fontWeight: '600', marginLeft: 8 },
});
