import React from 'react';
import { View, Text, SafeAreaView } from 'react-native';
import { useTheme } from '../../shared/theme';
import { Card } from '../../shared/components';
import { FileQuestion } from 'lucide-react-native';

export const PracticeCatalogPlaceholder = () => {
  const { colors, typography, spacing } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }}>
      <View style={{ flex: 1, padding: spacing.screenPadding }}>
        <Text style={[typography.h1, { color: colors.text.primary, marginBottom: spacing.md }]}>
          Practice & Simulations
        </Text>
        <Card variant="outlined">
          <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
            <FileQuestion size={48} color={colors.brand.primary} />
            <Text style={[typography.h2, { color: colors.text.primary, marginTop: spacing.sm }]}>
              Assessment Engine (Slice 4)
            </Text>
            <Text style={[typography.bodyMd, { color: colors.text.secondary, textAlign: 'center', marginTop: 4 }]}>
              Practice Quizzes, 120-Q National Exit Simulations, and sub-16ms transactional SQLite exam runners.
            </Text>
          </View>
        </Card>
      </View>
    </SafeAreaView>
  );
};
