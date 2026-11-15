import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTheme } from '../../../shared/theme';
import { api } from '../../../shared/api/client';
import {
  ArrowLeft,
  ShieldCheck,
  CreditCard,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  ExternalLink,
  ShoppingBag,
} from 'lucide-react-native';

type CheckoutState =
  | 'READY'
  | 'CREATING_ORDER'
  | 'PENDING_VERIFICATION'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'CONNECTION_LOST';

export const CheckoutScreen: React.FC = () => {
  const { colors, typography, spacing } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const {
    productId,
    productCode,
    title,
    amount,
    currency,
    isRecurring,
  } = route.params || {
    productId: '11111111-1111-4111-a111-111111111111',
    productCode: 'SUB-MONTHLY',
    title: 'Student Monthly Pass',
    amount: 250,
    currency: 'ETB',
    isRecurring: true,
  };

  const [selectedProvider, setSelectedProvider] = useState<'telebirr' | 'chapa' | 'stripe' | 'sandbox'>('telebirr');
  const [checkoutState, setCheckoutState] = useState<CheckoutState>('READY');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pollingTimerRef = useRef<any>(null);

  const cleanupPolling = () => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => cleanupPolling();
  }, []);

  const handleStartPayment = async () => {
    try {
      setCheckoutState('CREATING_ORDER');
      setErrorMessage(null);

      // 1. Create Server Order (Idempotent)
      const idempotencyKey = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });

      const orderRes = await api.post<any>('/orders', {
        product_id: productId,
        currency: currency || 'ETB',
        idempotency_key: idempotencyKey,
      });

      const createdOrderId = orderRes.order_id;
      setOrderId(createdOrderId);

      // 2. Initialize Checkout Session
      const sessionRes = await api.post<any>('/checkout-sessions', {
        order_id: createdOrderId,
        provider: selectedProvider,
        return_url: 'saas-exam://checkout/return',
      });

      // 3. Open Provider Checkout URL (or simulate for sandbox)
      const checkoutUrl = sessionRes.checkout_url;
      if (selectedProvider !== 'sandbox') {
        const canOpen = await Linking.canOpenURL(checkoutUrl);
        if (canOpen) {
          await Linking.openURL(checkoutUrl);
        }
      }

      // 4. Begin Verification Polling
      setCheckoutState('PENDING_VERIFICATION');
      startPollingOrderStatus(createdOrderId);
    } catch (err: any) {
      setCheckoutState('READY');
      setErrorMessage(err.message || 'Failed to initialize payment session.');
    }
  };

  const startPollingOrderStatus = (activeOrderId: string) => {
    cleanupPolling();
    let pollCount = 0;
    const maxPolls = 30; // 30 polls * 2 sec = 60s timeout

    pollingTimerRef.current = setInterval(async () => {
      pollCount++;
      try {
        const orderData = await api.get<any>(`/orders/${activeOrderId}`);
        if (orderData.status === 'PAID') {
          cleanupPolling();
          setCheckoutState('PAYMENT_SUCCESS');
        } else if (orderData.status === 'FAILED') {
          cleanupPolling();
          setCheckoutState('PAYMENT_FAILED');
        }
      } catch (pollErr) {
        // If network drops during polling
        if (pollCount > 10) {
          cleanupPolling();
          setCheckoutState('CONNECTION_LOST');
        }
      }

      if (pollCount >= maxPolls) {
        cleanupPolling();
        // Give user ability to re-check
        setCheckoutState('CONNECTION_LOST');
      }
    }, 2000);
  };

  const handleManualCheckStatus = async () => {
    if (!orderId) return;
    try {
      const orderData = await api.get<any>(`/orders/${orderId}`);
      if (orderData.status === 'PAID') {
        setCheckoutState('PAYMENT_SUCCESS');
      } else {
        Alert.alert('Status Check', 'Payment is still being verified by the provider. Please allow up to 1 minute.');
      }
    } catch (_) {
      Alert.alert('Network Error', 'Could not reach the server to verify payment status.');
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.surface.primary }]}
      contentContainerStyle={styles.contentContainer}
      testID="checkout-screen"
    >
      {/* Top Nav */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          testID="checkout-back-btn"
        >
          <ArrowLeft size={22} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={[typography.h3, { color: colors.text.primary }]}>
          Order Checkout
        </Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Order Summary Card */}
      <View
        style={[
          styles.summaryCard,
          {
            backgroundColor: colors.surface.card,
            borderColor: colors.border.subtle,
          },
        ]}
      >
        <Text style={[typography.labelSm, { color: colors.brand.primary, fontWeight: '700' }]}>
          ORDER SUMMARY
        </Text>
        <Text style={[typography.h2, { color: colors.text.primary, marginTop: 4 }]}>
          {title}
        </Text>
        <Text style={[typography.bodySm, { color: colors.text.secondary }]}>
          Package Code: {productCode}
        </Text>

        <View style={styles.priceRow}>
          <Text style={[typography.bodyMd, { color: colors.text.secondary }]}>
            Total Amount:
          </Text>
          <Text style={[typography.h1, { color: colors.brand.primary }]}>
            {Math.round(amount)} {currency}
          </Text>
        </View>
      </View>

      {/* State View 1: READY / Initial Configuration */}
      {checkoutState === 'READY' && (
        <View style={styles.section}>
          <Text style={[typography.h3, { color: colors.text.primary, marginBottom: 10 }]}>
            Select Payment Method
          </Text>

          {/* Telebirr */}
          <TouchableOpacity
            style={[
              styles.providerCard,
              {
                backgroundColor: colors.surface.card,
                borderColor: selectedProvider === 'telebirr' ? colors.brand.primary : colors.border.subtle,
                borderWidth: selectedProvider === 'telebirr' ? 2 : 1,
              },
            ]}
            onPress={() => setSelectedProvider('telebirr')}
            testID="provider-telebirr"
          >
            <Smartphone size={22} color="#2563EB" />
            <View style={styles.providerInfo}>
              <Text style={[typography.bodyMd, { color: colors.text.primary, fontWeight: '600' }]}>
                Telebirr (USSD / SuperApp)
              </Text>
              <Text style={[typography.labelSm, { color: colors.text.muted }]}>
                Direct mobile payment via Ethio Telecom
              </Text>
            </View>
            {selectedProvider === 'telebirr' && <CheckCircle2 size={18} color={colors.brand.primary} />}
          </TouchableOpacity>

          {/* Chapa */}
          <TouchableOpacity
            style={[
              styles.providerCard,
              {
                backgroundColor: colors.surface.card,
                borderColor: selectedProvider === 'chapa' ? colors.brand.primary : colors.border.subtle,
                borderWidth: selectedProvider === 'chapa' ? 2 : 1,
              },
            ]}
            onPress={() => setSelectedProvider('chapa')}
            testID="provider-chapa"
          >
            <CreditCard size={22} color="#059669" />
            <View style={styles.providerInfo}>
              <Text style={[typography.bodyMd, { color: colors.text.primary, fontWeight: '600' }]}>
                Chapa (CBE Birr / Awash / Cards)
              </Text>
              <Text style={[typography.labelSm, { color: colors.text.muted }]}>
                Ethiopian multi-bank payment gateway
              </Text>
            </View>
            {selectedProvider === 'chapa' && <CheckCircle2 size={18} color={colors.brand.primary} />}
          </TouchableOpacity>

          {/* Stripe */}
          <TouchableOpacity
            style={[
              styles.providerCard,
              {
                backgroundColor: colors.surface.card,
                borderColor: selectedProvider === 'stripe' ? colors.brand.primary : colors.border.subtle,
                borderWidth: selectedProvider === 'stripe' ? 2 : 1,
              },
            ]}
            onPress={() => setSelectedProvider('stripe')}
            testID="provider-stripe"
          >
            <CreditCard size={22} color="#6366F1" />
            <View style={styles.providerInfo}>
              <Text style={[typography.bodyMd, { color: colors.text.primary, fontWeight: '600' }]}>
                International Credit / Debit Card
              </Text>
              <Text style={[typography.labelSm, { color: colors.text.muted }]}>
                Powered by Stripe
              </Text>
            </View>
            {selectedProvider === 'stripe' && <CheckCircle2 size={18} color={colors.brand.primary} />}
          </TouchableOpacity>

          {/* Sandbox */}
          <TouchableOpacity
            style={[
              styles.providerCard,
              {
                backgroundColor: colors.surface.card,
                borderColor: selectedProvider === 'sandbox' ? colors.brand.primary : colors.border.subtle,
                borderWidth: selectedProvider === 'sandbox' ? 2 : 1,
              },
            ]}
            onPress={() => setSelectedProvider('sandbox')}
            testID="provider-sandbox"
          >
            <ShieldCheck size={22} color="#EA580C" />
            <View style={styles.providerInfo}>
              <Text style={[typography.bodyMd, { color: colors.text.primary, fontWeight: '600' }]}>
                Dev Sandbox Simulator
              </Text>
              <Text style={[typography.labelSm, { color: colors.text.muted }]}>
                Instant test verification without external credentials
              </Text>
            </View>
            {selectedProvider === 'sandbox' && <CheckCircle2 size={18} color={colors.brand.primary} />}
          </TouchableOpacity>

          {errorMessage && (
            <View style={[styles.errorBox, { backgroundColor: '#FEE2E2' }]}>
              <AlertCircle size={16} color="#DC2626" />
              <Text style={[typography.labelSm, { color: '#B91C1C', marginLeft: 6 }]}>
                {errorMessage}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.payCTA, { backgroundColor: colors.brand.primary }]}
            onPress={handleStartPayment}
            activeOpacity={0.8}
            testID="pay-now-btn"
          >
            <Text style={[typography.h3, { color: '#FFFFFF' }]}>
              Proceed to {selectedProvider.toUpperCase()} Payment
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* State View 2: CREATING_ORDER */}
      {checkoutState === 'CREATING_ORDER' && (
        <View style={styles.centerStatusView}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
          <Text style={[typography.h3, { color: colors.text.primary, marginTop: 14 }]}>
            Initializing Secure Order...
          </Text>
          <Text style={[typography.bodySm, { color: colors.text.secondary, marginTop: 4 }]}>
            Contacting payment provider
          </Text>
        </View>
      )}

      {/* State View 3: PENDING_VERIFICATION */}
      {checkoutState === 'PENDING_VERIFICATION' && (
        <View
          style={[
            styles.statusCard,
            { backgroundColor: colors.surface.card, borderColor: '#F59E0B' },
          ]}
        >
          <Clock size={36} color="#D97706" />
          <Text style={[typography.h2, { color: colors.text.primary, marginTop: 12 }]}>
            Payment Verification Pending
          </Text>
          <Text style={[typography.bodySm, { color: colors.text.secondary, textAlign: 'center', marginTop: 6 }]}>
            We are awaiting the cryptographic payment confirmation from {selectedProvider.toUpperCase()}.
          </Text>

          <View style={[styles.warningPill, { backgroundColor: '#FEF3C7' }]}>
            <AlertCircle size={14} color="#D97706" />
            <Text style={[typography.labelSm, { color: '#B45309', marginLeft: 6 }]}>
              Do not pay again while verification is in progress.
            </Text>
          </View>

          <ActivityIndicator size="small" color={colors.brand.primary} style={{ marginTop: 16 }} />
        </View>
      )}

      {/* State View 4: PAYMENT_SUCCESS */}
      {checkoutState === 'PAYMENT_SUCCESS' && (
        <View
          style={[
            styles.statusCard,
            { backgroundColor: colors.surface.card, borderColor: colors.status.online },
          ]}
          testID="payment-success-view"
        >
          <CheckCircle2 size={44} color={colors.status.online} />
          <Text style={[typography.h2, { color: colors.text.primary, marginTop: 12 }]}>
            Payment Confirmed — Access Activated ✓
          </Text>
          <Text style={[typography.bodySm, { color: colors.text.secondary, textAlign: 'center', marginTop: 6 }]}>
            Your feature entitlements and offline download permissions are now live.
          </Text>

          <TouchableOpacity
            style={[styles.payCTA, { backgroundColor: colors.status.online, width: '100%', marginTop: 20 }]}
            onPress={() => navigation.navigate('MainTabs')}
            testID="go-to-learning-btn"
          >
            <Text style={[typography.h3, { color: '#FFFFFF' }]}>
              Start Learning & Practice
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* State View 5: PAYMENT_FAILED */}
      {checkoutState === 'PAYMENT_FAILED' && (
        <View
          style={[
            styles.statusCard,
            { backgroundColor: colors.surface.card, borderColor: colors.status.error },
          ]}
        >
          <AlertCircle size={44} color={colors.status.error} />
          <Text style={[typography.h2, { color: colors.text.primary, marginTop: 12 }]}>
            Payment Cancelled or Failed
          </Text>
          <Text style={[typography.bodySm, { color: colors.text.secondary, textAlign: 'center', marginTop: 6 }]}>
            The transaction was not completed. No funds were debited.
          </Text>

          <TouchableOpacity
            style={[styles.payCTA, { backgroundColor: colors.brand.primary, width: '100%', marginTop: 20 }]}
            onPress={() => setCheckoutState('READY')}
          >
            <Text style={[typography.h3, { color: '#FFFFFF' }]}>
              Try Again
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* State View 6: CONNECTION_LOST */}
      {checkoutState === 'CONNECTION_LOST' && (
        <View
          style={[
            styles.statusCard,
            { backgroundColor: colors.surface.card, borderColor: colors.border.default },
          ]}
        >
          <RefreshCw size={36} color={colors.brand.primary} />
          <Text style={[typography.h2, { color: colors.text.primary, marginTop: 12 }]}>
            Connection Lost During Checkout
          </Text>
          <Text style={[typography.bodySm, { color: colors.text.secondary, textAlign: 'center', marginTop: 6 }]}>
            Your device lost connection while checking your order. If you completed payment, your access will be activated upon server sync.
          </Text>

          <TouchableOpacity
            style={[styles.payCTA, { backgroundColor: colors.brand.primary, width: '100%', marginTop: 20 }]}
            onPress={handleManualCheckStatus}
          >
            <Text style={[typography.h3, { color: '#FFFFFF' }]}>
              Check Payment Status
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Security Guardrail Note */}
      <View style={styles.securityNote}>
        <ShieldCheck size={14} color={colors.text.muted} />
        <Text style={[typography.labelSm, { color: colors.text.muted, marginLeft: 6 }]}>
          PCI-DSS Level 1 Encrypted. We never store bank or card numbers on this device.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    minHeight: 48,
  },
  backBtn: {
    padding: 6,
  },
  summaryCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  section: {
    marginBottom: 16,
  },
  providerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    minHeight: 48,
  },
  providerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginVertical: 8,
  },
  payCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 14,
    minHeight: 48,
    marginTop: 10,
  },
  centerStatusView: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCard: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  warningPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 12,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
});
