import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './src/shared/theme';
import { AuthSessionProvider } from './src/services/auth-session/AuthSessionContext';
import { RootNavigator } from './src/app/RootNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthSessionProvider>
          <RootNavigator />
        </AuthSessionProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
