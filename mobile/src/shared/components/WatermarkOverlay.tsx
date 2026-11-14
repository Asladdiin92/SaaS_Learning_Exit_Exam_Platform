import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

interface WatermarkOverlayProps {
  watermarkText: string;
  opacity?: number;
}

export const WatermarkOverlay: React.FC<WatermarkOverlayProps> = ({
  watermarkText,
  opacity = 0.08,
}) => {
  // Generate diagonal grid of watermark strings
  const items = Array.from({ length: 8 }, (_, i) => i);

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none" testID="watermark-overlay">
      <View style={styles.container}>
        {items.map((i) => (
          <View key={i} style={[styles.row, { opacity }]}>
            <Text style={styles.text}>{watermarkText}</Text>
            <Text style={styles.text}>{watermarkText}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-around',
    overflow: 'hidden',
  },
  row: {
    transform: [{ rotate: '-30deg' }],
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 24,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: 1.2,
    marginHorizontal: 16,
  },
});
