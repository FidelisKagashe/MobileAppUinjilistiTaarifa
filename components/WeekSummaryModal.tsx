// components/WeekSummaryModal.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { Calendar, Clock, DollarSign, Book, X, Award } from 'lucide-react-native';
import { WeekSummaryReport } from '@/types/Report';
import { LanguageService } from '@/services/LanguageService';
import { useTheme } from '@/app/providers/ThemeProvider';

interface WeekSummaryModalProps {
  visible: boolean;
  onClose: () => void;
  weekSummary: WeekSummaryReport | null;
}

export default function WeekSummaryModal({ visible, onClose, weekSummary }: WeekSummaryModalProps) {
  const { theme } = useTheme();
  const currentLanguage = LanguageService.getCurrentLanguage();

  if (!weekSummary) return null;

  const StatCard = ({ title, value, subtitle, icon: Icon, color }: any) => (
    <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.statHeader}>
        <Icon size={20} color={color} />
        <Text style={[styles.statTitle, { color: theme.textSecondary }]}>{title}</Text>
      </View>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      {subtitle && <Text style={[styles.statSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>}
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.primary }]}>
          <Text style={[styles.headerTitle, { color: theme.surface }]}>
            {currentLanguage === 'sw' ? 'Muhtasari wa Wiki' : 'Week Summary'}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color={theme.surface} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Week Info */}
          <View style={[styles.weekInfoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.weekInfoTitle, { color: theme.text }]}>
              {currentLanguage === 'sw' ? 'Wiki ya Kazi' : 'Work Week'} #{weekSummary.weekInfo.weekNumber}
            </Text>
            <Text style={[styles.weekInfoDate, { color: theme.textSecondary }]}>
              {new Date(weekSummary.weekInfo.weekStartDate).toLocaleDateString()} - {new Date(weekSummary.weekInfo.weekEndDate).toLocaleDateString()}
            </Text>
            <Text style={[styles.studentName, { color: theme.text }]}>
              {weekSummary.studentName}
            </Text>
          </View>

          {/* Summary Stats */}
          <View style={styles.statsSection}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {currentLanguage === 'sw' ? 'Muhtasari wa Utendaji' : 'Performance Summary'}
            </Text>
            
            <View style={styles.statsGrid}>
              <StatCard
                title={currentLanguage === 'sw' ? 'Jumla ya Masaa' : 'Total Hours'}
                value={`${weekSummary.summary.totalHours}h`}
                subtitle={`${weekSummary.summary.averageHoursPerDay.toFixed(1)}h ${currentLanguage === 'sw' ? 'kwa siku' : 'per day'}`}
                icon={Clock}
                color={theme.primary}
              />
              
              <StatCard
                title={currentLanguage === 'sw' ? 'Jumla ya Mauzo' : 'Total Sales'}
                value={`TSH ${weekSummary.summary.totalSales.toLocaleString()}`}
                subtitle={currentLanguage === 'sw' ? 'Mapato ya wiki' : 'Week earnings'}
                icon={DollarSign}
                color={theme.success}
              />
              
              <StatCard
                title={currentLanguage === 'sw' ? 'Vitabu Vilivyouzwa' : 'Books Sold'}
                value={weekSummary.summary.totalBooks}
                subtitle={currentLanguage === 'sw' ? 'Vitabu vilivyosambazwa' : 'Books distributed'}
                icon={Book}
                color={theme.error}
              />
              
              <StatCard
                title={currentLanguage === 'sw' ? 'Siku za Kazi' : 'Work Days'}
                value={weekSummary.summary.daysWorked}
                subtitle={`${currentLanguage === 'sw' ? 'kati ya' : 'out of'} 5`}
                icon={Award}
                color={theme.warning}
              />
            </View>
          </View>

          {/* Daily Breakdown */}
          <View style={styles.dailySection}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {currentLanguage === 'sw' ? 'Taarifa za Kila Siku' : 'Daily Breakdown'}
            </Text>
            
            {weekSummary.weekInfo.workDays.map((workDay, index) => {
              const dailyReport = weekSummary.dailyReports.find(r => r.date === workDay.date);
              
              return (
                <View key={index} style={[styles.dailyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <View style={styles.dailyHeader}>
                    <Text style={[styles.dailyTitle, { color: theme.text }]}>
                      {workDay.dayName}
                    </Text>
                    <Text style={[styles.dailyDate, { color: theme.textSecondary }]}>
                      {new Date(workDay.date).toLocaleDateString()}
                    </Text>
                    {workDay.isToday && (
                      <View style={[styles.todayBadge, { backgroundColor: theme.primary }]}>
                        <Text style={[styles.todayBadgeText, { color: theme.surface }]}>
                          {currentLanguage === 'sw' ? 'Leo' : 'Today'}
                        </Text>
                      </View>
                    )}
                  </View>
                  
                  {dailyReport ? (
                    <View style={styles.dailyStats}>
                      <Text style={[styles.dailyStat, { color: theme.textSecondary }]}>
                        {dailyReport.hoursWorked}h • {dailyReport.booksSold} {currentLanguage === 'sw' ? 'vitabu' : 'books'} • TSH {dailyReport.dailyAmount.toLocaleString()}
                      </Text>
                    </View>
                  ) : (
                    <Text style={[styles.noDataText, { color: theme.textSecondary }]}>
                      {currentLanguage === 'sw' ? 'Hakuna taarifa' : 'No report'}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>

          {/* Week Status */}
          <View style={[styles.statusCard, { backgroundColor: weekSummary.weekInfo.isActive ? theme.success + '10' : theme.error + '10', borderColor: weekSummary.weekInfo.isActive ? theme.success : theme.error }]}>
            <Text style={[styles.statusTitle, { color: weekSummary.weekInfo.isActive ? theme.success : theme.error }]}>
              {weekSummary.weekInfo.isActive 
                ? (currentLanguage === 'sw' ? 'Wiki Inaendelea' : 'Week In Progress')
                : (currentLanguage === 'sw' ? 'Wiki Imekamilika' : 'Week Completed')
              }
            </Text>
            <Text style={[styles.statusText, { color: theme.textSecondary }]}>
              {weekSummary.weekInfo.isActive 
                ? (currentLanguage === 'sw' ? 'Endelea na kazi yako nzuri!' : 'Keep up the great work!')
                : (currentLanguage === 'sw' ? 'Hongera kwa kukamilisha wiki!' : 'Congratulations on completing the week!')
              }
            </Text>
          </View>
        </ScrollView>
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
  weekInfoCard: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    alignItems: 'center',
  },
  weekInfoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  weekInfoDate: {
    fontSize: 14,
    marginBottom: 8,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
  },
  statsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  statCard: {
    padding: 16,
    borderRadius: 12,
    margin: 6,
    flex: 0.48,
    borderWidth: 1,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statTitle: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statSubtitle: {
    fontSize: 11,
  },
  dailySection: {
    marginBottom: 24,
  },
  dailyCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  dailyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dailyTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  dailyDate: {
    fontSize: 14,
  },
  todayBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  todayBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dailyStats: {
    marginTop: 4,
  },
  dailyStat: {
    fontSize: 14,
  },
  noDataText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  statusCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 20,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statusText: {
    fontSize: 14,
    textAlign: 'center',
  },
});