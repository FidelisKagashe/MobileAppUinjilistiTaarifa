// (full file — replace your existing file with this)
import React, { useEffect, useState, useRef } from 'react';
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
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Save, Plus, Trash2, Calendar, Clock } from 'lucide-react-native';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { DataService } from '@/services/DataService';
import { LanguageService } from '@/services/LanguageService';
import { DailyReport, BookSale, UserProfile } from '@/types/Report';
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
  const [selectedDate, setSelectedDate] = useState<string>(formatDateLocal(new Date()));
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [existingReport, setExistingReport] = useState<DailyReport | null>(null);

  // book-specific inline errors keyed by book id (values may be undefined)
  const [bookErrors, setBookErrors] = useState<Record<string, string | undefined>>({});

  // toast state and animated value
  const [toastVisible, setToastVisible] = useState(false);
  const [toastText, setToastText] = useState('');
  const toastAnim = useRef(new Animated.Value(-80)).current; // off-screen initially

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
    let unsubLang: (() => void) | undefined;
    let unsubReports: (() => void) | undefined;
    let unsubProfile: (() => void) | undefined;
    
    (async () => {
      await DataService.initialize();
      await LanguageService.initialize();
      await DataService.setFirstUseDate();
      loadUserProfile();

      // Subscribe to language changes to re-render UI
      unsubLang = LanguageService.subscribe(() => setLangTick((t) => t + 1));
      
      // Subscribe to DataService events for live updates
      unsubReports = DataService.subscribe('reportsUpdated', () => {
        loadReportForDate(selectedDate);
      });
      
      unsubProfile = DataService.subscribe('profileUpdated', () => {
        loadUserProfile();
      });
    })();
    
    return () => {
      if (typeof unsubLang === 'function') unsubLang();
      if (typeof unsubReports === 'function') unsubReports();
      if (typeof unsubProfile === 'function') unsubProfile();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load report when selectedDate changes
  useEffect(() => {
    loadReportForDate(selectedDate);
  }, [selectedDate]);

  // Recalculate totals when bookSales change
  useEffect(() => {
    const totalAmount = bookSales.reduce((sum, sale) => sum + (Number(sale.price) || 0) * (Number(sale.quantity) || 0), 0);
    const totalBooks = bookSales.reduce((sum, sale) => sum + (Number(sale.quantity) || 0), 0);
    setValue('dailyAmount', totalAmount);
    setValue('booksSold', totalBooks);
  }, [bookSales, setValue]);

  const loadUserProfile = async () => {
    try {
      const profile = await DataService.getUserProfile();
      console.log('[NewReport] loadUserProfile ->', profile);
      setUserProfile(profile);
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const loadReportForDate = async (date: string) => {
    try {
      console.log('[NewReport] loadReportForDate ->', date);
      const report = await DataService.getDailyReportByDate(date);
      console.log('[NewReport] loaded report for', date, report ? 'FOUND' : 'NONE');
      if (report) {
        setExistingReport(report);
        // ensure types: price/quantity are numbers
        setBookSales(Array.isArray(report.bookSales) ? report.bookSales.map(s => ({ ...s, price: Number(s.price) || 0, quantity: Number(s.quantity) || 0 })) : []);

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
      // clear book errors when switching date
      setBookErrors({});
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

  // update price/quantity safely by parsing/cleaning the input
  const updateBookSale = (id: string, field: keyof BookSale, rawValue: any) => {
    setBookSales((prev) =>
      prev.map((sale) => {
        if (sale.id !== id) return sale;
        let newVal: any = rawValue;

        if (field === 'price') {
          // allow digits and dot, convert to number; empty => 0
          const cleaned = String(rawValue).replace(/[^0-9.]/g, '');
          newVal = cleaned === '' ? 0 : parseFloat(cleaned);
          if (Number.isNaN(newVal)) newVal = 0;
        }

        if (field === 'quantity') {
          // allow digits only; empty => 0
          const cleaned = String(rawValue).replace(/\D/g, '');
          newVal = cleaned === '' ? 0 : parseInt(cleaned, 10);
          if (Number.isNaN(newVal)) newVal = 0;
        }

        if (field === 'title') {
          newVal = String(rawValue);
        }

        return { ...sale, [field]: newVal };
      })
    );

    // If user updated title, remove its inline error (delete key to keep object tidy)
    if (field === 'title') {
      setBookErrors(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }
  };

  const removeBookSale = (id: string) => {
    setBookSales((prev) => prev.filter((sale) => sale.id !== id));
    setBookErrors(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  // show the top toast with animation
  const showToast = (message: string) => {
    setToastText(message);
    setToastVisible(true);
    // slide down
    Animated.timing(toastAnim, {
      toValue: 0,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start(() => {
      // auto-hide after 2200ms
      setTimeout(() => {
        Animated.timing(toastAnim, {
          toValue: -80,
          duration: 300,
          easing: Easing.in(Easing.ease),
          useNativeDriver: false,
        }).start(() => {
          setToastVisible(false);
          setToastText('');
        });
      }, 2200);
    });
  };

  const onSubmit = async (data: any) => {
    if (!userProfile) {
      Alert.alert(LanguageService.t('error'), LanguageService.t('validationError'));
      return;
    }

    // ONLY validate book titles: if any title is empty, show short inline message (Sw/En)
    const titleErrors: Record<string, string> = {};
    const lang = (LanguageService.getCurrentLanguage && LanguageService.getCurrentLanguage()) || 'en';

    bookSales.forEach(s => {
      if (!s.title || !s.title.toString().trim()) {
        titleErrors[s.id] = lang === 'sw' ? 'Jaza jina la kitabu' : 'Enter book title';
      }
    });

    if (Object.keys(titleErrors).length > 0) {
      setBookErrors(titleErrors);
      // keep message short and only inline — nothing else
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

      const normalizedBookSales = (Array.isArray(bookSales) ? bookSales : []).map(s => ({
        ...s,
        price: Number(s.price) || 0,
        quantity: Number(s.quantity) || 0,
        title: (s.title || '').toString().trim(),
      }));

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
        bookSales: normalizedBookSales,
        createdAt: existingReport?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // LOG: before save
      console.log('[NewReport] Saving report:', report);

      await DataService.saveDailyReport(report);

      // verification readback
      const saved = await DataService.getDailyReportByDate(selectedDate);
      if (!saved) throw new Error(LanguageService.t('networkError'));

      // update UI — keep the user on the same page (per your request)
      setExistingReport(saved);
      setBookSales(Array.isArray(saved.bookSales) ? saved.bookSales.map(s => ({ ...s, price: Number(s.price) || 0, quantity: Number(s.quantity) || 0 })) : []);
      setBookErrors({});

      // EXTRA LOG: export all data (to inspect what's in AsyncStorage/localStorage)
      try {
        const dump = await DataService.exportAllData();
        // print a short prefix and the length (avoid dumping huge content in Metro if very large)
        console.log('[NewReport] DataService.exportAllData length:', dump ? dump.length : 0);
        console.log('[NewReport] DataService.exportAllData (preview 1000 chars):', dump ? dump.substring(0, 1000) : dump);
      } catch (e) {
        console.warn('[NewReport] exportAllData failed', e);
      }

      // Also print weekly reports count (helpful to see if weekly calc ran)
      try {
        const weekly = await DataService.getAllWeeklyReports();
        console.log('[NewReport] weeklyReports count after save:', (weekly || []).length);
        
        // Force refresh all related data
        await loadReportForDate(selectedDate);
        await loadUserProfile();
      } catch (e) {
        console.warn('[NewReport] getAllWeeklyReports failed', e);
      }

      // show short top toast (bilingual)
      const toastMsg = lang === 'sw' ? 'Ripoti imehifadhiwa' : 'Report saved';
      showToast(toastMsg);
    } catch (error: any) {
      console.error('Error saving daily report:', error);
      Alert.alert(LanguageService.t('error'), error?.message || LanguageService.t('networkError'));
    } finally {
      setLoading(false);
    }
  };

  // Local helper: format date to YYYY-MM-DD using device local time (avoids timezone shifts)
  function formatDateLocal(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // Date selector: build 6-day window starting from weekStart (using DataService) but compare via local format
  const DateSelector = () => {
    const today = new Date();
    const weekStart = DataService.getWeekStartDate(today);
    const dates: Date[] = [];

    for (let i = 0; i < 6; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      dates.push(date);
    }

    const localTodayStr = formatDateLocal(new Date());

    return (
      <View style={styles.dateSelector}>
        <Text style={[styles.dateSelectorTitle, { color: theme.text }]}>{LanguageService.t('selectDay')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {dates.map((date) => {
            const dateString = formatDateLocal(date);
            const isSelected = dateString === selectedDate;
            const dayName = LanguageService.getDayName(date);
            const isToday = dateString === localTodayStr;
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
      {/* Top toast (absolute) */}
      <Animated.View
        style={[
          styles.toast,
          { backgroundColor: theme.success, transform: [{ translateY: toastAnim }] },
          // keep above everything
          { zIndex: 1000 },
        ]}
        pointerEvents="none"
      >
        <Text style={[styles.toastText, { color: '#fff' }]} numberOfLines={1}>{toastText}</Text>
      </Animated.View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoid}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={[styles.header, { backgroundColor: theme.primary }]}>
            <Text style={[styles.headerTitle, { color: theme.surface }]}>{LanguageService.t('dailyReport')}</Text>
            <Text style={[styles.headerSubtitle, { color: theme.surface + 'cc' }]}>{existingReport ? LanguageService.t('updateReport') : LanguageService.t('saveReport')}</Text>

            {/* DEBUG button — temporary: prints exportAllData() to console */}
            <TouchableOpacity
              onPress={async () => {
                try {
                  const dump = await DataService.exportAllData();
                  console.log('[NewReport DEBUG EXPORT] length:', dump ? dump.length : 0);
                  console.log('[NewReport DEBUG EXPORT preview]', dump ? dump.substring(0, 2000) : dump);
                  Alert.alert('Debug', 'Exported JSON logged to console (Metro / DevTools).');
                } catch (e) {
                  console.error('[NewReport DEBUG] export failed', e);
                  Alert.alert('Debug', 'Export failed: see console');
                }
              }}
              style={{ position: 'absolute', right: 16, top: Platform.OS === 'ios' ? 64 : 24 }}
            >
              <Text style={{ color: theme.surface, fontWeight: '600' }}>Debug</Text>
            </TouchableOpacity>
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
                  {bookErrors[sale.id] ? <Text style={[styles.errorText, { color: theme.error }]}>{bookErrors[sale.id]}</Text> : null}

                  <View style={styles.bookSaleRow}>
                    <View style={styles.bookSaleField}>
                      <Text style={[styles.inputLabel, { color: theme.text }]}>{LanguageService.t('price')}</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                        placeholder="0"
                        keyboardType="numeric"
                        value={String(sale.price ?? 0)}
                        onChangeText={(text) => updateBookSale(sale.id, 'price', text)}
                      />
                    </View>
                    <View style={styles.bookSaleField}>
                      <Text style={[styles.inputLabel, { color: theme.text }]}>{LanguageService.t('quantity')}</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                        placeholder="1"
                        keyboardType="numeric"
                        value={String(sale.quantity ?? 0)}
                        onChangeText={(text) => updateBookSale(sale.id, 'quantity', text)}
                      />
                    </View>
                  </View>

                  <Text style={[styles.bookSaleTotal, { color: theme.success }]}>{LanguageService.t('total')}: TSH {((Number(sale.price) || 0) * (Number(sale.quantity) || 0)).toLocaleString()}</Text>
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

  /* toast */
  toast: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 56,
    paddingHorizontal: 16,
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  toastText: { fontSize: 14, fontWeight: '600' },
});