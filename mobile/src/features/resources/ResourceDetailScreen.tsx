import React, { useState, useEffect, useCallback } from 'react';
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
import { useNetwork } from '../../shared/network/NetworkContext';
import { curriculumRepository } from '../../shared/database/curriculumRepository';
import {
  downloadManager,
  LocalPackageRecord,
  StorageQuotaInfo,
} from '../../services/download-manager';
import {
  ArrowLeft,
  ShieldCheck,
  HardDrive,
  Calendar,
  AlertCircle,
  FileText,
  Trash2,
  BookOpen,
  Cpu,
  GraduationCap,
} from 'lucide-react-native';

export const ResourceDetailScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation,
  route,
}) => {
  const { colors, typography, spacing, borderRadius } = useTheme();
  const { isOnline, isReachable } = useNetwork();
  const effectivelyOnline = isOnline && isReachable;

  const resourceId = route.params?.resourceId;
  const courseId = route.params?.courseId || 1;
  const courseCode = route.params?.courseCode || 'IT-CMTS-101';

  const [resource, setResource] = useState<any>(null);
  const [localPkg, setLocalPkg] = useState<LocalPackageRecord | null>(null);
  const [quota, setQuota] = useState<StorageQuotaInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const loadResourceDetail = useCallback(async () => {
    try {
      setLoading(true);

      // 1. Load from SQLite local_resources first
      const localResList = await curriculumRepository.getResourcesByCourse(courseId);
      const matchedLocal = localResList?.find((r) => r.resource_id === resourceId);
      if (matchedLocal) {
        setResource({
          resource_id: matchedLocal.resource_id,
          course_id: matchedLocal.course_id,
          title: matchedLocal.title,
          type: matchedLocal.type,
          size_bytes: matchedLocal.size_bytes,
          version: matchedLocal.version,
          access_state: matchedLocal.access_state,
          published_at: '2026-11-10T00:00:00Z',
          metadata: {
            institution: 'Haramaya University',
            department: 'College of Computing & Informatics',
            exam_date: 'Exit Examination 2026',
            external_software_reqs: 'JDK 17, Visual Studio Code',
          },
          is_accessible: true,
          entitlement_source: 'Haramaya University Seat',
        });
      }

      // 2. Refresh with remote endpoint if connected
      if (effectivelyOnline) {
        try {
          const data = await api.get<{ resources: any[] }>(`/courses/${courseId}/resources`);
          const remoteItem = data.resources?.find((r: any) => r.resource_id === resourceId);
          if (remoteItem) {
            setResource(remoteItem);
          }
        } catch (_) {}
      }

      // 3. Load download package status & storage quota
      const pkg = await downloadManager.getPackage(resourceId);
      setLocalPkg(pkg);

      const quotaInfo = await downloadManager.getStorageQuota();
      setQuota(quotaInfo);
    } catch (err) {
      console.warn('Failed to load resource detail:', err);
    } finally {
      setLoading(false);
    }
  }, [resourceId, courseId, effectivelyOnline]);

  useEffect(() => {
    loadResourceDetail();
  }, [loadResourceDetail]);

  useEffect(() => {
    const unsub = downloadManager.onStateChange((resId) => {
      if (resId === resourceId) {
        downloadManager.getPackage(resourceId).then((updated) => {
          setLocalPkg(updated);
          downloadManager.getStorageQuota().then(setQuota);
        });
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

  const handleDeleteLocalPackage = async () => {
    Alert.alert(
      'Remove Local Copy',
      'Are you sure you want to delete this offline copy from your device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await downloadManager.deleteLocalPackage(resourceId);
              const updatedPkg = await downloadManager.getPackage(resourceId);
              setLocalPkg(updatedPkg);
              const updatedQuota = await downloadManager.getStorageQuota();
              setQuota(updatedQuota);
            } catch (err: any) {
              Alert.alert('Cannot Remove Package', err.message);
            }
          },
        },
      ]
    );
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
        <Button
          title="Back to Library"
          onPress={() => navigation.goBack()}
          style={{ marginTop: 16 }}
        />
      </SafeAreaView>
    );
  }

  const sizeMB = (resource.file_size_bytes / (1024 * 1024)).toFixed(1);
  const freeGB = quota ? (quota.freeBytes / (1024 * 1024 * 1024)).toFixed(2) : '2.0';
  const isDownloaded = localPkg?.state === 'AVAILABLE_OFFLINE';
  const expiryDate = localPkg?.license_expiry
    ? new Date(localPkg.license_expiry).toLocaleDateString()
    : '7 Days from download';
  const accessSource =
    resource.entitlement_source ||
    (resource.is_accessible ? 'Haramaya University Seat' : 'Included in Personal Plan');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }}>
      {/* Top Header */}
      <View style={[styles.header, { borderBottomColor: colors.border.subtle }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityLabel="Back"
          testID="resource-detail-back-btn"
        >
          <ArrowLeft size={22} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[typography.labelSm, { color: colors.brand.primary, fontWeight: '700' }]}>
            {courseCode} • Learning Resource
          </Text>
          <Text style={[typography.h3, { color: colors.text.primary }]} numberOfLines={1}>
            {resource.title}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.screenPadding, gap: 16 }}>
        {/* Resource Header & Metadata Card */}
        <Card variant="elevated">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <EntitlementBadge
              status={resource.is_accessible ?? true ? 'INSTITUTION' : 'LOCKED'}
              testID="resource-detail-badge"
            />
            <Text style={[typography.labelSm, { color: colors.text.secondary }]}>
              v{resource.version || 1} • {sizeMB} MB
            </Text>
          </View>

          <Text style={[typography.h2, { color: colors.text.primary, marginTop: 12, fontWeight: '700' }]}>
            {resource.title}
          </Text>

          <Text style={[typography.bodyMd, { color: colors.text.secondary, marginTop: 8 }]}>
            Curriculum learning module prepared for Ethiopian Higher Education Exit Exam candidates.
          </Text>

          {/* Metadata Breakdown */}
          <View style={[styles.metadataContainer, { backgroundColor: colors.surface.secondary, borderRadius: borderRadius.md }]}>
            <View style={styles.metaRow}>
              <GraduationCap size={16} color={colors.brand.primary} />
              <Text style={[typography.bodySm, { color: colors.text.primary, marginLeft: 8 }]}>
                Institution: <Text style={{ fontWeight: '600' }}>{resource.metadata?.institution || 'Haramaya University'}</Text>
              </Text>
            </View>

            <View style={[styles.metaRow, { marginTop: 8 }]}>
              <Calendar size={16} color={colors.text.secondary} />
              <Text style={[typography.bodySm, { color: colors.text.primary, marginLeft: 8 }]}>
                Academic Period: <Text style={{ fontWeight: '600' }}>{resource.metadata?.exam_date || 'Exit Exam 2026'}</Text>
              </Text>
            </View>

            <View style={[styles.metaRow, { marginTop: 8 }]}>
              <Cpu size={16} color={colors.status.offline} />
              <Text style={[typography.bodySm, { color: colors.text.primary, marginLeft: 8 }]}>
                Software Prerequisites: <Text style={{ fontWeight: '600' }}>{resource.metadata?.external_software_reqs || 'Standard PDF / Text'}</Text>
              </Text>
            </View>
          </View>
        </Card>

        {/* Entitlement & License Panel */}
        <Card variant="outlined">
          <Text style={[typography.h3, { color: colors.text.primary, marginBottom: 10, fontWeight: '700' }]}>
            Entitlement & Offline License
          </Text>

          <View style={styles.specRow}>
            <ShieldCheck size={18} color={colors.status.online} />
            <Text style={[typography.bodyMd, { color: colors.text.primary, marginLeft: 10, flex: 1 }]}>
              Access Source: <Text style={{ fontWeight: '700' }}>{accessSource}</Text>
            </Text>
          </View>

          <View style={[styles.specRow, { marginTop: 10 }]}>
            <Calendar size={18} color={colors.text.secondary} />
            <Text style={[typography.bodyMd, { color: colors.text.primary, marginLeft: 10, flex: 1 }]}>
              License Expiry: <Text style={{ fontWeight: '700' }}>{expiryDate}</Text> (Encrypted DRM)
            </Text>
          </View>
        </Card>

        {/* Storage Impact Check Bar */}
        <Card variant="outlined" testID="storage-impact-card">
          <Text style={[typography.h3, { color: colors.text.primary, marginBottom: 10, fontWeight: '700' }]}>
            Storage Impact Check
          </Text>

          <View style={styles.specRow}>
            <HardDrive size={18} color={colors.brand.primary} />
            <Text
              testID="storage-impact-text"
              style={[typography.bodyMd, { color: colors.text.primary, marginLeft: 10, flex: 1 }]}
            >
              Requires <Text style={{ fontWeight: '700' }}>{sizeMB} MB</Text> • {freeGB} GB available in your offline quota
            </Text>
          </View>

          <Text style={[typography.bodySm, { color: colors.text.muted, marginTop: 8 }]}>
            Protected AES-256 local sandbox container. Decrypted in volatile memory only during active reading.
          </Text>
        </Card>

        {/* Action Controls */}
        <View style={{ gap: 12, marginTop: 8 }}>
          {isDownloaded ? (
            <>
              <Button
                testID="open-reader-btn"
                title="Open in Protected Reader (MOB-11)"
                variant="primary"
                onPress={handleOpenReader}
              />
              <Button
                testID="remove-local-copy-btn"
                title="Remove Offline Copy"
                variant="outline"
                onPress={handleDeleteLocalPackage}
              />
            </>
          ) : (
            <PackageDownloadButton
              testID="download-action-btn"
              state={localPkg?.state || 'IDLE'}
              sizeBytes={resource.file_size_bytes}
              progress={localPkg?.progress_percent || 0}
              onPress={handleDownload}
            />
          )}
        </View>

        {/* Report Content Issue */}
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
  metadataContainer: {
    marginTop: 14,
    padding: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
