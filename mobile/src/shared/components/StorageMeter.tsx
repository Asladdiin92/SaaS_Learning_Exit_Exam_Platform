import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

interface StorageMeterProps {
  downloadedBytes: number;
  protectedExamQueueBytes: number;
  totalBytes: number;
}

export const StorageMeter: React.FC<StorageMeterProps> = ({
  downloadedBytes,
  protectedExamQueueBytes,
  totalBytes,
}) => {
  const { colors, typography } = useTheme();

  const toMB = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);
  const toGB = (bytes: number) => (bytes / (1024 * 1024 * 1024)).toFixed(2);

  const downloadedRatio = Math.min(1, downloadedBytes / totalBytes);
  const examQueueRatio = Math.min(1 - downloadedRatio, protectedExamQueueBytes / totalBytes);
  const freeBytes = Math.max(0, totalBytes - downloadedBytes - protectedExamQueueBytes);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[typography.h3, { color: colors.text.primary }]}>
          Device Storage Quota
        </Text>
        <Text style={[typography.bodySm, { color: colors.text.secondary }]}>
          {toMB(downloadedBytes + protectedExamQueueBytes)} MB used of {toGB(totalBytes)} GB
        </Text>
      </View>

      {/* Multi-segment Bar */}
      <View style={[styles.barBackground, { backgroundColor: colors.border.subtle }]}>
        <View
          style={[
            styles.segment,
            {
              flex: Math.max(0.001, downloadedRatio),
              backgroundColor: colors.brand.primary,
            },
          ]}
        />
        <View
          style={[
            styles.segment,
            {
              flex: Math.max(0.001, examQueueRatio),
              backgroundColor: colors.status.offline,
            },
          ]}
        />
        <View
          style={[
            styles.segment,
            {
              flex: Math.max(0.001, 1 - downloadedRatio - examQueueRatio),
              backgroundColor: colors.surface.secondary,
            },
          ]}
        />
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.brand.primary }]} />
          <Text style={[typography.labelSm, { color: colors.text.secondary }]}>
            Course Packages ({toMB(downloadedBytes)} MB)
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.status.offline }]} />
          <Text style={[typography.labelSm, { color: colors.text.secondary }]}>
            Exam Outbox Queue ({toMB(protectedExamQueueBytes)} MB)
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.border.default }]} />
          <Text style={[typography.labelSm, { color: colors.text.secondary }]}>
            Free ({toGB(freeBytes)} GB)
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  barBackground: {
    height: 12,
    borderRadius: 6,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 12,
  },
  segment: {
    height: '100%',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
