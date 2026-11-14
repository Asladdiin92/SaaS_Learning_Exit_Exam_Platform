import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../shared/theme';
import { Card, Button } from '../../shared/components';
import { useAuthSession } from '../../services/auth-session';
import {
  examAttemptRepository,
  LocalExamAttempt,
} from '../../shared/database/examAttemptRepository';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertTriangle,
  History,
  RotateCw,
  ChevronRight,
  FileText,
} from 'lucide-react-native';

interface AttemptHistoryScreenProps {
  navigation: any;
}

type AttemptFilter = 'ALL' | 'SERVER_VERIFIED' | 'PENDING_SYNC' | 'NEEDS_ATTENTION';

export const AttemptHistoryScreen: React.FC<AttemptHistoryScreenProps> = ({
  navigation,
}) => {
  const { colors, typography, spacing, borderRadius } = useTheme();
  const { user } = useAuthSession();

  const [attempts, setAttempts] = useState<LocalExamAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<AttemptFilter>('ALL');

  const fetchAttempts = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await examAttemptRepository.getAllAttempts(user?.userId);
      setAttempts(rows);
    } catch (err) {
      console.warn('Failed to fetch attempts:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.userId]);

  useEffect(() => {
    fetchAttempts();
  }, [fetchAttempts]);

  const filteredAttempts = attempts.filter((att) => {
    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'SERVER_VERIFIED') return att.status === 'ACCEPTED_RESULT_READY';
    if (activeFilter === 'PENDING_SYNC')
      return att.status === 'SUBMITTED_LOCAL_PENDING' || att.status === 'IN_PROGRESS';
    if (activeFilter === 'NEEDS_ATTENTION') return att.status === 'REJECTED_NEEDS_ATTENTION';
    return true;
  });

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (_) {
      return isoString;
    }
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  };

  const handleAttemptPress = (att: LocalExamAttempt) => {
    if (att.status === 'ACCEPTED_RESULT_READY') {
      navigation.navigate('ExamResult', {
        localAttemptId: att.local_attempt_id,
        examPackageId: att.exam_package_id,
        status: 'ACCEPTED_RESULT_READY',
        scorePercent: 84.0,
        correctCount: 84,
        totalQuestions: 100,
        elapsedSec: att.elapsed_monotonic_sec,
      });
    } else {
      navigation.navigate('SubmissionStatus', {
        localAttemptId: att.local_attempt_id,
        operationId: `op_sync_${att.local_attempt_id.slice(0, 8)}`,
        title: att.exam_package_id,
      });
    }
  };

  const renderAttemptItem = ({ item }: { item: LocalExamAttempt }) => {
    const isVerified = item.status === 'ACCEPTED_RESULT_READY';
    const isPending = item.status === 'SUBMITTED_LOCAL_PENDING';
    const isInProgress = item.status === 'IN_PROGRESS';
    const isNationalExit = item.exam_package_id.includes('model_exit');

    return (
      <TouchableOpacity
        testID={`attempt-item-${item.local_attempt_id}`}
        onPress={() => handleAttemptPress(item)}
        activeOpacity={0.7}
      >
        <Card
          variant="elevated"
          style={{
            padding: spacing.md,
            marginBottom: spacing.sm,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flex: 1, marginRight: spacing.sm }}>
            {/* Category tag & status row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <View
                style={{
                  backgroundColor: isNationalExit ? '#FEF3C7' : '#EFF6FF',
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: borderRadius.sm,
                }}
              >
                <Text
                  style={[
                    typography.labelSm,
                    {
                      color: isNationalExit ? '#B45309' : colors.brand.primary,
                      fontWeight: '700',
                    },
                  ]}
                >
                  {isNationalExit ? 'National Exit Sim' : 'Course Practice'}
                </Text>
              </View>

              <View
                style={{
                  backgroundColor: isVerified
                    ? '#D1FAE5'
                    : isPending
                    ? '#FEF3C7'
                    : isInProgress
                    ? '#EFF6FF'
                    : '#FEF2F2',
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: borderRadius.sm,
                }}
              >
                <Text
                  style={[
                    typography.labelSm,
                    {
                      color: isVerified
                        ? colors.status.online
                        : isPending
                        ? '#B45309'
                        : isInProgress
                        ? colors.brand.primary
                        : colors.status.error,
                      fontWeight: '700',
                    },
                  ]}
                >
                  {isVerified
                    ? 'Server Verified'
                    : isPending
                    ? 'Pending Sync'
                    : isInProgress
                    ? 'In Progress'
                    : 'Needs Attention'}
                </Text>
              </View>
            </View>

            {/* Exam title */}
            <Text
              style={[
                typography.bodyMd,
                { color: colors.text.primary, fontWeight: '700', marginBottom: 4 },
              ]}
            >
              {item.exam_package_id}
            </Text>

            {/* Timestamp and duration */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Text style={[typography.labelSm, { color: colors.text.secondary }]}>
                {formatDate(item.started_at)}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Clock size={13} color={colors.text.secondary} />
                <Text style={[typography.labelSm, { color: colors.text.secondary }]}>
                  {formatDuration(item.elapsed_monotonic_sec)}
                </Text>
              </View>
            </View>
          </View>

          <ChevronRight size={20} color={colors.text.muted} />
        </Card>
      </TouchableOpacity>
    );
  };

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
            testID="history-back-btn"
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
              ASSESSMENT ARCHIVE
            </Text>
            <Text numberOfLines={1} style={[typography.h3, { color: colors.text.primary, fontWeight: '700' }]}>
              Attempt History
            </Text>
          </View>
        </View>

        {/* Filter Pills */}
        <View
          style={{
            flexDirection: 'row',
            paddingHorizontal: spacing.screenPadding,
            paddingVertical: spacing.sm,
            gap: 6,
            backgroundColor: colors.surface.secondary,
            borderBottomWidth: 1,
            borderBottomColor: colors.border.default,
          }}
        >
          {(
            [
              { key: 'ALL', label: 'All' },
              { key: 'SERVER_VERIFIED', label: 'Server Verified' },
              { key: 'PENDING_SYNC', label: 'Pending Sync' },
              { key: 'NEEDS_ATTENTION', label: 'Needs Attention' },
            ] as const
          ).map((tab) => {
            const isActive = activeFilter === tab.key;

            return (
              <TouchableOpacity
                key={tab.key}
                testID={`history-filter-${tab.key}`}
                onPress={() => setActiveFilter(tab.key)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: borderRadius.full,
                  backgroundColor: isActive ? colors.brand.primary : colors.surface.card,
                  borderWidth: 1,
                  borderColor: isActive ? colors.brand.primary : colors.border.default,
                }}
              >
                <Text
                  style={[
                    typography.labelSm,
                    {
                      color: isActive ? '#FFFFFF' : colors.text.secondary,
                      fontWeight: '700',
                    },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Attempt List */}
        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.brand.primary} />
            <Text style={[typography.bodyMd, { color: colors.text.secondary, marginTop: spacing.sm }]}>
              Loading attempt history…
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredAttempts}
            keyExtractor={(item) => item.local_attempt_id}
            renderItem={renderAttemptItem}
            contentContainerStyle={{
              padding: spacing.screenPadding,
              paddingBottom: spacing.xxl,
            }}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingTop: spacing.xxl }}>
                <FileText size={48} color={colors.text.muted} />
                <Text style={[typography.bodyMd, { color: colors.text.secondary, marginTop: spacing.md }]}>
                  No attempts match the selected filter.
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
};
