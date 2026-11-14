import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../../shared/theme';
import { Button, Card } from '../../shared/components';
import { useAuthSession, WorkspaceContext } from '../../services/auth-session/AuthSessionContext';
import { Building2, User, CheckCircle2, Circle } from 'lucide-react-native';

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
      organizationName: 'Personal Workspace',
      role: 'OWNER',
      isPersonal: true,
    }
  );

  const handleContinue = async () => {
    await switchWorkspace(selected);
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }}>
      <View style={{ flex: 1, padding: spacing.screenPadding }}>
        <Text style={[typography.h1, { color: colors.text.primary, marginBottom: spacing.xs }]}>
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
                onPress={() => setSelected(ws)}
                variant={isCurrent ? 'elevated' : 'outlined'}
                style={{
                  borderColor: isCurrent ? colors.brand.primary : colors.border.default,
                  borderWidth: isCurrent ? 2 : 1,
                  padding: spacing.md,
                  marginBottom: spacing.md,
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
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: ws.isPersonal
                          ? '#E0F2FE'
                          : '#F3E8FF',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: spacing.sm,
                      }}
                    >
                      {ws.isPersonal ? (
                        <User size={20} color={colors.brand.primary} />
                      ) : (
                        <Building2 size={20} color="#7E22CE" />
                      )}
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          typography.h3,
                          { color: colors.text.primary, marginBottom: 2 },
                        ]}
                      >
                        {ws.organizationName}
                      </Text>
                      <Text style={[typography.labelSm, { color: colors.text.secondary }]}>
                        {ws.isPersonal
                          ? 'Personal Study • Standard Access'
                          : `${ws.role} • ${ws.cohortName || 'Institutional Cohort'}`}
                      </Text>
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
          title="Continue in Selected Workspace"
          variant="primary"
          onPress={handleContinue}
          style={{ marginTop: spacing.md }}
        />
      </View>
    </SafeAreaView>
  );
};
