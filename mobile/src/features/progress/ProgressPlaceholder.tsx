import React from 'react';
import { View, Text, SafeAreaView } from 'react-native';
import { useTheme } from '../../shared/theme';
import { Card } from '../../shared/components';
import { Award } from 'lucide-react-native';

export const ProgressPlaceholder = () => {
  const { colors, typography, spacing } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }}>
      <View style={{ flex: 1, padding: spacing.screenPadding }}>
        <Text style={[typography.h1, { color: colors.text.primary, marginBottom: spacing.md }]}>
          Mastery Analytics
        </Text>
        <Card variant="outlined">
          <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
            <Award size={48} color={colors.status.online} />
            <Text style={[typography.h2, { color: colors.text.primary, marginTop: spacing.sm }]}>
              Bloom's Taxonomy Analytics (Slice 6)
            </Text>
            <Text style={[typography.bodyMd, { color: colors.text.secondary, textAlign: 'center', marginTop: 4 }]}>
              Continuous learning outcome tracking from Remember to Create with IRT calibration.
            </Text>
          </View>
        </Card>
      </View>
    </SafeAreaView>
  );
};
