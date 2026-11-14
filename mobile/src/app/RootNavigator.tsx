import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthSession } from '../services/auth-session/AuthSessionContext';
import { useTheme } from '../shared/theme';
import { AuthStack } from './AuthStack';
import { StudentTabs } from './StudentTabs';
import { CourseListScreen } from '../features/curriculum/CourseListScreen';
import { CourseOverviewScreen } from '../features/curriculum/CourseOverviewScreen';
import { WorkspaceSelectionScreen } from '../features/auth/WorkspaceSelectionScreen';
import { ResourceLibraryScreen } from '../features/resources/ResourceLibraryScreen';
import { ResourceDetailScreen } from '../features/resources/ResourceDetailScreen';
import { ProtectedContentReaderScreen } from '../features/resources/ProtectedContentReaderScreen';
import { DownloadManagerScreen } from '../features/downloads/DownloadManagerScreen';

const RootStack = createNativeStackNavigator();

export const RootNavigator = () => {
  const { isAuthenticated, isLoading } = useAuthSession();
  const { colors } = useTheme();

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.surface.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color={colors.brand.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <RootStack.Screen name="Auth" component={AuthStack} />
        ) : (
          <>
            <RootStack.Screen name="MainTabs" component={StudentTabs} />
            <RootStack.Screen
              name="CourseList"
              component={CourseListScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <RootStack.Screen
              name="CourseOverview"
              component={CourseOverviewScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <RootStack.Screen
              name="WorkspaceSelection"
              component={WorkspaceSelectionScreen}
              options={{
                presentation: 'modal',
                animation: 'slide_from_bottom',
              }}
            />
            <RootStack.Screen
              name="ResourceLibrary"
              component={ResourceLibraryScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <RootStack.Screen
              name="ResourceDetail"
              component={ResourceDetailScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <RootStack.Screen
              name="ProtectedContentReader"
              component={ProtectedContentReaderScreen}
              options={{ animation: 'fade' }}
            />
            <RootStack.Screen
              name="DownloadManager"
              component={DownloadManagerScreen}
              options={{ animation: 'slide_from_right' }}
            />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
};
