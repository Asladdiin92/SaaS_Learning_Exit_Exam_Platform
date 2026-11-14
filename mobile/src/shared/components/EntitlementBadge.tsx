import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme';
import { Lock, Check, Sparkles, AlertCircle, ShoppingBag } from 'lucide-react-native';

export type EntitlementStatus =
  | 'FREE'
  | 'INCLUDED'
  | 'PERSONAL_PLAN'
  | 'PURCHASED_BUNDLE'
  | 'INSTITUTION'
  | 'LOCKED'
  | 'EXPIRED';

interface EntitlementBadgeProps {
  status: EntitlementStatus;
  lastVerifiedAt?: string | null;
  testID?: string;
}

export const EntitlementBadge: React.FC<EntitlementBadgeProps> = ({
  status,
  lastVerifiedAt,
  testID = 'entitlement-badge',
}) => {
  const { colors, typography, spacing, borderRadius } = useTheme();

  const getConfig = () => {
    switch (status) {
      case 'FREE':
        return {
          bg: '#E0F2FE',
          text: '#0369A1',
          label: 'Free Tier',
          icon: null,
        };
      case 'INCLUDED':
      case 'PERSONAL_PLAN':
        return {
          bg: '#DCFCE7',
          text: '#15803D',
          label: status === 'PERSONAL_PLAN' ? 'Personal Plan' : 'Included',
          icon: <Check size={12} color="#15803D" />,
        };
      case 'PURCHASED_BUNDLE':
        return {
          bg: '#FEF3C7',
          text: '#B45309',
          label: 'Purchased Bundle',
          icon: <ShoppingBag size={12} color="#B45309" />,
        };
      case 'INSTITUTION':
        return {
          bg: '#F3E8FF',
          text: '#7E22CE',
          label: 'University Seat',
          icon: <Sparkles size={12} color="#7E22CE" />,
        };
      case 'EXPIRED':
        return {
          bg: '#FEE2E2',
          text: '#B91C1C',
          label: 'Access Expired',
          icon: <AlertCircle size={12} color="#B91C1C" />,
        };
      case 'LOCKED':
      default:
        return {
          bg: '#F1F5F9',
          text: '#64748B',
          label: 'Locked',
          icon: <Lock size={12} color="#64748B" />,
        };
    }
  };

  const { bg, text, label, icon } = getConfig();

  return (
    <View
      testID={testID}
      style={[
        styles.badge,
        {
          backgroundColor: bg,
          paddingHorizontal: spacing.xs + 2,
          paddingVertical: 4,
          borderRadius: borderRadius.sm,
        },
      ]}
    >
      {icon}
      <Text
        style={[
          typography.labelSm,
          {
            color: text,
            fontSize: 11,
            fontWeight: '600',
            marginLeft: icon ? 4 : 0,
          },
        ]}
      >
        {label}
        {lastVerifiedAt ? ` • Verified ${lastVerifiedAt}` : ''}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
});
