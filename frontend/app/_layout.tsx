import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { PaperProvider, MD3DarkTheme } from 'react-native-paper';
import { registerTranslation, it as paperItalian } from 'react-native-paper-dates';

// Registra la lingua italiana per i picker Material
registerTranslation('it', paperItalian);

const paperTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#e94560',
    secondary: '#f39c12',
    background: '#1a1a2e',
    surface: '#16213e',
    onSurface: '#ffffff',
  },
};

export default function RootLayout() {
  return (
    <PaperProvider theme={paperTheme}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#1a1a2e' },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </PaperProvider>
  );
}
