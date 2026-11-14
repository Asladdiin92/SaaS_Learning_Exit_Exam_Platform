import React, { useState, useEffect, useCallback } from 'react';
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
import { Card, TextInput, PackageDownloadButton } from '../../shared/components';
import { api } from '../../shared/api/client';
import { downloadManager, DownloadState, LocalPackageRecord } from '../../services/download-manager';
import {
  BookOpen,
  FileText,
  FileCode,
  GraduationCap,
  Search,
  ArrowLeft,
} from 'lucide-react-native';

const RESOURCE_TYPES = [
  { label: 'All', value: 'ALL' },
  { label: 'Past Exams', value: 'PAST_EXAM' },
  { label: 'Lecture Notes', value: 'LECTURE_NOTE' },
  { label: 'Lab Guides', value: 'LAB_CONTENT' },
  { label: 'References', value: 'REFERENCE_BOOK' },
];

export const ResourceLibraryScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation,
  route,
}) => {
  const { colors, typography, spacing } = useTheme();
  const courseId = route.params?.courseId || 1;
  const courseTitle = route.params?.courseTitle || 'Course Resources';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [resources, setResources] = useState<any[]>([]);
  const [packageStates, setPackageStates] = useState<Record<string, LocalPackageRecord>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchResources = useCallback(async () => {
    try {
      setLoading(true);
      const url =
        selectedType === 'ALL'
          ? `/courses/${courseId}/resources`
          : `/courses/${courseId}/resources?type=${selectedType}`;
      const data = await api.get<any>(url);
      setResources(data.resources || []);

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
  }, [courseId, selectedType]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

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

  const handleDownloadOrOpen = async (item: any) => {
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

  const getFormatIcon = (type: string) => {
    switch (type) {
      case 'PAST_EXAM':
        return <GraduationCap size={20} color={colors.brand.primary} />;
      case 'LAB_CONTENT':
        return <FileCode size={20} color={colors.status.offline} />;
      case 'REFERENCE_BOOK':
        return <BookOpen size={20} color={colors.text.secondary} />;
      default:
        return <FileText size={20} color={colors.brand.primaryDark} />;
    }
  };

  const filteredResources = resources.filter((r) =>
    r.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border.subtle }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityLabel="Back to course"
        >
          <ArrowLeft size={22} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[typography.h1, { color: colors.text.primary }]} numberOfLines={1}>
            {courseTitle}
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
          placeholder="Search lecture notes, past exams..."
          value={searchQuery}
          onChangeText={setSearchQuery}
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
                    { color: isSelected ? '#FFFFFF' : colors.text.secondary },
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
                fetchResources();
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
                No learning packages match your current filter.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const localPkg = packageStates[item.resource_id];
            const state: DownloadState = localPkg?.state || 'IDLE';
            const progress = localPkg?.progress_percent || 0;
            const sizeMB = (item.file_size_bytes / (1024 * 1024)).toFixed(1);

            return (
              <Card
                variant="outlined"
                onPress={() =>
                  navigation.navigate('ResourceDetail', {
                    resourceId: item.resource_id,
                    courseId,
                  })
                }
              >
                <View style={styles.resourceRow}>
                  <View
                    style={[
                      styles.iconContainer,
                      { backgroundColor: colors.surface.secondary },
                    ]}
                  >
                    {getFormatIcon(item.type)}
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text
                      style={[
                        typography.h3,
                        { color: colors.text.primary, fontWeight: '700' },
                      ]}
                      numberOfLines={2}
                    >
                      {item.title}
                    </Text>
                    <Text
                      style={[
                        typography.bodySm,
                        { color: colors.text.secondary, marginTop: 2 },
                      ]}
                    >
                      {item.type.replace('_', ' ')} • {sizeMB} MB • v{item.version}
                    </Text>
                  </View>
                </View>

                <View style={styles.actionRow}>
                  <PackageDownloadButton
                    state={state}
                    sizeBytes={item.file_size_bytes}
                    progress={progress}
                    onPress={() => handleDownloadOrOpen(item)}
                  />
                </View>
              </Card>
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
  resourceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRow: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
});
