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
  TextInput,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
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
  Building2,
  Copy,
  Check,
  Send,
  Info,
} from 'lucide-react-native';

type CheckoutState =
  | 'READY'
  | 'SUBMITTING_PROOF'
  | 'AWAITING_APPROVAL'
  | 'CREATING_ORDER'
  | 'PENDING_VERIFICATION'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'CONNECTION_LOST';

type PaymentMethod =
  | 'telebirr_manual'
  | 'cbe_manual'
  | 'telebirr'
  | 'chapa'
  | 'stripe'
  | 'sandbox';

const ACCOUNTS = {
  cbe: {
    accountNumber: '1000531623421',
    accountHolder: 'ASLADIN ABDUKEDIR',
    bankName: 'Commercial Bank of Ethiopia (CBE)',
    instructions: 'Transfer via CBE Mobile Banking, CBE Birr, or *889# USSD.',
  },
  telebirr: {
    accountNumber: '0992947709',
    accountHolder: 'ASLADIN ABDUKEDIR',
    appName: 'Telebirr SuperApp / *127# USSD',
    instructions: 'Send money to phone number 0992947709 via Telebirr.',
  },
};

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

  const [selectedProvider, setSelectedProvider] = useState<PaymentMethod>('telebirr_manual');
  const [checkoutState, setCheckoutState] = useState<CheckoutState>('READY');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Manual Transfer Form Fields
  const [txReference, setTxReference] = useState<string>('');
  const [senderInfo, setSenderInfo] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [copiedToast, setCopiedToast] = useState<string | null>(null);
  const [approvalChecking, setApprovalChecking] = useState<boolean>(false);

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

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await Clipboard.setStringAsync(text);
      setCopiedToast(`Copied ${label} to clipboard!`);
      setTimeout(() => setCopiedToast(null), 2500);
    } catch {
      Alert.alert('Copied', text);
    }
  };

  // 1. Submit Manual Transfer Proof (CBE or Telebirr)
  const handleSubmitManualTransfer = async () => {
    if (!txReference.trim()) {
      setErrorMessage('Please enter your SMS transaction reference code (e.g. FT... or Telebirr trans ref).');
      return;
    }

    try {
      setCheckoutState('SUBMITTING_PROOF');
      setErrorMessage(null);

      const orderRes = await api.post<any>('/orders/manual-transfer', {
        product_id: productId,
        payment_method: selectedProvider,
        transaction_reference: txReference.trim(),
        sender_phone_or_name: senderInfo.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      const createdOrderId = orderRes.order_id;
      setOrderId(createdOrderId);
      setCheckoutState('AWAITING_APPROVAL');

      // Start automatic background polling for approval
      startApprovalPolling(createdOrderId);
    } catch (err: any) {
      setCheckoutState('READY');
      setErrorMessage(err.message || 'Failed to submit payment proof. Please verify your reference code.');
    }
  };

  // 2. Automated Gateway / Sandbox Payment Flow
  const handleStartGatewayPayment = async () => {
    try {
      setCheckoutState('CREATING_ORDER');
      setErrorMessage(null);

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

      const sessionRes = await api.post<any>('/checkout-sessions', {
        order_id: createdOrderId,
        provider: selectedProvider,
        return_url: 'saas-exam://checkout/return',
      });

      const checkoutUrl = sessionRes.checkout_url;
      if (selectedProvider !== 'sandbox') {
        const canOpen = await Linking.canOpenURL(checkoutUrl);
        if (canOpen) {
          await Linking.openURL(checkoutUrl);
        }
      }

      setCheckoutState('PENDING_VERIFICATION');
      startGatewayPolling(createdOrderId);
    } catch (err: any) {
      setCheckoutState('READY');
      setErrorMessage(err.message || 'Failed to initialize payment session.');
    }
  };

  const startApprovalPolling = (activeOrderId: string) => {
    cleanupPolling();
    let pollCount = 0;
    const maxPolls = 75; // 75 polls * 4s = 5 minutes

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
      } catch (_) {
        // Continue background polling
      }

      if (pollCount >= maxPolls) {
        cleanupPolling();
      }
    }, 4000);
  };

  const startGatewayPolling = (activeOrderId: string) => {
    cleanupPolling();
    let pollCount = 0;
    const maxPolls = 30;

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
      } catch (_) {
        if (pollCount > 10) {
          cleanupPolling();
          setCheckoutState('CONNECTION_LOST');
        }
      }

      if (pollCount >= maxPolls) {
        cleanupPolling();
        setCheckoutState('CONNECTION_LOST');
      }
    }, 2000);
  };

  const handleManualCheckApproval = async () => {
    if (!orderId) return;
    try {
      setApprovalChecking(true);
      const orderData = await api.get<any>(`/orders/${orderId}`);
      if (orderData.status === 'PAID') {
        cleanupPolling();
        setCheckoutState('PAYMENT_SUCCESS');
      } else if (orderData.status === 'FAILED') {
        cleanupPolling();
        setCheckoutState('PAYMENT_FAILED');
      } else {
        Alert.alert(
          'Verification In Progress',
          'Platform Owner ASLADIN ABDUKEDIR has received your transfer proof. Once verified against bank/Telebirr records, your features and offline access will unlock immediately.',
          [{ text: 'OK' }]
        );
      }
    } catch {
      Alert.alert('Connection Error', 'Could not reach the server to check approval status. Please check your internet connection.');
    } finally {
      setApprovalChecking(false);
    }
  };

  const isManualProvider = selectedProvider === 'telebirr_manual' || selectedProvider === 'cbe_manual';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.surface.primary }]}
      contentContainerStyle={styles.contentContainer}
      testID="checkout-screen"
    >
      {/* Top Navigation */}
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

      {/* Copied Feedback Toast */}
      {copiedToast && (
        <View style={[styles.toastBanner, { backgroundColor: '#10B981' }]}>
          <Check size={16} color="#FFFFFF" />
          <Text style={[typography.labelSm, { color: '#FFFFFF', fontWeight: '700', marginLeft: 6 }]}>
            {copiedToast}
          </Text>
        </View>
      )}

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

      {/* State View 1: READY / Method Selection & Form */}
      {checkoutState === 'READY' && (
        <View style={styles.section}>
          <Text style={[typography.h3, { color: colors.text.primary, marginBottom: 4 }]}>
            Choose Payment Method
          </Text>
          <Text style={[typography.bodySm, { color: colors.text.secondary, marginBottom: 14 }]}>
            Deposit directly or use automated gateways:
          </Text>

          {/* METHOD 1: Telebirr Direct Transfer */}
          <TouchableOpacity
            style={[
              styles.providerCard,
              {
                backgroundColor: colors.surface.card,
                borderColor: selectedProvider === 'telebirr_manual' ? colors.brand.primary : colors.border.subtle,
                borderWidth: selectedProvider === 'telebirr_manual' ? 2 : 1,
              },
            ]}
            onPress={() => setSelectedProvider('telebirr_manual')}
            testID="provider-telebirr-manual"
          >
            <Smartphone size={22} color="#2563EB" />
            <View style={styles.providerInfo}>
              <View style={styles.rowAlign}>
                <Text style={[typography.bodyMd, { color: colors.text.primary, fontWeight: '700' }]}>
                  Telebirr Direct Transfer
                </Text>
                <View style={[styles.badgePill, { backgroundColor: 'rgba(37, 99, 235, 0.12)' }]}>
                  <Text style={[typography.labelSm, { color: '#2563EB', fontWeight: '700' }]}>
                    Popular
                  </Text>
                </View>
              </View>
              <Text style={[typography.labelSm, { color: colors.text.muted, marginTop: 2 }]}>
                Phone: 0992947709 • ASLADIN ABDUKEDIR
              </Text>
            </View>
            {selectedProvider === 'telebirr_manual' && <CheckCircle2 size={20} color={colors.brand.primary} />}
          </TouchableOpacity>

          {/* METHOD 2: CBE Bank Transfer */}
          <TouchableOpacity
            style={[
              styles.providerCard,
              {
                backgroundColor: colors.surface.card,
                borderColor: selectedProvider === 'cbe_manual' ? colors.brand.primary : colors.border.subtle,
                borderWidth: selectedProvider === 'cbe_manual' ? 2 : 1,
              },
            ]}
            onPress={() => setSelectedProvider('cbe_manual')}
            testID="provider-cbe-manual"
          >
            <Building2 size={22} color="#7C3AED" />
            <View style={styles.providerInfo}>
              <View style={styles.rowAlign}>
                <Text style={[typography.bodyMd, { color: colors.text.primary, fontWeight: '700' }]}>
                  CBE Bank Transfer (Commercial Bank of Ethiopia)
                </Text>
              </View>
              <Text style={[typography.labelSm, { color: colors.text.muted, marginTop: 2 }]}>
                Account: 1000531623421 • ASLADIN ABDUKEDIR
              </Text>
            </View>
            {selectedProvider === 'cbe_manual' && <CheckCircle2 size={20} color={colors.brand.primary} />}
          </TouchableOpacity>

          {/* METHOD 3: Dev Sandbox Simulator */}
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
            {selectedProvider === 'sandbox' && <CheckCircle2 size={20} color={colors.brand.primary} />}
          </TouchableOpacity>

          {/* DIRECT TRANSFER DETAILS CARD (WHEN TELEBIRR OR CBE SELECTED) */}
          {isManualProvider && (
            <View
              style={[
                styles.manualInstructionBox,
                {
                  backgroundColor: colors.surface.card,
                  borderColor: selectedProvider === 'cbe_manual' ? '#7C3AED' : '#2563EB',
                },
              ]}
            >
              <View style={styles.boxHeader}>
                <Info size={16} color={selectedProvider === 'cbe_manual' ? '#7C3AED' : '#2563EB'} />
                <Text
                  style={[
                    typography.labelSm,
                    {
                      color: selectedProvider === 'cbe_manual' ? '#7C3AED' : '#2563EB',
                      fontWeight: '700',
                      marginLeft: 6,
                    },
                  ]}
                >
                  OFFICIAL BENEFICIARY ACCOUNT DETAILS
                </Text>
              </View>

              {/* Account Number Row with Copy Button */}
              <View style={styles.accountCard}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.labelSm, { color: colors.text.secondary }]}>
                    {selectedProvider === 'cbe_manual' ? 'CBE Account Number:' : 'Telebirr Phone Number:'}
                  </Text>
                  <Text
                    style={[
                      typography.h2,
                      {
                        color: colors.text.primary,
                        fontFamily: 'monospace',
                        letterSpacing: 1.5,
                        marginTop: 2,
                      },
                    ]}
                  >
                    {selectedProvider === 'cbe_manual'
                      ? ACCOUNTS.cbe.accountNumber
                      : ACCOUNTS.telebirr.accountNumber}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.copyButton, { backgroundColor: colors.surface.primary }]}
                  onPress={() =>
                    copyToClipboard(
                      selectedProvider === 'cbe_manual'
                        ? ACCOUNTS.cbe.accountNumber
                        : ACCOUNTS.telebirr.accountNumber,
                      selectedProvider === 'cbe_manual' ? 'CBE Account' : 'Telebirr Number'
                    )
                  }
                  activeOpacity={0.7}
                >
                  <Copy size={16} color={colors.brand.primary} />
                  <Text style={[typography.labelSm, { color: colors.brand.primary, fontWeight: '700', marginLeft: 4 }]}>
                    Copy
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Account Holder Row */}
              <View style={styles.detailRow}>
                <Text style={[typography.bodySm, { color: colors.text.secondary }]}>
                  Account Holder:
                </Text>
                <Text style={[typography.bodyMd, { color: colors.text.primary, fontWeight: '700' }]}>
                  ASLADIN ABDUKEDIR
                </Text>
              </View>

              {/* Deposit Steps */}
              <View style={styles.stepsContainer}>
                <Text style={[typography.labelSm, { color: colors.text.primary, fontWeight: '700', marginBottom: 4 }]}>
                  How to Complete:
                </Text>
                <Text style={[typography.bodySm, { color: colors.text.secondary, marginBottom: 2 }]}>
                  1. Open your {selectedProvider === 'cbe_manual' ? 'CBE Mobile App / *889#' : 'Telebirr app / *127#'}.
                </Text>
                <Text style={[typography.bodySm, { color: colors.text.secondary, marginBottom: 2 }]}>
                  2. Transfer exactly {Math.round(amount)} {currency} to the account above.
                </Text>
                <Text style={[typography.bodySm, { color: colors.text.secondary }]}>
                  3. Enter the transaction reference SMS code below and tap Submit.
                </Text>
              </View>

              {/* Input: Transaction Reference (Required) */}
              <View style={styles.inputGroup}>
                <Text style={[typography.labelSm, { color: colors.text.primary, fontWeight: '700', marginBottom: 6 }]}>
                  Transaction Reference / SMS Code *
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: colors.surface.primary,
                      borderColor: colors.border.default,
                      color: colors.text.primary,
                      fontFamily: 'monospace',
                    },
                  ]}
                  placeholder={
                    selectedProvider === 'cbe_manual'
                      ? 'e.g. FT2631589123'
                      : 'e.g. DB87654321 / 09929...'
                  }
                  placeholderTextColor={colors.text.muted}
                  value={txReference}
                  onChangeText={setTxReference}
                  autoCapitalize="characters"
                  testID="input-transaction-ref"
                />
              </View>

              {/* Input: Sender Phone / Name (Optional) */}
              <View style={styles.inputGroup}>
                <Text style={[typography.labelSm, { color: colors.text.primary, fontWeight: '600', marginBottom: 6 }]}>
                  Sender Phone Number or Name (Optional)
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: colors.surface.primary,
                      borderColor: colors.border.default,
                      color: colors.text.primary,
                    },
                  ]}
                  placeholder="e.g. 0911223344 or Abebe Kebede"
                  placeholderTextColor={colors.text.muted}
                  value={senderInfo}
                  onChangeText={setSenderInfo}
                  testID="input-sender-info"
                />
              </View>

              {/* Input: Notes (Optional) */}
              <View style={styles.inputGroup}>
                <Text style={[typography.labelSm, { color: colors.text.primary, fontWeight: '600', marginBottom: 6 }]}>
                  Additional Notes (Optional)
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: colors.surface.primary,
                      borderColor: colors.border.default,
                      color: colors.text.primary,
                    },
                  ]}
                  placeholder="e.g. B.Sc. IT Exit Exam preparation"
                  placeholderTextColor={colors.text.muted}
                  value={notes}
                  onChangeText={setNotes}
                  testID="input-notes"
                />
              </View>
            </View>
          )}

          {errorMessage && (
            <View style={[styles.errorBox, { backgroundColor: '#FEE2E2' }]}>
              <AlertCircle size={16} color="#DC2626" />
              <Text style={[typography.labelSm, { color: '#B91C1C', marginLeft: 6, flex: 1 }]}>
                {errorMessage}
              </Text>
            </View>
          )}

          {/* Action Button */}
          {isManualProvider ? (
            <TouchableOpacity
              style={[styles.payCTA, { backgroundColor: '#2563EB' }]}
              onPress={handleSubmitManualTransfer}
              activeOpacity={0.8}
              testID="submit-proof-btn"
            >
              <Send size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={[typography.h3, { color: '#FFFFFF', fontWeight: '700' }]}>
                Submit Payment Proof for Approval
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.payCTA, { backgroundColor: colors.brand.primary }]}
              onPress={handleStartGatewayPayment}
              activeOpacity={0.8}
              testID="pay-now-btn"
            >
              <Text style={[typography.h3, { color: '#FFFFFF', fontWeight: '700' }]}>
                Proceed to {selectedProvider.toUpperCase()} Payment
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* State View 2: SUBMITTING_PROOF */}
      {checkoutState === 'SUBMITTING_PROOF' && (
        <View style={styles.centerStatusView}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
          <Text style={[typography.h3, { color: colors.text.primary, marginTop: 14 }]}>
            Submitting Payment Proof...
          </Text>
          <Text style={[typography.bodySm, { color: colors.text.secondary, marginTop: 4 }]}>
            Notifying Platform Owner ASLADIN ABDUKEDIR
          </Text>
        </View>
      )}

      {/* State View 3: AWAITING_APPROVAL (Real Manual Clearance Flow) */}
      {checkoutState === 'AWAITING_APPROVAL' && (
        <View
          style={[
            styles.statusCard,
            { backgroundColor: colors.surface.card, borderColor: '#F59E0B' },
          ]}
        >
          <Clock size={44} color="#D97706" />
          <Text style={[typography.h2, { color: colors.text.primary, marginTop: 14, textAlign: 'center' }]}>
            Payment Proof Submitted!
          </Text>
          <Text style={[typography.bodySm, { color: colors.text.secondary, textAlign: 'center', marginTop: 6 }]}>
            Your transfer claim has been recorded and submitted to Platform Owner ASLADIN ABDUKEDIR.
          </Text>

          {/* Transfer Summary Pill */}
          <View style={[styles.proofSummaryCard, { backgroundColor: colors.surface.primary }]}>
            <View style={styles.summaryRow}>
              <Text style={[typography.labelSm, { color: colors.text.secondary }]}>Payment Method:</Text>
              <Text style={[typography.labelSm, { color: colors.text.primary, fontWeight: '700' }]}>
                {selectedProvider === 'cbe_manual' ? 'CBE Bank Transfer' : 'Telebirr Direct'}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[typography.labelSm, { color: colors.text.secondary }]}>Account Holder:</Text>
              <Text style={[typography.labelSm, { color: colors.text.primary, fontWeight: '700' }]}>
                ASLADIN ABDUKEDIR
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[typography.labelSm, { color: colors.text.secondary }]}>Transaction Ref:</Text>
              <Text style={[typography.labelSm, { color: '#D97706', fontWeight: '700', fontFamily: 'monospace' }]}>
                {txReference.toUpperCase()}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[typography.labelSm, { color: colors.text.secondary }]}>Amount:</Text>
              <Text style={[typography.labelSm, { color: '#10B981', fontWeight: '700' }]}>
                {Math.round(amount)} {currency}
              </Text>
            </View>
          </View>

          <View style={[styles.warningPill, { backgroundColor: '#FEF3C7', marginVertical: 14 }]}>
            <AlertCircle size={14} color="#D97706" />
            <Text style={[typography.labelSm, { color: '#B45309', marginLeft: 6, flex: 1 }]}>
              Once the transaction is verified, your full study package, offline download access, and AI tutor features unlock automatically.
            </Text>
          </View>

          {/* Check Status Button */}
          <TouchableOpacity
            style={[styles.payCTA, { backgroundColor: '#2563EB', width: '100%', marginTop: 10 }]}
            onPress={handleManualCheckApproval}
            disabled={approvalChecking}
            activeOpacity={0.8}
            testID="check-approval-btn"
          >
            {approvalChecking ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <RefreshCw size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={[typography.h3, { color: '#FFFFFF', fontWeight: '700' }]}>
                  Check Approval Status
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryCTA, { borderColor: colors.border.default, width: '100%', marginTop: 10 }]}
            onPress={() => navigation.navigate('MainTabs')}
          >
            <Text style={[typography.bodyMd, { color: colors.text.primary, fontWeight: '600' }]}>
              Return to Learning Dashboard
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* State View 4: CREATING_ORDER (Gateway) */}
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

      {/* State View 5: PENDING_VERIFICATION (Gateway Polling) */}
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

      {/* State View 6: PAYMENT_SUCCESS */}
      {checkoutState === 'PAYMENT_SUCCESS' && (
        <View
          style={[
            styles.statusCard,
            { backgroundColor: colors.surface.card, borderColor: colors.status.online },
          ]}
          testID="payment-success-view"
        >
          <CheckCircle2 size={48} color={colors.status.online} />
          <Text style={[typography.h2, { color: colors.text.primary, marginTop: 12, textAlign: 'center' }]}>
            Payment Verified — Access Activated ✓
          </Text>
          <Text style={[typography.bodySm, { color: colors.text.secondary, textAlign: 'center', marginTop: 6 }]}>
            Your feature entitlements, offline download permissions, and exit exam simulation packs are now live!
          </Text>

          <TouchableOpacity
            style={[styles.payCTA, { backgroundColor: colors.status.online, width: '100%', marginTop: 20 }]}
            onPress={() => navigation.navigate('MainTabs')}
            testID="go-to-learning-btn"
          >
            <Text style={[typography.h3, { color: '#FFFFFF', fontWeight: '700' }]}>
              Start Learning & Practice
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* State View 7: PAYMENT_FAILED */}
      {checkoutState === 'PAYMENT_FAILED' && (
        <View
          style={[
            styles.statusCard,
            { backgroundColor: colors.surface.card, borderColor: colors.status.error },
          ]}
        >
          <AlertCircle size={44} color={colors.status.error} />
          <Text style={[typography.h2, { color: colors.text.primary, marginTop: 12 }]}>
            Payment Cancelled or Rejected
          </Text>
          <Text style={[typography.bodySm, { color: colors.text.secondary, textAlign: 'center', marginTop: 6 }]}>
            The transaction was not completed or could not be verified in bank records.
          </Text>

          <TouchableOpacity
            style={[styles.payCTA, { backgroundColor: colors.brand.primary, width: '100%', marginTop: 20 }]}
            onPress={() => setCheckoutState('READY')}
          >
            <Text style={[typography.h3, { color: '#FFFFFF', fontWeight: '700' }]}>
              Try Again
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* State View 8: CONNECTION_LOST */}
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
            onPress={handleManualCheckApproval}
          >
            <Text style={[typography.h3, { color: '#FFFFFF', fontWeight: '700' }]}>
              Check Payment Status
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Security Note */}
      <View style={styles.securityNote}>
        <ShieldCheck size={14} color={colors.text.muted} />
        <Text style={[typography.labelSm, { color: colors.text.muted, marginLeft: 6 }]}>
          PCI-DSS Level 1 & Bank Encrypted. Direct transfer verified by Platform Owner.
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
  toastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 14,
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
    minHeight: 52,
  },
  providerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  rowAlign: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  manualInstructionBox: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 16,
    marginVertical: 12,
  },
  boxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.03)',
    marginBottom: 10,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    marginBottom: 10,
  },
  stepsContainer: {
    marginBottom: 14,
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  inputGroup: {
    marginBottom: 12,
  },
  textInput: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 44,
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
    minHeight: 50,
    marginTop: 10,
  },
  secondaryCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 12,
    borderWidth: 1,
    minHeight: 46,
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
  proofSummaryCard: {
    width: '100%',
    padding: 12,
    borderRadius: 8,
    marginTop: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  warningPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
});
