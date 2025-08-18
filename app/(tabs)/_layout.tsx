// app/(tabs)/_layout.tsx
import React from 'react';
import { Tabs } from 'expo-router';
import { StatusBar } from 'react-native';
import { Chrome as Home, FileText, ChartBar as BarChart3, Settings, Plus } from 'lucide-react-native';
import { useTheme } from '../providers/ThemeProvider';
import { LanguageService } from '@/services/LanguageService';

export default function TabLayout() {
  const { theme, mode } = useTheme();
  const translations = LanguageService.getCurrentTranslations();

  return (
    <>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.primary,
          tabBarInactiveTintColor: theme.textSecondary,
          tabBarStyle: {
            backgroundColor: theme.card,
            borderTopWidth: 1,
            borderTopColor: theme.border,
            height: 60,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: translations.dashboard,
            tabBarIcon: ({ size, color }) => <Home size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="new-report"
          options={{
            title: translations.newReport,
            tabBarIcon: ({ size, color }) => <Plus size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="reports"
          options={{
            title: translations.reports,
            tabBarIcon: ({ size, color }) => <FileText size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="analytics"
          options={{
            title: translations.analytics,
            tabBarIcon: ({ size, color }) => <BarChart3 size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: translations.settings,
            tabBarIcon: ({ size, color }) => <Settings size={size} color={color} />,
          }}
        />
      </Tabs>
    </>
  );
}
