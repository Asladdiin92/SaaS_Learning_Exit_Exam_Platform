export interface ColorPalette {
  surface: {
    primary: string;
    card: string;
    secondary: string;
    elevated: string;
  };
  text: {
    primary: string;
    secondary: string;
    muted: string;
    inverse: string;
  };
  brand: {
    primary: string;
    primaryLight: string;
    primaryDark: string;
  };
  status: {
    online: string;
    offline: string;
    error: string;
    locked: string;
    info: string;
  };
  border: {
    default: string;
    focused: string;
    subtle: string;
  };
}

export const lightColors: ColorPalette = {
  surface: {
    primary: '#F8FAFC',
    card: '#FFFFFF',
    secondary: '#F1F5F9',
    elevated: '#FFFFFF',
  },
  text: {
    primary: '#0F172A',     // WCAG AAA contrast >= 7:1
    secondary: '#475569',   // WCAG AA contrast >= 4.5:1
    muted: '#64748B',
    inverse: '#FFFFFF',
  },
  brand: {
    primary: '#1D4ED8',     // Deep Blue
    primaryLight: '#3B82F6',
    primaryDark: '#1E40AF',
  },
  status: {
    online: '#15803D',      // Emerald Green
    offline: '#B45309',     // Amber / Provisional
    error: '#B91C1C',       // Crimson Red
    locked: '#64748B',      // Slate Gray
    info: '#0284C7',
  },
  border: {
    default: '#E2E8F0',
    focused: '#1D4ED8',
    subtle: '#F1F5F9',
  },
};

export const darkColors: ColorPalette = {
  surface: {
    primary: '#0F172A',
    card: '#1E293B',
    secondary: '#1A2234',
    elevated: '#334155',
  },
  text: {
    primary: '#F8FAFC',     // WCAG AAA contrast >= 7:1
    secondary: '#94A3B8',   // WCAG AA contrast >= 4.5:1
    muted: '#64748B',
    inverse: '#0F172A',
  },
  brand: {
    primary: '#3B82F6',     // Vibrant Blue for Dark Mode
    primaryLight: '#60A5FA',
    primaryDark: '#1D4ED8',
  },
  status: {
    online: '#22C55E',      // Bright Green
    offline: '#F59E0B',     // Bright Amber
    error: '#EF4444',       // Coral Red
    locked: '#64748B',
    info: '#38BDF8',
  },
  border: {
    default: '#334155',
    focused: '#3B82F6',
    subtle: '#1E293B',
  },
};

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  screenPadding: 16,
  cardRhythm: 12,
  minTouchTarget: 48,      // 48dp minimum touch target
};

export const borderRadius = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 9999,
};
