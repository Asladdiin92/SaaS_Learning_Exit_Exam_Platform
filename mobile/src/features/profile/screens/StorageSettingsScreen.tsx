import React, { useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { useTheme } from '../../../shared/theme';
import { Card, Button } from '../../../shared/components';
import {
  ArrowLeft,
  HardDrive,
  Wifi,
  ShieldCheck,
  Trash2,
  Lock,
  FileCheck,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react-native';

interface StorageSettingsScreenProps {
  navigation: any;
}

type StorageQuota = '500MB' | '2GB' | 'UNLIMITED';

interface CachedPackage {
  id: string;
  title: string;
  type: 'COURSE_PACKAGE' | 'EXAM_PACKAGE' | 'NOTE';
  sizeMb: number;
  isLocked: boolean;
  expiryDate?: string;
}

export const StorageSettingsScreen: React.FC<StorageSettingsScreenProps> = ({ navigation }) => {
  const { colors, typography, spacing, borderRadius } = useTheme();

  const [quota, setQuota] = useState<StorageQuota>('2GB');
  const [wifiOnly, setWifiOnly] = useState<boolean>(true);
  const [packages, setPackages] = useState<CachedPackage[]>([
    {
      id: 'pkg-hu-exam-2023',
      title: 'HU CCI B.Sc. IT Model Exit Exam (Jan 2023)',
      type: 'EXAM_PACKAGE',
      sizeMb: 14.2,
      isLocked: true, // Referenced by active or provisional attempt
      expiryDate: '2026-12-31',
    },
    {
      id: 'pkg-cmts-notes',
      title: 'IT-CMTS-101 Hardware Diagnostics & Maintenance Notes',
      type: 'COURSE_PACKAGE',
      sizeMb: 48.6,
      isLocked: false,
      expiryDate: '2026-12-31',
    },
    {
      id: 'pkg-dsa-curriculum',
      title: 'IT-DSA-201 Data Structures & Algorithms Lab Guide',
      type: 'COURSE_PACKAGE',
      sizeMb: 36.4,
      isLocked: false,
      expiryDate: '2026-12-31',
    },
    {
      id: 'pkg-net-sec',
      title: 'IT-NET-301 Computer Networking & Subnetting Archive',
      type: 'COURSE_PACKAGE',
      sizeMb: 28.1,
      isLocked: false,
      expiryDate: '2026-12-31',
    },
  ]);

  // Storage breakdown calculations
  const lockedExamDataMb = 2.4; // Protected answer events & unsubmitted attempts
  const downloadedPackagesMb = packages.reduce((acc, p) => acc + p.sizeMb, 0);
  const temporaryCacheMb = 18.5;
  const totalUsedMb = lockedExamDataMb + downloadedPackagesMb + temporaryCacheMb;
  const maxQuotaMb = quota === '500MB' ? 500 : quota === '2GB' ? 2048 : 4096;
  const freeQuotaMb = Math.max(0, maxQuotaMb - totalUsedMb);

  const lockedPercent = Math.min(100, (lockedExamDataMb / maxQuotaMb) * 100);
  const packagesPercent = Math.min(100, (downloadedPackagesMb / maxQuotaMb) * 100);
  const tempCachePercent = Math.min(100, (temporaryCacheMb / maxQuotaMb) * 100);

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will remove temporary images and expired re-downloadable documents. Your downloaded study packages and all unsynced exam answers are protected and will NOT be touched.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Cache Cleared', '18.5 MB of temporary cache freed successfully.');
          },
        },
      ]
    );
  };

  const handleRemovePackage = (pkg: CachedPackage) => {
    if (pkg.isLocked) {
      Alert.alert(
        'Package Protected',
        'This assessment package cannot be deleted because it is tied to an active or provisional exam attempt awaiting server synchronization.'
      );
      return;
    }

    Alert.alert(
      'Remove Local Copy',
      `Delete "${pkg.title}" (${pkg.sizeMb} MB) from device storage? You can re-download it anytime while your entitlement is active.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setPackages((prev) => prev.filter((p) => p.id !== pkg.id));
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.screenPadding,
          paddingVertical: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border.default,
        }}
      >
        <TouchableOpacity
          testID="storage-back-btn"
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back to Profile"
          style={{
            minHeight: 48,
            minWidth: 48,
            justifyContent: 'center',
            alignItems: 'flex-start',
            marginRight: spacing.xs,
          }}
        >
          <ArrowLeft size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View>
          <Text style={[typography.h2, { color: colors.text.primary, fontWeight: '700' }]}>
            Storage & Cache
          </Text>
          <Text style={[typography.labelSm, { color: colors.text.secondary }]}>
            MOB-27 • Offline Memory & LRU Guard
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.screenPadding }}>
        {/* Storage Meter Card */}
        <Card variant="elevated" style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <HardDrive size={18} color={colors.brand.primary} />
              <Text style={[typography.h3, { color: colors.text.primary, fontWeight: '700' }]}>
                Device Storage Meter
              </Text>
            </View>
            <Text style={[typography.labelSm, { color: colors.text.secondary, fontWeight: '700' }]}>
              {totalUsedMb.toFixed(1)} MB of {quota}
            </Text>
          </View>

          {/* Segmented Progress Bar */}
          <View
            style={{
              height: 12,
              backgroundColor: '#E2E8F0',
              borderRadius: 6,
              flexDirection: 'row',
              overflow: 'hidden',
              marginVertical: spacing.sm,
            }}
          >
            {/* Locked Exam Queue */}
            <View style={{ width: `${Math.max(2, lockedPercent)}%`, backgroundColor: '#F59E0B' }} />
            {/* Downloaded Packages */}
            <View style={{ width: `${packagesPercent}%`, backgroundColor: colors.brand.primary }} />
            {/* Temporary Media Cache */}
            <View style={{ width: `${tempCachePercent}%`, backgroundColor: '#06B6D4' }} />
          </View>

          {/* Meter Legend */}
          <View style={{ gap: 6, marginTop: spacing.xs }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#F59E0B' }} />
                <Text style={[typography.bodySm, { color: colors.text.primary }]}>
                  Protected Unsynced Exam Data (Locked)
                </Text>
              </View>
              <Text style={[typography.labelSm, { color: colors.text.secondary, fontWeight: '600' }]}>
                {lockedExamDataMb.toFixed(1)} MB
              </Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand.primary }} />
                <Text style={[typography.bodySm, { color: colors.text.primary }]}>
                  Course & Exam Packages
                </Text>
              </View>
              <Text style={[typography.labelSm, { color: colors.text.secondary, fontWeight: '600' }]}>
                {downloadedPackagesMb.toFixed(1)} MB
              </Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#06B6D4' }} />
                <Text style={[typography.bodySm, { color: colors.text.primary }]}>
                  Temporary Cache & Manifests
                </Text>
              </View>
              <Text style={[typography.labelSm, { color: colors.text.secondary, fontWeight: '600' }]}>
                {temporaryCacheMb.toFixed(1)} MB
              </Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#E2E8F0' }} />
                <Text style={[typography.bodySm, { color: colors.text.muted }]}>
                  Available Quota
                </Text>
              </View>
              <Text style={[typography.labelSm, { color: colors.text.muted, fontWeight: '600' }]}>
                {freeQuotaMb.toFixed(1)} MB
              </Text>
            </View>
          </View>
        </Card>

        {/* Quota Radio Selector */}
        <Card variant="outlined" style={{ marginBottom: spacing.md }}>
          <Text style={[typography.h3, { color: colors.text.primary, fontWeight: '700', marginBottom: spacing.xs }]}>
            Storage Quota Limit
          </Text>
          <Text style={[typography.bodySm, { color: colors.text.secondary, marginBottom: spacing.sm }]}>
            Maximum device storage allocated for offline course materials.
          </Text>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['500MB', '2GB', 'UNLIMITED'] as StorageQuota[]).map((opt) => {
              const isSelected = quota === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  testID={`quota-opt-${opt}`}
                  onPress={() => setQuota(opt)}
                  style={{
                    flex: 1,
                    paddingVertical: spacing.sm,
                    borderRadius: borderRadius.md,
                    borderWidth: 1.5,
                    borderColor: isSelected ? colors.brand.primary : colors.border.default,
                    backgroundColor: isSelected ? '#EFF6FF' : colors.surface.primary,
                    alignItems: 'center',
                    minHeight: 48,
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={[
                      typography.labelSm,
                      {
                        color: isSelected ? colors.brand.primary : colors.text.primary,
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                  >
                    {opt === 'UNLIMITED' ? 'Unlimited' : opt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {/* Wi-Fi Only Preference */}
        <Card variant="outlined" style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: spacing.sm }}>
              <Wifi size={20} color={colors.brand.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[typography.h3, { color: colors.text.primary, fontWeight: '600' }]}>
                  Wi-Fi Only Downloads
                </Text>
                <Text style={[typography.bodySm, { color: colors.text.secondary }]}>
                  Prevents cellular data usage for course packages & exam bundles
                </Text>
              </View>
            </View>
            <Switch
              testID="wifi-only-switch"
              value={wifiOnly}
              onValueChange={setWifiOnly}
              trackColor={{ false: '#CBD5E1', true: colors.brand.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </Card>

        {/* Hard Guardrail Note & Cache Clear */}
        <Card
          variant="outlined"
          style={{
            marginBottom: spacing.md,
            backgroundColor: '#FEF3C7',
            borderColor: '#FDE68A',
          }}
        >
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: spacing.xs }}>
            <ShieldCheck size={20} color="#D97706" />
            <Text style={[typography.labelSm, { color: '#92400E', fontWeight: '700', flex: 1 }]}>
              ZERO SILENT DATA LOSS HARD GUARDRAIL
            </Text>
          </View>
          <Text style={[typography.bodySm, { color: '#78350F', lineHeight: 20, marginBottom: spacing.sm }]}>
            LRU eviction and manual cache maintenance will NEVER delete local exam attempts,
            unscored answer events, or pending sync operations.
          </Text>
          <Button
            testID="clear-cache-btn"
            title="Clear Expired & Temporary Cache (18.5 MB)"
            variant="outline"
            leftIcon={<Trash2 size={16} color={colors.status.offline} />}
            onPress={handleClearCache}
            style={{ borderColor: '#F59E0B' }}
          />
        </Card>

        {/* Downloaded Packages Management */}
        <View style={{ marginBottom: spacing.xl }}>
          <Text style={[typography.h3, { color: colors.text.primary, fontWeight: '700', marginBottom: spacing.xs }]}>
            Offline Packages on Device ({packages.length})
          </Text>
          <Text style={[typography.bodySm, { color: colors.text.secondary, marginBottom: spacing.sm }]}>
            Manage encrypted AES-256 local course manuscripts and model exams.
          </Text>

          {packages.map((pkg) => (
            <Card
              key={pkg.id}
              testID={`package-row-${pkg.id}`}
              variant="outlined"
              style={{ marginBottom: spacing.xs, padding: spacing.sm }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1, paddingRight: spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    {pkg.isLocked ? (
                      <Lock size={14} color="#F59E0B" />
                    ) : (
                      <FileCheck size={14} color={colors.brand.primary} />
                    )}
                    <Text
                      style={[
                        typography.labelSm,
                        {
                          color: pkg.isLocked ? '#D97706' : colors.brand.primary,
                          fontWeight: '700',
                        },
                      ]}
                    >
                      {pkg.isLocked ? 'PROTECTED (UNSYNCED ATTEMPT)' : 'AVAILABLE OFFLINE'}
                    </Text>
                  </View>
                  <Text style={[typography.bodyMd, { color: colors.text.primary, fontWeight: '600' }]}>
                    {pkg.title}
                  </Text>
                  <Text style={[typography.labelSm, { color: colors.text.muted, marginTop: 2 }]}>
                    {pkg.sizeMb} MB • Valid through {pkg.expiryDate}
                  </Text>
                </View>

                <TouchableOpacity
                  testID={`delete-pkg-${pkg.id}`}
                  onPress={() => handleRemovePackage(pkg)}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${pkg.title}`}
                  style={{
                    minHeight: 48,
                    minWidth: 48,
                    justifyContent: 'center',
                    alignItems: 'center',
                    opacity: pkg.isLocked ? 0.35 : 1,
                  }}
                >
                  <Trash2 size={18} color={pkg.isLocked ? colors.text.muted : colors.status.offline} />
                </TouchableOpacity>
              </View>
            </Card>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
