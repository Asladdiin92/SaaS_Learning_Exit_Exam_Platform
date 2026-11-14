import { TextStyle } from 'react-native';

export interface TypographyScale {
  h1: TextStyle;
  h2: TextStyle;
  h3: TextStyle;
  bodyLg: TextStyle;
  bodyMd: TextStyle;
  bodySm: TextStyle;
  labelSm: TextStyle;
  code: TextStyle;
}

export const typography: TypographyScale = {
  // Screen Title (H1): 22sp Bold, line-height 28sp
  h1: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
  },
  // Section Header (H2): 18sp SemiBold, line-height 24sp
  h2: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
  },
  // Card Title / Question Stem (H3): 16sp Medium, line-height 24sp
  h3: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  // Large Body (Body-Lg): 16sp Regular, line-height 24sp
  bodyLg: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
  },
  // Standard Body (Body-Md): 14sp Regular, line-height 20sp
  bodyMd: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  // Small Body: 13sp Regular, line-height 18sp
  bodySm: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
  // Caption / Status Pill (Label-Sm): 12sp Medium, line-height 16sp
  labelSm: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  // Monospace Code Block
  code: {
    fontFamily: 'monospace',
    fontSize: 14,
    lineHeight: 20,
  },
};
