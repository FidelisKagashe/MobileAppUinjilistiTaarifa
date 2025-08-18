// app/layout.tsx
import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import AuthGuard from '@/components/AuthGuard';
import { ThemeProvider, useTheme } from './providers/ThemeProvider';
import { DataService } from '@/services/DataService';
import { LanguageService } from '@/services/LanguageService';

function InnerLayout() {
  // useTheme must be called inside ThemeProvider
  const { mode } = useTheme();

  React.useEffect(() => {
    // Initialize services when app starts
    (async () => {
      try {
        await DataService.initialize();
        await LanguageService.initialize();
      } catch (error) {
        console.error('Service initialization error:', error);
      }
    })();
  }, []);
  return (
    <AuthGuard>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
    </AuthGuard>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  return (
    <ThemeProvider>
      <InnerLayout />
    </ThemeProvider>
  );
}
