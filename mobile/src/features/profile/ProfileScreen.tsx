import React from 'react';
import { View, Text, SafeAreaView, ScrollView, Alert } from 'react-native';
import { useTheme } from '../../shared/theme';
import { Button, Card } from '../../shared/components';
import { useAuthSession } from '../../services/auth-session/AuthSessionContext';
import { User, Building2, LogOut, Shield, HardDrive, Bell } from 'lucide-react-native';

interface ProfileScreenProps {
  navigation: any;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const { colors, typography, spacing, borderRadius } = useTheme();
  const { user, currentWorkspace, logout, isOfflineMode } = useAuthSession();

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of this device?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.screenPadding }}>
        <Text style={[typography.h1, { color: colors.text.primary, marginBottom: spacing.md }]}>
          Account & Settings
        </Text>

        {/* User Card */}
        <Card variant="elevated" style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: '#E0F2FE',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: spacing.sm,
              }}
            >
              <User size={24} color={colors.brand.primary} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[typography.h2, { color: colors.text.primary }]}>
                {user?.fullName || 'Student User'}
              </Text>
              <Text style={[typography.bodySm, { color: colors.text.secondary }]}>
                {user?.email || 'student@university.edu.et'}
              </Text>
            </View>
          </View>
        </Card>

        {/* Workspace Card */}
        <Card variant="outlined" style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
            <Building2 size={20} color={colors.brand.primary} />
            <Text style={[typography.h3, { color: colors.text.primary, marginLeft: 8 }]}>
              Current Workspace
            </Text>
          </View>
          <Text style={[typography.bodyMd, { color: colors.text.secondary, marginBottom: spacing.sm }]}>
            {currentWorkspace?.organizationName} ({currentWorkspace?.role})
          </Text>
          <Button
            title="Switch Workspace (MOB-04)"
            variant="outline"
            size="sm"
            onPress={() => navigation.navigate('WorkspaceSelection')}
          />
        </Card>

        {/* Device & Storage Settings */}
        <Card variant="outlined" style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
            <HardDrive size={20} color={colors.status.online} />
            <Text style={[typography.h3, { color: colors.text.primary, marginLeft: 8 }]}>
              Storage & Offline Mode
            </Text>
          </View>
          <Text style={[typography.bodySm, { color: colors.text.secondary, marginBottom: 4 }]}>
            SQLCipher Database: exit_exam_encrypted.db
          </Text>
          <Text style={[typography.labelSm, { color: colors.status.online, marginBottom: spacing.sm }]}>
            Encrypted with AES-256 local envelope key
          </Text>
          <Button
            title="Download Manager (MOB-12)"
            variant="outline"
            size="sm"
            onPress={() => navigation.navigate('DownloadManager')}
          />
        </Card>

        <Button
          title="Sign Out"
          variant="danger"
          leftIcon={<LogOut size={18} color="#FFFFFF" />}
          onPress={handleLogout}
          style={{ marginTop: spacing.md }}
        />
      </ScrollView>
    </SafeAreaView>
  );
};
