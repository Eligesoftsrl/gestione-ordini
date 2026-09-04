import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { LogBox, Platform } from 'react-native';

// Silenzia warning noti dopo upgrade a SDK 57 (RN 0.86):
// - "Unexpected text node: ." è generato da react-navigation/expo-router internamente
// - I due warning shadow*/pointerEvents sono deprecation notice non azionabili
const IGNORED_WARNINGS = [
  'Unexpected text node',
  '"shadow*" style props are deprecated',
  'props.pointerEvents is deprecated',
];

LogBox.ignoreLogs(IGNORED_WARNINGS);

// Su web LogBox non funziona: filtriamo direttamente console.error/warn
if (Platform.OS === 'web' && typeof console !== 'undefined') {
  const originalError = console.error;
  const originalWarn = console.warn;
  const shouldSuppress = (args: any[]) => {
    const msg = args.map(a => (typeof a === 'string' ? a : '')).join(' ');
    return IGNORED_WARNINGS.some(pattern => msg.includes(pattern));
  };
  console.error = (...args: any[]) => { if (!shouldSuppress(args)) originalError(...args); };
  console.warn = (...args: any[]) => { if (!shouldSuppress(args)) originalWarn(...args); };
}

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#f5f7fa' },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
