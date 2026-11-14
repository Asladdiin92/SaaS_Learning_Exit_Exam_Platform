import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from '../shared/theme';
import { HomeDashboardScreen } from '../features/home/HomeDashboardScreen';
import { ThemeCatalogScreen } from '../features/curriculum/ThemeCatalogScreen';
import { PracticeCatalogScreen } from '../features/exams/PracticeCatalogScreen';
import { ProgressPlaceholder } from '../features/progress/ProgressPlaceholder';
import { ProfileScreen } from '../features/profile/ProfileScreen';
import { Home, BookOpen, Target, Award, User } from 'lucide-react-native';

const Tab = createBottomTabNavigator();

export const StudentTabs = () => {
  const { colors, typography, spacing } = useTheme();

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface.card,
          borderTopColor: colors.border.default,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.brand.primary,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarLabelStyle: {
          ...typography.labelSm,
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeDashboardScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => <Home size={size || 22} color={color} />,
        }}
      />
      <Tab.Screen
        name="Curriculum"
        component={ThemeCatalogScreen}
        options={{
          tabBarLabel: 'Themes',
          tabBarIcon: ({ color, size }) => <BookOpen size={size || 22} color={color} />,
        }}
      />
      <Tab.Screen
        name="Practice"
        component={PracticeCatalogScreen}
        options={{
          tabBarLabel: 'Practice',
          tabBarIcon: ({ color, size }) => <Target size={size || 22} color={color} />,
        }}
      />
      <Tab.Screen
        name="Progress"
        component={ProgressPlaceholder}
        options={{
          tabBarLabel: 'Mastery',
          tabBarIcon: ({ color, size }) => <Award size={size || 22} color={color} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Account',
          tabBarIcon: ({ color, size }) => <User size={size || 22} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
};
