import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useTheme } from '../../shared/theme';
import { Button, Card, EntitlementBadge } from '../../shared/components';
import { useAuthSession, WorkspaceContext } from '../../services/auth-session/AuthSessionContext';
import { Building2, User, CheckCircle2, Circle, Wifi } from 'lucide-react-native';

interface WorkspaceSelectionScreenProps {
  navigation: any;
}

export const WorkspaceSelectionScreen: React.FC<WorkspaceSelectionScreenProps> = ({
  navigation,
}) => {
  const { colors, typography, spacing } = useTheme();
  const { workspaces, currentWorkspace, switchWorkspace } = useAuthSession();

  const [selected, setSelected] = useState<WorkspaceContext>(
    currentWorkspace || workspaces[0] || {
      tenantId: null,
      organizationName: 'Personal Student Workspace',
      role: 'STUDENT',
      isPersonal: true,
    }
  );

  const handleContinue = async () => {
    await switchWorkspace(selected);
    if (navigation && navigation.canGoBack && navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }}>
      <View style={{ flex: 1, padding: spacing.screenPadding }}>
        <Text style={[typography.h1, { color: colors.text.primary, marginBottom: spacing.xs, fontWeight: '700' }]}>
          Select Workspace
        </Text>
        <Text
          style={[
            typography.bodyMd,
            { color: colors.text.secondary, marginBottom: spacing.lg },
          ]}
        >
          Choose between your Personal Student Workspace and University Institutional Workspaces.
        </Text>

        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          {workspaces.map((ws, idx) => {
            const isCurrent =
              selected.tenantId === ws.tenantId &&
              selected.isPersonal === ws.isPersonal;

            return (
              <Card
                key={idx}
                testID={`workspace-card-${idx}`}
                onPress={() => setSelected(ws)}
                variant={isCurrent ? 'elevated' : 'outlined'}
                style={{
                  borderColor: isCurrent ? colors.brand.primary : colors.border.default,
                  borderWidth: isCurrent ? 2 : 1,
                  padding: spacing.md,
                  marginBottom: spacing.md,
                  minHeight: 80, // Minimum touch area
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: ws.isPersonal
                          ? '#E0F2FE'
                          : '#F3E8FF',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: spacing.sm,
                      }}
                    >
                      {ws.isPersonal ? (
                        <User size={22} color={colors.brand.primary} />
                      ) : (
                        <Building2 size={22} color="#7E22CE" />
                      )}
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          typography.h3,
                          { color: colors.text.primary, marginBottom: 2, fontWeight: '700' },
                        ]}
                      >
                        {ws.organizationName}
                      </Text>
                      <Text style={[typography.labelSm, { color: colors.text.secondary, marginBottom: 4 }]}>
                        {ws.isPersonal
                          ? 'Personal Study • Standard Access'
                          : `${ws.role || 'STUDENT'} • ${ws.cohortName || 'Institutional Cohort'}`}
                      </Text>

                      {/* Entitlement & Offline Availability Pill */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <EntitlementBadge
                          status={ws.isPersonal ? 'FREE' : 'INSTITUTION'}
                        />
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Wifi size={12} color={colors.status.online} />
                          <Text
                            style={[
                              typography.labelSm,
                              { color: colors.status.online, fontSize: 11, marginLeft: 3, fontWeight: '600' },
                            ]}
                          >
                            Offline Ready
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {isCurrent ? (
                    <CheckCircle2 size={22} color={colors.brand.primary} />
                  ) : (
                    <Circle size={22} color={colors.border.default} />
                  )}
                </View>
              </Card>
            );
          })}
        </ScrollView>

        <Button
          testID="continue-workspace-btn"
          title="Continue in Selected Workspace"
          variant="primary"
          onPress={handleContinue}
          style={{ marginTop: spacing.md }}
        />
      </View>
    </SafeAreaView>
  );
};
