import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useTheme } from '../../shared/theme';
import { TextInput, ResourceCard, ResourceItemData } from '../../shared/components';
import { api } from '../../shared/api/client';
import { useNetwork } from '../../shared/network/NetworkContext';
import { curriculumRepository } from '../../shared/database/curriculumRepository';
import {
  downloadManager,
  DownloadState,
  LocalPackageRecord,
} from '../../services/download-manager';
import { ArrowLeft, FileText } from 'lucide-react-native';

export const RESOURCE_TYPES = [
  { label: 'All', value: 'ALL' },
  { label: 'Lecture Notes', value: 'LECTURE_NOTE' },
  { label: 'Past Exams', value: 'PAST_EXAM' },
  { label: 'Reference Books', value: 'REFERENCE_BOOK' },
  { label: 'Lab Content', value: 'LAB_CONTENT' },
  { label: 'Project Specs', value: 'PROJECT_SPEC' },
  { label: 'External Links', value: 'EXTERNAL_URL' },
];

export const ResourceLibraryScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation,
  route,
}) => {
  const { colors, typography, spacing } = useTheme();
  const { isOnline, isReachable } = useNetwork();
  const effectivelyOnline = isOnline && isReachable;

  const courseId = route.params?.courseId || 1;
  const courseCode = route.params?.courseCode || 'IT-CMTS-101';
  const courseTitle = route.params?.courseTitle || 'Computer Maintenance & Technical Support';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [resources, setResources] = useState<ResourceItemData[]>([]);
  const [packageStates, setPackageStates] = useState<Record<string, LocalPackageRecord>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 1. Fetch Resources from Local SQLite First (<16ms), then sync with API if online
  const loadResources = useCallback(async () => {
    try {
      setLoading(true);

      // Instant Local SQLite Load
      const localResList = await curriculumRepository.getResourcesByCourse(courseId);
      if (localResList && localResList.length > 0) {
        setResources(
          localResList.map((r) => ({
            resource_id: r.resource_id,
            course_id: r.course_id,
            tenant_id: r.tenant_id,
            type: r.type,
            title: r.title,
            size_bytes: r.size_bytes,
            version: r.version,
            access_state: r.access_state,
            is_accessible: true,
            metadata: {
              institution: 'Haramaya University',
              department: 'College of Computing & Informatics',
            },
          }))
        );
      }

      // Sync with remote API if connected
      if (effectivelyOnline) {
        const queryParam = selectedType === 'ALL' ? '' : `?type=${selectedType}`;
        const data = await api.get<{ resources: any[] }>(
          `/courses/${courseId}/resources${queryParam}`
        );
        if (data && data.resources) {
          setResources(data.resources);
        }
      }

      // Load package records from DownloadManager
      const allPkgs = await downloadManager.listAllPackages();
      const stateMap: Record<string, LocalPackageRecord> = {};
      allPkgs.forEach((pkg) => {
        stateMap[pkg.resource_id] = pkg;
      });
      setPackageStates(stateMap);
    } catch (err) {
      console.warn('Failed to load resources:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [courseId, selectedType, effectivelyOnline]);

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  // 2. Real-time Download State and Progress Listeners
  useEffect(() => {
    const unsubState = downloadManager.onStateChange((resId, state) => {
      setPackageStates((prev) => ({
        ...prev,
        [resId]: {
          ...(prev[resId] || {
            package_id: '',
            resource_id: resId,
            version: 1,
            encrypted_path: '',
            sha256_checksum: null,
            size_bytes: 0,
            grant_id: null,
            license_expiry: null,
            last_opened_at: null,
          }),
          state,
        },
      }));
    });

    const unsubProgress = downloadManager.onProgress((resId, progress) => {
      setPackageStates((prev) => ({
        ...prev,
        [resId]: {
          ...(prev[resId] || {
            package_id: '',
            resource_id: resId,
            version: 1,
            encrypted_path: '',
            sha256_checksum: null,
            size_bytes: 0,
            grant_id: null,
            license_expiry: null,
            last_opened_at: null,
            state: 'DOWNLOADING',
          }),
          progress_percent: progress,
        },
      }));
    });

    return () => {
      unsubState();
      unsubProgress();
    };
  }, []);

  // 3. User Actions
  const handleDownloadOrOpen = async (item: ResourceItemData) => {
    const localPkg = packageStates[item.resource_id];
    if (localPkg?.state === 'AVAILABLE_OFFLINE') {
      navigation.navigate('ProtectedContentReader', {
        resourceId: item.resource_id,
        title: item.title,
        courseId,
      });
      return;
    }

    try {
      await downloadManager.startDownload(item.resource_id);
    } catch (err: any) {
      alert(`Download failed: ${err.message}`);
    }
  };

  const handleQueueForLater = async (item: ResourceItemData) => {
    try {
      await downloadManager.queueDownload(item.resource_id);
    } catch (err: any) {
      alert(`Could not queue download: ${err.message}`);
    }
  };

  // 4. Filtering by search query & resource type
  const filteredResources = useMemo(() => {
    return resources.filter((r) => {
      const matchesSearch =
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.metadata?.author && r.metadata.author.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesType = selectedType === 'ALL' || r.type === selectedType;
      return matchesSearch && matchesType;
    });
  }, [resources, searchQuery, selectedType]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }}>
      {/* Top App Header */}
      <View style={[styles.header, { borderBottomColor: colors.border.subtle }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityLabel="Back to course"
          testID="resource-library-back-btn"
        >
          <ArrowLeft size={22} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[typography.h3, { color: colors.text.primary }]} numberOfLines={1}>
            {courseCode}: {courseTitle}
          </Text>
          <Text style={[typography.bodySm, { color: colors.text.secondary }]}>
            MOB-09 • Resource Library
          </Text>
        </View>
      </View>

      {/* Search Input */}
      <View style={{ paddingHorizontal: spacing.screenPadding, marginTop: 12 }}>
        <TextInput
          label="Search Resources"
          placeholder="Search lecture notes, past exams, lab guides..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          testID="resource-search-input"
        />
      </View>

      {/* Horizontal Filter Chips */}
      <View style={{ marginVertical: 8 }}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={RESOURCE_TYPES}
          keyExtractor={(item) => item.value}
          contentContainerStyle={{ paddingHorizontal: spacing.screenPadding, gap: 8 }}
          renderItem={({ item }) => {
            const isSelected = selectedType === item.value;
            return (
              <TouchableOpacity
                testID={`filter-chip-${item.value}`}
                onPress={() => setSelectedType(item.value)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isSelected ? colors.brand.primary : colors.surface.secondary,
                    borderColor: isSelected ? colors.brand.primary : colors.border.subtle,
                  },
                ]}
              >
                <Text
                  style={[
                    typography.labelSm,
                    {
                      color: isSelected ? '#FFFFFF' : colors.text.secondary,
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Resource List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
          <Text style={[typography.bodyMd, { color: colors.text.secondary, marginTop: 12 }]}>
            Loading course resources...
          </Text>
        </View>
      ) : (
        <FlatList
          testID="resource-list"
          data={filteredResources}
          keyExtractor={(item) => item.resource_id}
          contentContainerStyle={{
            paddingHorizontal: spacing.screenPadding,
            paddingBottom: 24,
            gap: 12,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadResources();
              }}
            />
          }
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <FileText size={48} color={colors.text.muted} />
              <Text
                style={[
                  typography.h3,
                  { color: colors.text.primary, marginTop: 12, textAlign: 'center' },
                ]}
              >
                No resources found
              </Text>
              <Text
                style={[
                  typography.bodySm,
                  { color: colors.text.secondary, textAlign: 'center', marginTop: 4 },
                ]}
              >
                No learning packages match your search or filter.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const localPkg = packageStates[item.resource_id];
            const state: DownloadState = localPkg?.state || 'IDLE';
            const progress = localPkg?.progress_percent || 0;

            return (
              <ResourceCard
                testID={`resource-item-${item.resource_id}`}
                resource={item}
                packageRecord={localPkg}
                packageState={state}
                progress={progress}
                isOnline={effectivelyOnline}
                onPress={() =>
                  navigation.navigate('ResourceDetail', {
                    resourceId: item.resource_id,
                    courseId,
                    courseCode,
                    courseTitle,
                  })
                }
                onDownloadOrOpen={() => handleDownloadOrOpen(item)}
                onQueueForLater={() => handleQueueForLater(item)}
              />
            );
          }}
        />
      )}
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
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: 'center',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
});
