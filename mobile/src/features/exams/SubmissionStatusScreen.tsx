import React, { useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../../shared/theme';
import { Card, Button } from '../../shared/components';
import { useNetwork } from '../../shared/network/NetworkContext';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Wifi,
  WifiOff,
  UploadCloud,
  Server,
  AlertCircle,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react-native';

interface SubmissionStatusScreenProps {
  route: any;
  navigation: any;
}

export const SubmissionStatusScreen: React.FC<SubmissionStatusScreenProps> = ({
  route,
  navigation,
}) => {
  const { colors, typography, spacing, borderRadius } = useTheme();
  const { isOnline } = useNetwork();

  const {
    localAttemptId = '',
    operationId = '',
    title = 'Exit Exam Assessment',
    initialStep = 2, // 1: Locked, 2: Waiting for connection, 3: Uploading, 4: Scoring, 5: Verified, 6: Rejected
  } = route.params || {};

  const currentStep = isOnline ? 3 : 2;

  const STEPS = [
    {
      step: 1,
      title: 'Saved & Locked on Device',
      desc: 'All 100 answers committed to encrypted local SQLite storage.',
      icon: <ShieldCheck size={20} color={colors.status.online} />,
    },
    {
      step: 2,
      title: 'Waiting for Internet Connection',
      desc: isOnline
        ? 'Connection established. Ready to transmit.'
        : 'Device is offline. Safe in durable sync outbox.',
      icon: isOnline ? (
        <Wifi size={20} color={colors.status.online} />
      ) : (
        <WifiOff size={20} color={colors.status.offline} />
      ),
    },
    {
      step: 3,
      title: 'Uploading Attempt',
      desc: `Operation ID: ${operationId}`,
      icon: <UploadCloud size={20} color={colors.brand.primary} />,
    },
    {
      step: 4,
      title: 'Received by Server — Scoring in Progress',
      desc: 'PostgreSQL 16 server-side grading executing.',
      icon: <Server size={20} color={colors.text.secondary} />,
    },
    {
      step: 5,
      title: 'Server Verified — Result Ready',
      desc: 'Official score and mastery updates recorded.',
      icon: <CheckCircle2 size={20} color={colors.status.online} />,
    },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }}>
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.screenPadding,
            paddingTop: spacing.md,
            paddingBottom: spacing.sm,
            borderBottomWidth: 1,
            borderBottomColor: colors.border.default,
            backgroundColor: colors.surface.card,
          }}
        >
          <TouchableOpacity
            testID="status-back-btn"
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              minHeight: 44,
              minWidth: 44,
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: spacing.sm,
            }}
          >
            <ArrowLeft size={22} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[typography.labelSm, { color: colors.text.secondary }]}>
              LIFECYCLE TRACKER (MOB-17)
            </Text>
            <Text numberOfLines={1} style={[typography.h3, { color: colors.text.primary, fontWeight: '700' }]}>
              Submission Status
            </Text>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: spacing.screenPadding,
            paddingBottom: spacing.xxl,
          }}
        >
          {/* Attempt Info */}
          <Card variant="elevated" style={{ padding: spacing.md, marginBottom: spacing.lg }}>
            <Text style={[typography.labelSm, { color: colors.brand.primary, fontWeight: '700', marginBottom: 2 }]}>
              TARGET ASSESSMENT
            </Text>
            <Text style={[typography.h3, { color: colors.text.primary, fontWeight: '700', marginBottom: 4 }]}>
              {title}
            </Text>
            <Text style={[typography.labelSm, { color: colors.text.secondary }]}>
              Local Attempt ID: {localAttemptId}
            </Text>
          </Card>

          {/* Stepper */}
          <Text style={[typography.labelSm, { color: colors.text.secondary, fontWeight: '700', marginBottom: spacing.md }]}>
            TRANSMISSION & SCORING PIPELINE
          </Text>

          <View style={{ gap: spacing.md, marginBottom: spacing.xl }}>
            {STEPS.map((s, idx) => {
              const isPast = s.step < currentStep;
              const isCurrent = s.step === currentStep;

              return (
                <View
                  key={s.step}
                  testID={`status-step-${s.step}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: spacing.md,
                  }}
                >
                  {/* Step indicator circle */}
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: isPast
                        ? '#D1FAE5'
                        : isCurrent
                        ? '#EFF6FF'
                        : colors.surface.secondary,
                      borderWidth: 2,
                      borderColor: isPast
                        ? colors.status.online
                        : isCurrent
                        ? colors.brand.primary
                        : colors.border.default,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    {isPast ? (
                      <CheckCircle2 size={18} color={colors.status.online} />
                    ) : (
                      <Text
                        style={[
                          typography.labelSm,
                          {
                            color: isCurrent ? colors.brand.primary : colors.text.muted,
                            fontWeight: '700',
                          },
                        ]}
                      >
                        {s.step}
                      </Text>
                    )}
                  </View>

                  {/* Step content */}
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        typography.bodyMd,
                        {
                          color: isCurrent
                            ? colors.brand.primary
                            : isPast
                            ? colors.text.primary
                            : colors.text.muted,
                          fontWeight: isCurrent || isPast ? '700' : '500',
                          marginBottom: 2,
                        },
                      ]}
                    >
                      {s.title}
                    </Text>
                    <Text style={[typography.bodySm, { color: colors.text.secondary }]}>
                      {s.desc}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* CTAs */}
          <View style={{ gap: spacing.sm }}>
            <Button
              testID="sync-center-btn"
              title="Open Sync Center (MOB-28)"
              variant="primary"
              size="lg"
              onPress={() => navigation.navigate('SyncCenter')}
              style={{ minHeight: 52 }}
            />
            <Button
              testID="return-to-catalog-btn"
              title="Back to Exam Catalog"
              variant="outline"
              size="md"
              onPress={() => navigation.navigate('MainTabs', { screen: 'Practice' })}
              style={{ minHeight: 48 }}
            />
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};
