import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme';
import { Card } from './Card';
import { EntitlementBadge } from './EntitlementBadge';
import { PackageDownloadButton } from './PackageDownloadButton';
import { DownloadState, LocalPackageRecord } from '../../services/download-manager/types';
import {
  FileText,
  BookOpen,
  FileCode,
  GraduationCap,
  FileCheck,
  Video,
  ExternalLink,
  Clock,
  WifiOff,
} from 'lucide-react-native';

export interface ResourceItemData {
  resource_id: string;
  course_id?: number;
  tenant_id?: string | null;
  type: string;
  title: string;
  size_bytes: number;
  version?: number;
  access_state?: string;
  metadata?: {
    department?: string;
    author?: string;
    institution?: string;
    academic_term?: string;
    software_requirements?: string;
    [key: string]: any;
  } | null;
  is_accessible?: boolean;
}

interface ResourceCardProps {
  resource: ResourceItemData;
  packageRecord?: LocalPackageRecord | null;
  packageState?: DownloadState;
  progress?: number;
  isOnline?: boolean;
  onPress: () => void;
  onDownloadOrOpen: () => void;
  onQueueForLater?: () => void;
  testID?: string;
}

export const ResourceCard: React.FC<ResourceCardProps> = ({
  resource,
  packageRecord,
  packageState = 'IDLE',
  progress = 0,
  isOnline = true,
  onPress,
  onDownloadOrOpen,
  onQueueForLater,
  testID = `resource-card-${resource.resource_id}`,
}) => {
  const { colors, typography, spacing, borderRadius } = useTheme();

  const sizeMB = (resource.size_bytes / (1024 * 1024)).toFixed(1);
  const version = resource.version || 1;
  const isAvailableOffline = packageState === 'AVAILABLE_OFFLINE';

  const metadataTag =
    resource.metadata?.department ||
    resource.metadata?.author ||
    resource.metadata?.institution ||
    'Haramaya University';

  // Format Icon Resolution
  const getFormatIcon = (type: string) => {
    switch (type) {
      case 'PAST_EXAM':
        return <GraduationCap size={22} color={colors.brand.primary} />;
      case 'LAB_CONTENT':
        return <FileCode size={22} color="#D97706" />;
      case 'REFERENCE_BOOK':
        return <BookOpen size={22} color="#4F46E5" />;
      case 'PROJECT_SPEC':
        return <FileCheck size={22} color="#0D9488" />;
      case 'VIDEO':
        return <Video size={22} color="#9333EA" />;
      case 'EXTERNAL_URL':
        return <ExternalLink size={22} color="#059669" />;
      case 'LECTURE_NOTE':
      default:
        return <FileText size={22} color={colors.status.error} />;
    }
  };

  const getFormatLabel = (type: string) => {
    switch (type) {
      case 'PAST_EXAM':
        return 'Past Exam (PDF)';
      case 'LAB_CONTENT':
        return 'Lab Guide';
      case 'REFERENCE_BOOK':
        return 'Reference Book';
      case 'PROJECT_SPEC':
        return 'Project Spec';
      case 'VIDEO':
        return 'Video Lecture';
      case 'EXTERNAL_URL':
        return 'External Link';
      case 'LECTURE_NOTE':
      default:
        return 'Lecture Note (PDF)';
    }
  };

  return (
    <Card testID={testID} variant="outlined" onPress={onPress} style={{ padding: spacing.md }}>
      <View style={styles.topRow}>
        <View
          style={[
            styles.iconBox,
            { backgroundColor: colors.surface.secondary, borderRadius: borderRadius.md },
          ]}
        >
          {getFormatIcon(resource.type)}
        </View>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={styles.badgeRow}>
            <Text
              style={[
                typography.labelSm,
                { color: colors.brand.primary, fontWeight: '700', marginRight: 8 },
              ]}
              numberOfLines={1}
            >
              {metadataTag}
            </Text>
            <EntitlementBadge
              status={resource.is_accessible ?? true ? 'INSTITUTION' : 'LOCKED'}
              testID={`${testID}-entitlement`}
            />
          </View>

          <Text
            style={[
              typography.h3,
              { color: colors.text.primary, fontWeight: '700', marginTop: 4 },
            ]}
            numberOfLines={2}
          >
            {resource.title}
          </Text>

          <Text style={[typography.bodySm, { color: colors.text.secondary, marginTop: 4 }]}>
            {getFormatLabel(resource.type)} • {sizeMB} MB • v{version}
          </Text>
        </View>
      </View>

      {/* Action / State Row */}
      <View style={[styles.actionRow, { borderTopColor: colors.border.subtle }]}>
        {!isOnline && !isAvailableOffline ? (
          // Offline Uncached State: Muted alert with Queue for Later
          <View style={styles.offlinePrompt}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <WifiOff size={16} color={colors.status.offline} />
              <Text
                style={[
                  typography.labelSm,
                  { color: colors.text.secondary, marginLeft: 6, flex: 1 },
                ]}
              >
                Not downloaded — Connect to download ({sizeMB} MB)
              </Text>
            </View>

            {packageState === 'QUEUED' || packageState === 'QUEUED_WAITING_FOR_WIFI' ? (
              <View style={[styles.queuePill, { backgroundColor: colors.surface.secondary }]}>
                <Clock size={14} color={colors.brand.primary} />
                <Text
                  style={[
                    typography.labelSm,
                    { color: colors.brand.primary, marginLeft: 4, fontWeight: '600' },
                  ]}
                >
                  Queued
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                testID={`${testID}-queue-btn`}
                onPress={onQueueForLater}
                style={[styles.queueButton, { borderColor: colors.brand.primary }]}
              >
                <Text
                  style={[
                    typography.labelSm,
                    { color: colors.brand.primary, fontWeight: '700' },
                  ]}
                >
                  Queue for Later
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <PackageDownloadButton
            state={packageState}
            sizeBytes={resource.size_bytes}
            progress={progress}
            onPress={onDownloadOrOpen}
            testID={`${testID}-download-btn`}
          />
        )}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconBox: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionRow: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  offlinePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  queueButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  queuePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
});
