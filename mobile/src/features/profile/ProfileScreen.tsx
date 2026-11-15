import React from 'react';
import { View, Text, SafeAreaView, ScrollView, Alert } from 'react-native';
import { useTheme } from '../../shared/theme';
import { Button, Card } from '../../shared/components';
import { useAuthSession } from '../../services/auth-session/AuthSessionContext';
import {
  User,
  Building2,
  LogOut,
  Shield,
  HardDrive,
  Bell,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Globe,
  RefreshCw,
  HelpCircle,
} from 'lucide-react-native';

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

        {/* Commercial Access & Store */}
        <Card variant="outlined" style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
            <ShieldCheck size={20} color={colors.brand.primary} />
            <Text style={[typography.h3, { color: colors.text.primary, marginLeft: 8 }]}>
              Plans & Licensing
            </Text>
          </View>
          <Text style={[typography.bodySm, { color: colors.text.secondary, marginBottom: spacing.sm }]}>
            Personal subscriptions, one-time packs & institutional seats
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button
                title="Plans & Access (MOB-24)"
                variant="outline"
                size="sm"
                onPress={() => navigation.navigate('PlansAndAccess')}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="Study Store (MOB-25)"
                variant="primary"
                size="sm"
                onPress={() => navigation.navigate('StoreCatalog')}
              />
            </View>
          </View>
        </Card>

        {/* Offline Downloads & Sync Center */}
        <Card variant="outlined" style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
            <HardDrive size={20} color={colors.status.online} />
            <Text style={[typography.h3, { color: colors.text.primary, marginLeft: 8 }]}>
              Offline Data & Sync
            </Text>
          </View>
          <Text style={[typography.bodySm, { color: colors.text.secondary, marginBottom: spacing.sm }]}>
            SQLCipher encrypted database • Opaque change ledger
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            <View style={{ flex: 1 }}>
              <Button
                title="Download Manager (MOB-12)"
                variant="outline"
                size="sm"
                onPress={() => navigation.navigate('DownloadManager')}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="Sync Center (MOB-28)"
                variant="outline"
                size="sm"
                onPress={() => navigation.navigate('SyncCenter')}
              />
            </View>
          </View>
          <Button
            title="Storage & Cache Settings (MOB-27)"
            variant="outline"
            size="sm"
            onPress={() => navigation.navigate('StorageSettings')}
          />
        </Card>

        {/* Security & Devices */}
        <Card variant="outlined" style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
            <Smartphone size={20} color={colors.brand.primary} />
            <Text style={[typography.h3, { color: colors.text.primary, marginLeft: 8 }]}>
              Devices & Security
            </Text>
          </View>
          <Text style={[typography.bodySm, { color: colors.text.secondary, marginBottom: spacing.sm }]}>
            Active sessions, refresh token families & offline biometrics
          </Text>
          <Button
            title="Manage Devices (MOB-29)"
            variant="outline"
            size="sm"
            onPress={() => navigation.navigate('DevicesSecurity')}
          />
        </Card>

        {/* Settings, Language & Help */}
        <Card variant="outlined" style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
            <Globe size={20} color={colors.brand.primary} />
            <Text style={[typography.h3, { color: colors.text.primary, marginLeft: 8 }]}>
              Settings & Offline Help
            </Text>
          </View>
          <Text style={[typography.bodySm, { color: colors.text.secondary, marginBottom: spacing.sm }]}>
            English, አማርኛ, Afaan Oromoo & exam troubleshooting
          </Text>
          <Button
            title="Settings & Help (MOB-30)"
            variant="outline"
            size="sm"
            onPress={() => navigation.navigate('SettingsAndHelp')}
          />
        </Card>

        <Button
          title="Sign Out"
          variant="danger"
          leftIcon={<LogOut size={18} color="#FFFFFF" />}
          onPress={handleLogout}
          style={{ marginTop: spacing.md, marginBottom: spacing.xl }}
        />
      </ScrollView>
    </SafeAreaView>
  );
};
