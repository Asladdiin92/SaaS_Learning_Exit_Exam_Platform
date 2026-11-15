import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../../shared/theme';
import { useAuthSession } from '../../../services/auth-session/AuthSessionContext';
import { api } from '../../../shared/api/client';
import {
  ArrowLeft,
  ShieldCheck,
  Building2,
  Sparkles,
  HardDrive,
  Download,
  Calendar,
  RefreshCw,
  ShoppingBag,
  Info,
  CheckCircle2,
} from 'lucide-react-native';

export interface EntitlementsData {
  user_id: string;
  tenant_id: string | null;
  offline_download_allowed: boolean;
  storage_quota_mb: number;
  ai_monthly_quota: number;
  offline_grace_days: number;
  offline_grant?: any;
}

export const PlansAndAccessScreen: React.FC = () => {
  const { colors, typography, spacing } = useTheme();
  const navigation = useNavigation<any>();
  const { user, currentWorkspace } = useAuthSession();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [entitlements, setEntitlements] = useState<EntitlementsData | null>(null);

  const loadEntitlements = useCallback(async () => {
    try {
      const data = await api.get<EntitlementsData>('/me/entitlements');
      if (data) {
        setEntitlements(data);
      }
    } catch (err: any) {
      console.warn('Failed to load entitlements from server:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadEntitlements();
  }, [loadEntitlements]);

  const onRefresh = () => {
    setIsRefreshing(true);
    loadEntitlements();
  };

  const isInstitutional = currentWorkspace && !currentWorkspace.isPersonal;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.surface.primary }]}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      testID="plans-and-access-screen"
    >
      {/* Top Nav */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          testID="plans-back-btn"
        >
          <ArrowLeft size={22} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={[typography.h3, { color: colors.text.primary }]}>
          Plans & Effective Access
        </Text>
        <TouchableOpacity onPress={onRefresh} style={styles.backBtn} testID="plans-refresh-btn">
          <RefreshCw size={18} color={colors.brand.primary} />
        </TouchableOpacity>
      </View>

      {/* Effective Access Header Card */}
      <View
        style={[
          styles.card,
          styles.effectiveAccessCard,
          {
            backgroundColor: colors.surface.card,
            borderColor: colors.border.subtle,
          },
        ]}
      >
        <View style={styles.effectiveHeaderRow}>
          <ShieldCheck size={24} color={colors.status.online} />
          <View style={styles.effectiveHeaderText}>
            <Text style={[typography.h2, { color: colors.text.primary }]}>
              Active Entitlements
            </Text>
            <Text style={[typography.labelSm, { color: colors.text.secondary }]}>
              Server-evaluated effective access (ADR-003)
            </Text>
          </View>
        </View>

        <View style={styles.entitlementsGrid}>
          <View style={[styles.entitlementItem, { backgroundColor: colors.surface.secondary }]}>
            <Download size={18} color={colors.brand.primary} />
            <Text style={[typography.h3, { color: colors.text.primary, marginTop: 4 }]}>
              {entitlements?.offline_download_allowed ? 'Active' : 'Restricted'}
            </Text>
            <Text style={[typography.labelSm, { color: colors.text.muted }]}>
              Offline Downloads
            </Text>
          </View>

          <View style={[styles.entitlementItem, { backgroundColor: colors.surface.secondary }]}>
            <HardDrive size={18} color={colors.status.online} />
            <Text style={[typography.h3, { color: colors.text.primary, marginTop: 4 }]}>
              {entitlements?.storage_quota_mb || 2048} MB
            </Text>
            <Text style={[typography.labelSm, { color: colors.text.muted }]}>
              Protected Storage
            </Text>
          </View>

          <View style={[styles.entitlementItem, { backgroundColor: colors.surface.secondary }]}>
            <Sparkles size={18} color="#D946EF" />
            <Text style={[typography.h3, { color: colors.text.primary, marginTop: 4 }]}>
              {entitlements?.ai_monthly_quota || 50}/mo
            </Text>
            <Text style={[typography.labelSm, { color: colors.text.muted }]}>
              AI Tutor Queries
            </Text>
          </View>

          <View style={[styles.entitlementItem, { backgroundColor: colors.surface.secondary }]}>
            <Calendar size={18} color="#F59E0B" />
            <Text style={[typography.h3, { color: colors.text.primary, marginTop: 4 }]}>
              {entitlements?.offline_grace_days || 7} Days
            </Text>
            <Text style={[typography.labelSm, { color: colors.text.muted }]}>
              Offline Grace
            </Text>
          </View>
        </View>
      </View>

      {/* Section A: Institutional License Seat */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <Building2 size={18} color={colors.brand.primary} />
          <Text style={[typography.h3, { color: colors.text.primary, marginLeft: 8 }]}>
            Institutional License Seat
          </Text>
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface.card,
              borderColor: isInstitutional ? colors.status.online : colors.border.subtle,
            },
          ]}
        >
          {isInstitutional ? (
            <>
              <View style={styles.seatHeader}>
                <View>
                  <Text style={[typography.h3, { color: colors.text.primary }]}>
                    {currentWorkspace?.organizationName}
                  </Text>
                  <Text style={[typography.bodySm, { color: colors.text.secondary }]}>
                    Cohort: B.Sc. IT Exit Exam Candidates 2026
                  </Text>
                </View>
                <View style={[styles.activeBadge, { backgroundColor: '#DCFCE7' }]}>
                  <Text style={[typography.labelSm, { color: '#15803D', fontWeight: '700' }]}>
                    ACTIVE SEAT
                  </Text>
                </View>
              </View>

              <View style={styles.seatFeatures}>
                <View style={styles.featureRow}>
                  <CheckCircle2 size={14} color={colors.status.online} />
                  <Text style={[typography.labelSm, { color: colors.text.secondary, marginLeft: 6 }]}>
                    Full access to all 15 B.Sc. IT Courses & Model Exams
                  </Text>
                </View>
                <View style={styles.featureRow}>
                  <CheckCircle2 size={14} color={colors.status.online} />
                  <Text style={[typography.labelSm, { color: colors.text.secondary, marginLeft: 6 }]}>
                    Sponsor-verified university exit trial simulations
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.noInstitutionView}>
              <Text style={[typography.bodyMd, { color: colors.text.secondary }]}>
                You are currently in your Personal Workspace.
              </Text>
              <Text style={[typography.labelSm, { color: colors.text.muted, marginTop: 4, marginBottom: 12 }]}>
                Switch to an institutional workspace to access university-sponsored seats.
              </Text>
              <TouchableOpacity
                style={[styles.outlineBtn, { borderColor: colors.brand.primary }]}
                onPress={() => navigation.navigate('WorkspaceSelection')}
              >
                <Text style={[typography.labelSm, { color: colors.brand.primary, fontWeight: '700' }]}>
                  Switch Workspace
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Section B: Personal Subscriptions & Bundles */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <ShoppingBag size={18} color={colors.brand.primary} />
          <Text style={[typography.h3, { color: colors.text.primary, marginLeft: 8 }]}>
            Personal Subscriptions & Bundles
          </Text>
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface.card,
              borderColor: colors.border.subtle,
            },
          ]}
        >
          <View style={styles.seatHeader}>
            <View>
              <Text style={[typography.h3, { color: colors.text.primary }]}>
                Personal Study Access
              </Text>
              <Text style={[typography.bodySm, { color: colors.text.secondary }]}>
                Self-funded preparation & one-time exam packages
              </Text>
            </View>
            <View style={[styles.activeBadge, { backgroundColor: colors.surface.secondary }]}>
              <Text style={[typography.labelSm, { color: colors.brand.primary, fontWeight: '700' }]}>
                PERSONAL
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryCTA, { backgroundColor: colors.brand.primary, marginTop: 14 }]}
            onPress={() => navigation.navigate('StoreCatalog')}
            activeOpacity={0.8}
            testID="browse-store-btn"
          >
            <ShoppingBag size={18} color="#FFFFFF" />
            <Text style={[typography.h3, { color: '#FFFFFF', marginLeft: 8 }]}>
              Browse Store & Exam Bundles
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Multi-Tenancy Invariant Notice */}
      <View style={[styles.noticeCard, { backgroundColor: colors.surface.secondary }]}>
        <Info size={16} color={colors.text.muted} />
        <Text style={[typography.labelSm, { color: colors.text.muted, marginLeft: 8, flex: 1 }]}>
          Personal plan expiry never revokes an active institutional seat, and institutional seat
          expiry never deletes personal purchases or historical attempts.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    minHeight: 48,
  },
  backBtn: {
    padding: 6,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  effectiveAccessCard: {
    borderWidth: 1.5,
  },
  effectiveHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  effectiveHeaderText: {
    marginLeft: 10,
    flex: 1,
  },
  entitlementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  entitlementItem: {
    width: '48%',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    alignItems: 'center',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  seatHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  activeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  seatFeatures: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 3,
  },
  noInstitutionView: {
    alignItems: 'flex-start',
  },
  outlineBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    minHeight: 40,
    justifyContent: 'center',
  },
  primaryCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 12,
    minHeight: 48,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
});
