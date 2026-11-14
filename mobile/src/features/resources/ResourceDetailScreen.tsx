import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { useTheme } from '../../shared/theme';
import { Card, Button, EntitlementBadge, PackageDownloadButton } from '../../shared/components';
import { api } from '../../shared/api/client';
import { downloadManager, LocalPackageRecord, StorageQuotaInfo } from '../../services/download-manager';
import {
  ArrowLeft,
  ShieldCheck,
  HardDrive,
  Calendar,
  AlertCircle,
} from 'lucide-react-native';

export const ResourceDetailScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation,
  route,
}) => {
  const { colors, typography, spacing } = useTheme();
  const resourceId = route.params?.resourceId;
  const courseId = route.params?.courseId || 1;

  const [resource, setResource] = useState<any>(null);
  const [localPkg, setLocalPkg] = useState<LocalPackageRecord | null>(null);
  const [quota, setQuota] = useState<StorageQuotaInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDetail() {
      try {
        setLoading(true);
        const data = await api.get<any>(`/courses/${courseId}/resources`);
        const item = data.resources?.find((r: any) => r.resource_id === resourceId);
        setResource(item || null);

        const pkg = await downloadManager.getPackage(resourceId);
        setLocalPkg(pkg);

        const quotaInfo = await downloadManager.getStorageQuota();
        setQuota(quotaInfo);
      } catch (err) {
        console.warn('Failed to load resource detail:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDetail();
  }, [resourceId, courseId]);

  useEffect(() => {
    const unsub = downloadManager.onStateChange((resId) => {
      if (resId === resourceId) {
        downloadManager.getPackage(resourceId).then(setLocalPkg);
      }
    });
    return unsub;
  }, [resourceId]);

  const handleDownload = async () => {
    try {
      await downloadManager.startDownload(resourceId);
    } catch (err: any) {
      Alert.alert('Download Error', err.message || 'Could not initiate package download.');
    }
  };

  const handleOpenReader = () => {
    navigation.navigate('ProtectedContentReader', {
      resourceId,
      title: resource?.title || 'Resource Reader',
      courseId,
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.surface.primary }]}>
        <ActivityIndicator size="large" color={colors.brand.primary} />
        <Text style={[typography.bodyMd, { color: colors.text.secondary, marginTop: 12 }]}>
          Loading resource specification...
        </Text>
      </SafeAreaView>
    );
  }

  if (!resource) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.surface.primary }]}>
        <AlertCircle size={48} color={colors.status.error} />
        <Text style={[typography.h3, { color: colors.text.primary, marginTop: 12 }]}>
          Resource Not Found
        </Text>
        <Button title="Back to Library" onPress={() => navigation.goBack()} style={{ marginTop: 16 }} />
      </SafeAreaView>
    );
  }

  const sizeMB = (resource.file_size_bytes / (1024 * 1024)).toFixed(1);
  const freeGB = quota ? (quota.freeBytes / (1024 * 1024 * 1024)).toFixed(2) : '2.0';
  const isDownloaded = localPkg?.state === 'AVAILABLE_OFFLINE';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }}>
      {/* App Bar */}
      <View style={[styles.header, { borderBottomColor: colors.border.subtle }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityLabel="Back"
        >
          <ArrowLeft size={22} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[typography.h3, { color: colors.text.primary }]} numberOfLines={1}>
            {resource.title}
          </Text>
          <Text style={[typography.bodySm, { color: colors.text.secondary }]}>
            MOB-10 • License & Storage Info
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.screenPadding, gap: 16 }}>
        {/* Resource Header Card */}
        <Card variant="elevated">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <EntitlementBadge
              status={resource.is_accessible ? 'INSTITUTION' : 'LOCKED'}
            />
            <Text style={[typography.labelSm, { color: colors.text.secondary }]}>
              v{resource.version}
            </Text>
          </View>

          <Text style={[typography.h2, { color: colors.text.primary, marginTop: 12 }]}>
            {resource.title}
          </Text>

          <Text style={[typography.bodyMd, { color: colors.text.secondary, marginTop: 8 }]}>
            Format: {resource.type.replace('_', ' ')} • Educational Package for Ethiopian Exit Exam Preparation.
          </Text>
        </Card>

        {/* Storage & DRM Compliance Card */}
        <Card variant="outlined">
          <Text style={[typography.h3, { color: colors.text.primary, marginBottom: 12 }]}>
            Storage Impact & Offline Policy
          </Text>

          <View style={styles.specRow}>
            <HardDrive size={18} color={colors.brand.primary} />
            <Text style={[typography.bodyMd, { color: colors.text.primary, marginLeft: 10, flex: 1 }]}>
              Requires <Text style={{ fontWeight: '700' }}>{sizeMB} MB</Text> • {freeGB} GB free on device
            </Text>
          </View>

          <View style={[styles.specRow, { marginTop: 10 }]}>
            <ShieldCheck size={18} color={colors.status.online} />
            <Text style={[typography.bodyMd, { color: colors.text.primary, marginLeft: 10, flex: 1 }]}>
              AES-256 envelope encrypted with dynamic identity watermark & Android FLAG_SECURE deterrence.
            </Text>
          </View>

          <View style={[styles.specRow, { marginTop: 10 }]}>
            <Calendar size={18} color={colors.text.secondary} />
            <Text style={[typography.bodyMd, { color: colors.text.primary, marginLeft: 10, flex: 1 }]}>
              Offline Grace Period: <Text style={{ fontWeight: '700' }}>7 Days</Text> before cloud re-verification.
            </Text>
          </View>
        </Card>

        {/* Primary CTA */}
        {isDownloaded ? (
          <Button
            title="Open in Protected Content Reader (MOB-11)"
            variant="primary"
            onPress={handleOpenReader}
          />
        ) : (
          <PackageDownloadButton
            state={localPkg?.state || 'IDLE'}
            sizeBytes={resource.file_size_bytes}
            progress={localPkg?.progress_percent || 0}
            onPress={handleDownload}
          />
        )}

        {/* Content Issue Report Action */}
        <TouchableOpacity
          style={styles.reportRow}
          onPress={() =>
            Alert.alert(
              'Report Content Issue',
              'Feedback regarding typos or formatting issues has been flagged for institutional review.'
            )
          }
        >
          <Text style={[typography.labelSm, { color: colors.text.muted }]}>
            Report an issue with this study material
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  specRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reportRow: {
    alignItems: 'center',
    paddingVertical: 16,
  },
});
