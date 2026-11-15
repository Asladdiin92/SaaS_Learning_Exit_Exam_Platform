import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polygon, Line, Circle, Text as SvgText, G } from 'react-native-svg';
import { useTheme } from '../../../shared/theme';
import { BloomLevel } from '../../../shared/database/progressRepository';

interface BloomsRadarChartProps {
  data: BloomLevel[];
  size?: number;
}

export const BloomsRadarChart: React.FC<BloomsRadarChartProps> = ({
  data,
  size = 280,
}) => {
  const { colors, typography, spacing } = useTheme();

  // 6 Cognitive Levels in canonical hierarchy order
  const order = ['REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYSE', 'EVALUATE', 'CREATE'];
  const sortedData = order.map((lvl) => {
    return (
      data.find((d) => d.level.toUpperCase() === lvl) || {
        level: lvl,
        display_name: lvl.charAt(0) + lvl.slice(1).toLowerCase(),
        attempted_count: 0,
        correct_count: 0,
        mastery_score: 0.0,
        mastery_percentage: 0.0,
      }
    );
  });

  const center = size / 2;
  const padding = 45;
  const maxRadius = center - padding;
  const numSides = 6;
  const angleStep = (2 * Math.PI) / numSides;
  const startAngle = -Math.PI / 2; // Point top

  // Helper: calculate point on polygon
  const getCoordinates = (index: number, radius: number) => {
    const angle = startAngle + index * angleStep;
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
    };
  };

  // Concentric Grid Rings at 25%, 50%, 75%, 100%
  const gridRings = [0.25, 0.5, 0.75, 1.0].map((fraction) => {
    const r = maxRadius * fraction;
    const points = Array.from({ length: numSides }, (_, i) => {
      const { x, y } = getCoordinates(i, r);
      return `${x},${y}`;
    }).join(' ');
    return { points, fraction };
  });

  // Radial Axes lines from center to outer ring
  const axes = Array.from({ length: numSides }, (_, i) => {
    return getCoordinates(i, maxRadius);
  });

  // Data Polygon points (minimum radius of 0.05 so shape is visible even at 0)
  const dataPoints = sortedData.map((item, i) => {
    const normalizedScore = Math.max(0.04, Math.min(1.0, item.mastery_score || 0));
    return getCoordinates(i, maxRadius * normalizedScore);
  });
  const dataPolygonString = dataPoints.map((p) => `${p.x},${p.y}`).join(' ');

  // Outer Labels coordinates
  const labels = sortedData.map((item, i) => {
    const labelRadius = maxRadius + 22;
    const coords = getCoordinates(i, labelRadius);
    const shortLabel = item.display_name.slice(0, 8);
    const pct = `${Math.round(item.mastery_percentage)}%`;
    return {
      ...coords,
      name: shortLabel,
      pct,
      index: i,
    };
  });

  return (
    <View style={styles.container}>
      <View style={styles.chartWrapper}>
        <Svg width={size} height={size}>
          {/* Concentric Grid Rings */}
          {gridRings.map((ring, idx) => (
            <Polygon
              key={`ring-${idx}`}
              points={ring.points}
              fill="none"
              stroke={colors.border.subtle}
              strokeWidth={idx === gridRings.length - 1 ? 1.5 : 1}
              strokeDasharray={idx === gridRings.length - 1 ? undefined : '3, 3'}
            />
          ))}

          {/* Radial Axis Lines */}
          {axes.map((axis, idx) => (
            <Line
              key={`axis-${idx}`}
              x1={center}
              y1={center}
              x2={axis.x}
              y2={axis.y}
              stroke={colors.border.subtle}
              strokeWidth={1}
            />
          ))}

          {/* Data Polygon Fill */}
          <Polygon
            points={dataPolygonString}
            fill={colors.brand.primary}
            fillOpacity={0.28}
            stroke={colors.brand.primary}
            strokeWidth={2.5}
          />

          {/* Data Vertices Dots */}
          {dataPoints.map((p, idx) => (
            <Circle
              key={`vertex-${idx}`}
              cx={p.x}
              cy={p.y}
              r={4}
              fill={colors.brand.primary}
              stroke={colors.surface.card}
              strokeWidth={1.5}
            />
          ))}

          {/* Vertex Labels around chart */}
          {labels.map((lbl) => {
            // Text alignment adjustments based on angle position
            let textAnchor: 'middle' | 'start' | 'end' = 'middle';
            if (lbl.x > center + 15) textAnchor = 'start';
            else if (lbl.x < center - 15) textAnchor = 'end';

            return (
              <G key={`lbl-${lbl.index}`}>
                <SvgText
                  x={lbl.x}
                  y={lbl.y - 2}
                  fontSize={10}
                  fontWeight="600"
                  fill={colors.text.primary}
                  textAnchor={textAnchor}
                >
                  {lbl.name}
                </SvgText>
                <SvgText
                  x={lbl.x}
                  y={lbl.y + 10}
                  fontSize={9}
                  fontWeight="700"
                  fill={colors.brand.primary}
                  textAnchor={textAnchor}
                >
                  {lbl.pct}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </View>

      {/* Accessible Breakdown List */}
      <View style={[styles.breakdownList, { borderTopColor: colors.border.subtle }]}>
        {sortedData.map((item) => (
          <View key={item.level} style={styles.breakdownRow}>
            <View style={styles.breakdownLabelGroup}>
              <Text style={[typography.bodySm, { color: colors.text.primary, fontWeight: '600' }]}>
                {item.display_name}
              </Text>
              <Text style={[typography.labelSm, { color: colors.text.muted }]}>
                {item.attempted_count > 0
                  ? `${item.correct_count}/${item.attempted_count} correct`
                  : 'Unattempted'}
              </Text>
            </View>
            <View style={styles.breakdownBarContainer}>
              <View
                style={[
                  styles.breakdownBarBg,
                  { backgroundColor: colors.surface.secondary },
                ]}
              >
                <View
                  style={[
                    styles.breakdownBarFill,
                    {
                      backgroundColor:
                        item.mastery_percentage >= 75
                          ? colors.status.online
                          : item.mastery_percentage >= 50
                          ? colors.brand.primary
                          : colors.text.muted,
                      width: `${Math.max(4, Math.min(100, item.mastery_percentage))}%`,
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  typography.labelSm,
                  styles.pctText,
                  { color: colors.text.secondary, fontWeight: '700' },
                ]}
              >
                {Math.round(item.mastery_percentage)}%
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
  },
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  breakdownList: {
    width: '100%',
    paddingTop: 12,
    borderTopWidth: 1,
    marginTop: 8,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  breakdownLabelGroup: {
    width: '38%',
  },
  breakdownBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '60%',
  },
  breakdownBarBg: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 8,
  },
  breakdownBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  pctText: {
    width: 36,
    textAlign: 'right',
  },
});
