import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { WelcomeScreen } from '../features/auth/WelcomeScreen';
import { SignInScreen } from '../features/auth/SignInScreen';
import { CreateAccountScreen } from '../features/auth/CreateAccountScreen';
import { WorkspaceSelectionScreen } from '../features/auth/WorkspaceSelectionScreen';

const Stack = createNativeStackNavigator();

export const AuthStack = () => {
  return (
    <Stack.Navigator
      initialRouteName="Welcome"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="CreateAccount" component={CreateAccountScreen} />
      <Stack.Screen name="WorkspaceSelection" component={WorkspaceSelectionScreen} />
    </Stack.Navigator>
  );
};
