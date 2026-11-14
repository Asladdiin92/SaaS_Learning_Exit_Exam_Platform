import React from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../../shared/theme';
import { Card } from '../../shared/components';
import { ArrowLeft, Bell, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react-native';

interface NotificationsScreenProps {
  navigation: any;
}

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({ navigation }) => {
  const { colors, typography, spacing, borderRadius } = useTheme();

  const notifications = [
    {
      id: 'notif-1',
      title: '7-Day Offline Grant Active',
      message: 'Biometric offline access verified. You can study in Airplane Mode until 21 Nov 2026.',
      time: 'Just now',
      icon: <ShieldCheck size={20} color={colors.status.online} />,
      bg: '#ECFDF5',
    },
    {
      id: 'notif-2',
      title: 'National Exit Exam Blueprint Aligned',
      message: 'All 15 B.Sc. IT canonical courses cached in local SQLite database.',
      time: '2 hours ago',
      icon: <CheckCircle2 size={20} color={colors.brand.primary} />,
      bg: '#EFF6FF',
    },
    {
      id: 'notif-3',
      title: 'Haramaya University Model Exam Available',
      message: 'HU CCI 100-Question Exit Exam simulation ready for offline practice.',
      time: 'Yesterday',
      icon: <Sparkles size={20} color="#7E22CE" />,
      bg: '#F3E8FF',
    },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }}>
      <View style={{ flex: 1, padding: spacing.screenPadding }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
          <TouchableOpacity
            testID="notifications-back-btn"
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{
              marginRight: spacing.sm,
              minHeight: 48,
              minWidth: 48,
              justifyContent: 'center',
            }}
          >
            <ArrowLeft size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[typography.h2, { color: colors.text.primary, fontWeight: '700' }]}>
              Notifications (MOB-30)
            </Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {notifications.map((n) => (
            <Card key={n.id} variant="outlined" style={{ marginBottom: spacing.sm, padding: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: n.bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: spacing.sm,
                  }}
                >
                  {n.icon}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <Text style={[typography.bodyMd, { color: colors.text.primary, fontWeight: '700' }]}>
                      {n.title}
                    </Text>
                    <Text style={[typography.labelSm, { color: colors.text.muted, fontSize: 11 }]}>
                      {n.time}
                    </Text>
                  </View>
                  <Text style={[typography.bodySm, { color: colors.text.secondary }]}>
                    {n.message}
                  </Text>
                </View>
              </View>
            </Card>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};
