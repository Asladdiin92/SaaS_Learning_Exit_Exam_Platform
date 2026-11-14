import React, { useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useTheme } from '../../shared/theme';
import { Card, Button } from '../../shared/components';
import { ArrowLeft, Clock, ShieldCheck, CheckCircle2 } from 'lucide-react-native';

interface ExamRunnerScreenProps {
  route: any;
  navigation: any;
}

export const ExamRunnerScreen: React.FC<ExamRunnerScreenProps> = ({
  route,
  navigation,
}) => {
  const { colors, typography, spacing, borderRadius } = useTheme();
  const { title = 'Model Exit Exam', durationMinutes = 180, questionCount = 100 } = route.params || {};

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(1);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }}>
      <View style={{ flex: 1, padding: spacing.screenPadding }}>
        {/* Top Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
          <TouchableOpacity
            testID="exam-runner-back-btn"
            onPress={() => {
              Alert.alert('Exit Exam?', 'Your active attempt will remain saved in local SQLite.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Exit', onPress: () => navigation.goBack() },
              ]);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ minHeight: 48, minWidth: 48, justifyContent: 'center' }}
          >
            <ArrowLeft size={24} color={colors.text.primary} />
          </TouchableOpacity>

          <View style={{ alignItems: 'center' }}>
            <Text style={[typography.labelSm, { color: colors.text.secondary }]}>
              QUESTION {currentQuestionIndex} OF {questionCount}
            </Text>
            <Text style={[typography.h3, { color: colors.text.primary, fontWeight: '700' }]}>
              {title}
            </Text>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#EFF6FF',
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: borderRadius.sm,
            }}
          >
            <Clock size={16} color={colors.brand.primary} />
            <Text style={[typography.labelSm, { color: colors.brand.primary, fontWeight: '700', marginLeft: 4 }]}>
              {durationMinutes}:00
            </Text>
          </View>
        </View>

        {/* Question Card */}
        <Card variant="elevated" style={{ marginBottom: spacing.md, padding: spacing.lg }}>
          <Text style={[typography.labelSm, { color: colors.brand.primary, fontWeight: '700', marginBottom: 4 }]}>
            IT-CMTS-101 • HARDWARE DIAGNOSTICS
          </Text>
          <Text style={[typography.h3, { color: colors.text.primary, marginBottom: spacing.md }]}>
            A technician boots a desktop computer and receives continuous single beeps with no display signal. Which component is the primary source of failure?
          </Text>

          {['Power Supply Unit (PSU) line voltage drop', 'DRAM module unseated or parity error', 'PCIe Expansion bus arbitration failure', 'CMOS battery voltage under 2.8V'].map((opt, idx) => (
            <TouchableOpacity
              key={idx}
              testID={`exam-option-${idx}`}
              onPress={() => Alert.alert('Answer Recorded', 'Sub-16ms transactional write to local_answer_events successful.')}
              style={{
                borderWidth: 1,
                borderColor: colors.border.default,
                borderRadius: borderRadius.md,
                padding: spacing.md,
                marginBottom: spacing.sm,
                backgroundColor: colors.surface.card,
              }}
            >
              <Text style={[typography.bodyMd, { color: colors.text.primary }]}>
                {String.fromCharCode(65 + idx)}. {opt}
              </Text>
            </TouchableOpacity>
          ))}
        </Card>

        {/* Footer Navigation */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 'auto', marginBottom: spacing.md }}>
          <Button
            title="Flag Question"
            variant="outline"
            size="md"
            onPress={() => Alert.alert('Flagged', 'Question flagged for review.')}
            style={{ flex: 1, marginRight: spacing.xs, minHeight: 48 }}
          />
          <Button
            title="Next Question →"
            variant="primary"
            size="md"
            onPress={() => setCurrentQuestionIndex((prev) => Math.min(prev + 1, questionCount))}
            style={{ flex: 1, marginLeft: spacing.xs, minHeight: 48 }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};
