import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Calendar, 
  FileText, 
  Lock, 
  Clock as Unlock, 
  Eye, 
  Download, 
  FileDown,
  ChevronRight,
  TrendingUp
} from 'lucide-react-native';
import { DataService } from '@/services/DataService';
import { PDFService } from '@/services/PDFService';
import { WeeklyReport, MonthlyReport, DailyReport } from '@/types/Report';

export default function ReportsScreen() {
  const [weeklyReports, setWeeklyReports] = useState<WeeklyReport[]>([]);
  const [monthlyReports, setMonthlyReports] = useState<MonthlyReport[]>([]);
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<WeeklyReport | null>(null);
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly' | 'daily'>('weekly');

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      const weekly = await DataService.getAllWeeklyReports();
      const monthly = await DataService.getAllMonthlyReports();
      const daily = await DataService.getAllDailyReports();
      
      setWeeklyReports(weekly.sort((a, b) => b.weekNumber - a.weekNumber));
      setMonthlyReports(monthly.sort((a, b) => b.year - a.year || b.month - a.month));
      setDailyReports(daily.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateWeeklyPDF = async (report: WeeklyReport) => {
    try {
      await PDFService.generateWeeklyPDF(report);
    } catch (error) {
      Alert.alert('Hitilafu', 'Imeshindwa kutengeneza PDF');
    }
  };

  const generateMonthlyPDF = async (report: MonthlyReport) => {
    try {
      await PDFService.generateMonthlyPDF(report);
    } catch (error) {
      Alert.alert('Hitilafu', 'Imeshindwa kutengeneza PDF');
    }
  };

  const generateCurrentMonthReport = async () => {
    try {
      const now = new Date();
      const monthlyReport = await DataService.generateMonthlyReport(now.getMonth() + 1, now.getFullYear());
      await loadReports();
      Alert.alert('Imekamilika!', 'Taarifa ya mwezi imetengenezwa kikamilifu!');
    } catch (error) {
      Alert.alert('Hitilafu', 'Imeshindwa kutengeneza taarifa ya mwezi');
    }
  };

  const ViewModeSelector = () => (
    <View style={styles.viewModeSelector}>
      {[
        { key: 'daily', label: 'Kila Siku' },
        { key: 'weekly', label: 'Kila Wiki' },
        { key: 'monthly', label: 'Kila Mwezi' },
      ].map((mode) => (
        <TouchableOpacity
          key={mode.key}
          style={[
            styles.viewModeButton,
            viewMode === mode.key && styles.viewModeButtonActive
          ]}
          onPress={() => setViewMode(mode.key as any)}
        >
          <Text style={[
            styles.viewModeText,
            viewMode === mode.key && styles.viewModeTextActive
          ]}>
            {mode.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const DailyReportCard = ({ item }: { item: DailyReport }) => (
    <View style={styles.reportCard}>
      <View style={styles.reportHeader}>
        <Text style={styles.reportTitle}>
          {DataService.getDayName(new Date(item.date))}
        </Text>
        <Text style={styles.reportDate}>
          {new Date(item.date).toLocaleDateString()}
        </Text>
      </View>

      <View style={styles.reportStats}>
        <View style={styles.reportStat}>
          <Text style={styles.reportStatValue}>{item.hoursWorked}h</Text>
          <Text style={styles.reportStatLabel}>Masaa</Text>
        </View>
        <View style={styles.reportStat}>
          <Text style={styles.reportStatValue}>{item.booksSold}</Text>
          <Text style={styles.reportStatLabel}>Vitabu</Text>
        </View>
        <View style={styles.reportStat}>
          <Text style={styles.reportStatValue}>TSH {item.dailyAmount.toLocaleString()}</Text>
          <Text style={styles.reportStatLabel}>Mauzo</Text>
        </View>
      </View>
    </View>
  );

  const WeeklyReportCard = ({ item }: { item: WeeklyReport }) => (
    <TouchableOpacity 
      style={styles.reportCard}
      onPress={() => setSelectedReport(item)}
    >
      <View style={styles.reportHeader}>
        <View style={styles.reportNumberBadge}>
          <Text style={styles.reportNumber}>Wiki #{item.weekNumber}</Text>
        </View>
        <View style={styles.lockStatus}>
          {item.isLocked ? (
            <Lock size={16} color="#dc2626" />
          ) : (
            <Unlock size={16} color="#059669" />
          )}
        </View>
      </View>

      <Text style={styles.reportStudentName}>{item.studentName}</Text>
      <Text style={styles.reportDate}>
        {new Date(item.weekStartDate).toLocaleDateString()} - {new Date(item.weekEndDate).toLocaleDateString()}
      </Text>

      <View style={styles.reportStats}>
        <View style={styles.reportStat}>
          <Text style={styles.reportStatValue}>{item.totalHours}h</Text>
          <Text style={styles.reportStatLabel}>Masaa</Text>
        </View>
        <View style={styles.reportStat}>
          <Text style={styles.reportStatValue}>{item.totalBooksSold}</Text>
          <Text style={styles.reportStatLabel}>Vitabu</Text>
        </View>
        <View style={styles.reportStat}>
          <Text style={styles.reportStatValue}>TSH {item.totalAmount.toLocaleString()}</Text>
          <Text style={styles.reportStatLabel}>Mauzo</Text>
        </View>
      </View>

      <View style={styles.reportActions}>
        <TouchableOpacity style={styles.actionButton}>
          <Eye size={16} color="#1e3a8a" />
          <Text style={styles.actionButtonText}>Ona Maelezo</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.pdfButton}
          onPress={() => generateWeeklyPDF(item)}
        >
          <FileDown size={16} color="#059669" />
          <Text style={styles.pdfButtonText}>PDF</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const MonthlyReportCard = ({ item }: { item: MonthlyReport }) => (
    <View style={styles.reportCard}>
      <View style={styles.reportHeader}>
        <Text style={styles.reportTitle}>
          {DataService.getMonthName(item.month)} {item.year}
        </Text>
        <TouchableOpacity 
          style={styles.pdfButton}
          onPress={() => generateMonthlyPDF(item)}
        >
          <FileDown size={16} color="#059669" />
          <Text style={styles.pdfButtonText}>PDF</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.reportStudentName}>{item.studentName}</Text>
      <Text style={styles.reportDate}>{item.weeklyReports.length} wiki</Text>

      <View style={styles.reportStats}>
        <View style={styles.reportStat}>
          <Text style={styles.reportStatValue}>{item.totalHours}h</Text>
          <Text style={styles.reportStatLabel}>Masaa</Text>
        </View>
        <View style={styles.reportStat}>
          <Text style={styles.reportStatValue}>{item.totalBooks}</Text>
          <Text style={styles.reportStatLabel}>Vitabu</Text>
        </View>
        <View style={styles.reportStat}>
          <Text style={styles.reportStatValue}>TSH {item.totalAmount.toLocaleString()}</Text>
          <Text style={styles.reportStatLabel}>Mauzo</Text>
        </View>
      </View>
    </View>
  );

  const ReportDetail = ({ report }: { report: WeeklyReport }) => (
    <View style={styles.detailContainer}>
      <View style={styles.detailHeader}>
        <Text style={styles.detailTitle}>Wiki #{report.weekNumber}</Text>
        <TouchableOpacity onPress={() => setSelectedReport(null)}>
          <Text style={styles.closeButton}>Funga</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.detailContent}>
        <View style={styles.detailSection}>
          <Text style={styles.detailSectionTitle}>Taarifa za Msingi</Text>
          <Text style={styles.detailItem}>Mwanafunzi: {report.studentName}</Text>
          <Text style={styles.detailItem}>Simu: {report.phoneNumber}</Text>
          <Text style={styles.detailItem}>
            Wiki: {new Date(report.weekStartDate).toLocaleDateString()} - {new Date(report.weekEndDate).toLocaleDateString()}
          </Text>
        </View>

        <View style={styles.detailSection}>
          <Text style={styles.detailSectionTitle}>Jumla ya Wiki</Text>
          <Text style={styles.detailItem}>Masaa ya Kazi: {report.totalHours}</Text>
          <Text style={styles.detailItem}>Vitabu Vilivyouzwa: {report.totalBooksSold}</Text>
          <Text style={styles.detailItem}>Kiasi cha Wiki: TSH {report.totalAmount.toLocaleString()}</Text>
          <Text style={styles.detailItem}>Vitabu vya Bure: {report.totalFreeLiterature}</Text>
        </View>

        <View style={styles.detailSection}>
          <Text style={styles.detailSectionTitle}>Shughuli za Uongozaji</Text>
          <Text style={styles.detailItem}>Shughuli za VOP: {report.totalVopActivities}</Text>
          <Text style={styles.detailItem}>Waliofika Kanisani: {report.totalChurchAttendees}</Text>
          <Text style={styles.detailItem}>Waliorudi Nyuma: {report.totalBackSlidesVisited}</Text>
          <Text style={styles.detailItem}>Maombi Yaliyotolewa: {report.totalPrayersOffered}</Text>
          <Text style={styles.detailItem}>Masomo ya Biblia: {report.totalBibleStudies}</Text>
          <Text style={styles.detailItem}>Wagombea Ubatizo: {report.totalBaptismCandidates}</Text>
          <Text style={styles.detailItem}>Mabatizo Yaliyofanywa: {report.totalBaptismsPerformed}</Text>
          <Text style={styles.detailItem}>Watu Waliotembelewa: {report.totalPeopleVisited}</Text>
        </View>

        <View style={styles.detailSection}>
          <Text style={styles.detailSectionTitle}>Taarifa za Kila Siku</Text>
          {report.dailyReports.map((daily, index) => (
            <View key={index} style={styles.dailyReportDetail}>
              <Text style={styles.dailyReportTitle}>
                {DataService.getDayName(new Date(daily.date))} - {new Date(daily.date).toLocaleDateString()}
              </Text>
              <Text style={styles.dailyReportInfo}>
                Masaa: {daily.hoursWorked} | Vitabu: {daily.booksSold} | Mauzo: TSH {daily.dailyAmount.toLocaleString()}
              </Text>
            </View>
          ))}
        </View>

        <TouchableOpacity 
          style={styles.pdfGenerateButton}
          onPress={() => generateWeeklyPDF(report)}
        >
          <FileDown size={20} color="#ffffff" />
          <Text style={styles.pdfGenerateButtonText}>Tengeneza PDF ya Wiki</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  if (selectedReport) {
    return (
      <SafeAreaView style={styles.container}>
        <ReportDetail report={selectedReport} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Historia ya Taarifa</Text>
        <Text style={styles.headerSubtitle}>Ona na simamia taarifa zako</Text>
        
        <TouchableOpacity style={styles.monthlyButton} onPress={generateCurrentMonthReport}>
          <TrendingUp size={16} color="#ffffff" />
          <Text style={styles.monthlyButtonText}>Tengeneza Taarifa ya Mwezi</Text>
        </TouchableOpacity>
      </View>

      {/* View Mode Selector */}
      <ViewModeSelector />

      {/* Reports List */}
      <View style={styles.listContainer}>
        {loading ? (
          <Text style={styles.loadingText}>Inapakia taarifa...</Text>
        ) : (
          <>
            {viewMode === 'daily' && (
              <>
                {dailyReports.length === 0 ? (
                  <View style={styles.emptyState}>
                    <FileText size={64} color="#9ca3af" />
                    <Text style={styles.emptyStateTitle}>Hakuna Taarifa za Kila Siku</Text>
                    <Text style={styles.emptyStateText}>Tengeneza taarifa ya kwanza ya kila siku</Text>
                  </View>
                ) : (
                  <FlatList
                    data={dailyReports}
                    renderItem={DailyReportCard}
                    keyExtractor={(item) => item.id}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.listContent}
                  />
                )}
              </>
            )}

            {viewMode === 'weekly' && (
              <>
                {weeklyReports.length === 0 ? (
                  <View style={styles.emptyState}>
                    <FileText size={64} color="#9ca3af" />
                    <Text style={styles.emptyStateTitle}>Hakuna Taarifa za Wiki</Text>
                    <Text style={styles.emptyStateText}>Taarifa za wiki zitatengenezwa moja kwa moja</Text>
                  </View>
                ) : (
                  <FlatList
                    data={weeklyReports}
                    renderItem={WeeklyReportCard}
                    keyExtractor={(item) => item.id}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.listContent}
                  />
                )}
              </>
            )}

            {viewMode === 'monthly' && (
              <>
                {monthlyReports.length === 0 ? (
                  <View style={styles.emptyState}>
                    <FileText size={64} color="#9ca3af" />
                    <Text style={styles.emptyStateTitle}>Hakuna Taarifa za Mwezi</Text>
                    <Text style={styles.emptyStateText}>Bonyeza "Tengeneza Taarifa ya Mwezi" hapo juu</Text>
                  </View>
                ) : (
                  <FlatList
                    data={monthlyReports}
                    renderItem={MonthlyReportCard}
                    keyExtractor={(item) => item.id}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.listContent}
                  />
                )}
              </>
            )}
          </>
        )}
      </View>
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
    marginBottom: 16,
  },
  monthlyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  monthlyButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    marginLeft: 6,
  },
  viewModeSelector: {
    flexDirection: 'row',
    margin: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 4,
  },
  viewModeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  viewModeButtonActive: {
    backgroundColor: '#1e3a8a',
  },
  viewModeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  viewModeTextActive: {
    color: '#ffffff',
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  listContent: {
    paddingBottom: 16,
  },
  loadingText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#6b7280',
    marginTop: 32,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    padding: 32,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  reportCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  reportNumberBadge: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  reportNumber: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 12,
  },
  lockStatus: {
    padding: 4,
  },
  reportStudentName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 4,
  },
  reportDate: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  reportStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  reportStat: {
    alignItems: 'center',
  },
  reportStatValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  reportStatLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  reportActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionButtonText: {
    color: '#1e3a8a',
    fontWeight: '500',
    marginLeft: 4,
  },
  pdfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  pdfButtonText: {
    color: '#059669',
    fontWeight: '500',
    marginLeft: 4,
  },
  pdfGenerateButton: {
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  pdfGenerateButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    marginLeft: 8,
  },
  detailContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#1e3a8a',
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  closeButton: {
    fontSize: 16,
    color: '#bfdbfe',
    fontWeight: '500',
  },
  detailContent: {
    flex: 1,
    padding: 16,
  },
  detailSection: {
    marginBottom: 24,
  },
  detailSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  detailItem: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 8,
    paddingVertical: 4,
  },
  dailyReportDetail: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  dailyReportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  dailyReportInfo: {
    fontSize: 14,
    color: '#6b7280',
  },
});