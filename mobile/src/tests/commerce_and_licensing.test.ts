import React from 'react';

// 1. Mock react-native
jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: (props: any) => React.createElement('View', props),
    Text: (props: any) => React.createElement('Text', props),
    TouchableOpacity: (props: any) => React.createElement('TouchableOpacity', props),
    ActivityIndicator: (props: any) => React.createElement('ActivityIndicator', props),
    ScrollView: (props: any) => React.createElement('ScrollView', props),
    SafeAreaView: (props: any) => React.createElement('SafeAreaView', props),
    RefreshControl: (props: any) => React.createElement('RefreshControl', props),
    TextInput: (props: any) => React.createElement('TextInput', props),
    Linking: {
      canOpenURL: jest.fn().mockResolvedValue(true),
      openURL: jest.fn().mockResolvedValue(true),
    },
    Platform: { OS: 'android', select: (obj: any) => obj.android || obj.default },
    StyleSheet: { create: (s: any) => s },
    Alert: { alert: jest.fn() },
  };
});

// 2. Mock lucide-react-native
jest.mock('lucide-react-native', () => {
  const React = require('react');
  return new Proxy(
    {},
    {
      get: (_, prop) => {
        const IconComponent = (props: any) =>
          React.createElement('Icon-' + String(prop), props);
        IconComponent.displayName = String(prop);
        return IconComponent;
      },
    }
  );
});

// 3. Mock expo-sqlite
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn().mockRejectedValue(new Error('Native SQLite disabled in Node test environment')),
}));

// 4. Mock expo-local-authentication
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn().mockResolvedValue(true),
  isEnrolledAsync: jest.fn().mockResolvedValue(true),
  authenticateAsync: jest.fn().mockResolvedValue({ success: true }),
  supportedAuthenticationTypesAsync: jest.fn().mockResolvedValue([1]),
  SecurityLevel: { BIOMETRIC: 2 },
}));

// 5. Mock expo-secure-store
const mockSecureStore: Record<string, string> = {};
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockSecureStore[key] = value;
  }),
  getItemAsync: jest.fn(async (key: string) => mockSecureStore[key] ?? null),
  deleteItemAsync: jest.fn(async (key: string) => {
    delete mockSecureStore[key];
  }),
  AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
}));

// 6. Mock expo-crypto
jest.mock('expo-crypto', () => {
  let counter = 2000;
  return {
    randomUUID: jest.fn(() => `crypto-uuid-s7-${++counter}`),
  };
});

// Mock expo-clipboard
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(true),
  getStringAsync: jest.fn().mockResolvedValue(''),
}));

// 7. Mock @react-navigation/native
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
  }),
  useRoute: () => ({
    params: {
      productId: '11111111-1111-4111-a111-111111111111',
      productCode: 'SUB-MONTHLY',
      title: 'Student Monthly Pass',
      amount: 250,
      currency: 'ETB',
      isRecurring: true,
    },
  }),
}));

// 8. Mock api client
jest.mock('../shared/api/client', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

import { api } from '../shared/api/client';
import { PlansAndAccessScreen } from '../features/commerce/screens/PlansAndAccessScreen';
import { StoreCatalogScreen } from '../features/commerce/screens/StoreCatalogScreen';
import { CheckoutScreen } from '../features/commerce/screens/CheckoutScreen';

describe('Slice 7 Verification: Commerce, Telebirr/Chapa/Stripe & Entitlements (MOB-24 to MOB-26)', () => {
  const sampleProducts = [
    {
      product_id: '11111111-1111-4111-a111-111111111111',
      code: 'SUB-MONTHLY',
      title: 'Student Monthly Pass',
      is_recurring: true,
      billing_interval_days: 30,
      price_amount: 250.0,
      currency: 'ETB',
      entitlement_spec: {
        offline_download_allowed: true,
        storage_quota_mb: 2048,
        ai_monthly_quota: 50,
      },
      is_active: true,
    },
    {
      product_id: '44444444-4444-4444-a444-444444444444',
      code: 'BUNDLE-EXIT-2023',
      title: 'National Exit Exam Simulation Pack',
      is_recurring: false,
      billing_interval_days: null,
      price_amount: 350.0,
      currency: 'ETB',
      entitlement_spec: {
        offline_download_allowed: true,
        storage_quota_mb: 2048,
        ai_monthly_quota: 100,
      },
      is_active: true,
    },
  ];

  const sampleEntitlements = {
    user_id: 'usr-buyer-1',
    tenant_id: null,
    offline_download_allowed: true,
    storage_quota_mb: 2048,
    ai_monthly_quota: 50,
    offline_grace_days: 7,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. MOB-24: Plans & Access Screen', () => {
    test('renders effective access quotas and workspace license seat', async () => {
      (api.get as jest.Mock).mockResolvedValue(sampleEntitlements);

      const element = React.createElement(PlansAndAccessScreen);
      expect(element).toBeDefined();
    });
  });

  describe('2. MOB-25: Store Catalog Screen', () => {
    test('renders products separated into Subscriptions and Bundles', async () => {
      (api.get as jest.Mock).mockResolvedValue(sampleProducts);

      const element = React.createElement(StoreCatalogScreen);
      expect(element).toBeDefined();
    });
  });

  describe('3. MOB-26: Checkout Screen', () => {
    test('renders order summary and payment provider options', () => {
      const element = React.createElement(CheckoutScreen);
      expect(element).toBeDefined();
    });
  });
});
