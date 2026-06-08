import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useClaims, useDeleteClaim, useMe } from "@/src/api/client";
import { ClaimCard } from "@/src/components/ClaimCard";
import { EmptyState } from "@/src/components/EmptyState";
import { Fab } from "@/src/components/Fab";
import { HeroCard, type Period } from "@/src/components/HeroCard";
import { colors, spacing, typography } from "@/src/theme/tokens";
import { confirm } from "@/src/utils/confirm";

const PERIOD_DAYS: Record<Period, number> = {
  "7d": 7,
  "30d": 30,
  "12m": 365,
};

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = useMe();
  const claims = useClaims();
  const remove = useDeleteClaim();
  const [period, setPeriod] = useState<Period>("30d");
  const [pickerOpen, setPickerOpen] = useState(false);

  const promptDelete = async (claimId: string, title: string) => {
    const ok = await confirm({
      title: "Delete draft?",
      message: `"${title}" and all its lines will be removed.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (ok) remove.mutate(claimId);
  };

  const totals = useMemo(() => {
    const list = claims.data ?? [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - PERIOD_DAYS[period]);
    const inWindow = (iso: string | null | undefined) =>
      !!iso && new Date(iso) >= cutoff;
    const submittedInWindow = list.filter(
      (c) => c.status === "submitted" && inWindow(c.submitted_at)
    );
    return {
      submittedTotal: submittedInWindow.reduce(
        (sum, c) => sum + Number(c.running_gross_total ?? 0),
        0
      ),
      submittedCount: submittedInWindow.length,
      draftCount: list.filter((c) => c.status === "draft").length,
    };
  }, [claims.data, period]);

  const drafts = (claims.data ?? []).filter((c) => c.status === "draft");
  const recent = (claims.data ?? []).filter((c) => c.status === "submitted").slice(0, 6);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 96 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={claims.isFetching} onRefresh={() => claims.refetch()} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.greeting} testID="home-greeting">
            {me.data ? `Hi, ${me.data.name.split(" ")[0]}` : "Hi"}
          </Text>
          <Text style={styles.subtitle}>My expenses</Text>
        </View>

        {claims.isLoading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
        ) : (
          <>
            <HeroCard
              total={totals.submittedTotal}
              submittedCount={totals.submittedCount}
              draftCount={totals.draftCount}
              period={period}
              onPeriodChange={(p) => {
                setPeriod(p);
                setPickerOpen(false);
              }}
              pickerOpen={pickerOpen}
              onTogglePicker={() => setPickerOpen((v) => !v)}
            />

            {drafts.length > 0 ? (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>In progress</Text>
                  <Text style={styles.sectionHint}>Select a pane to edit</Text>
                </View>
                <View style={{ gap: spacing.md }}>
                  {drafts.map((d) => (
                    <ClaimCard
                      key={d.claim_id}
                      claim={d}
                      onPress={() => router.push(`/claim/${d.claim_id}`)}
                      onDelete={() => promptDelete(d.claim_id, d.claim_title)}
                    />
                  ))}
                </View>
              </>
            ) : null}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent</Text>
              {recent.length > 0 ? (
                <Text style={styles.sectionHint}>Select a pane to view</Text>
              ) : null}
            </View>
            {recent.length === 0 ? (
              <EmptyState
                title="No submitted claims yet"
                subtitle="Tap New claim below to start your first expense claim."
                icon="document-outline"
                ctaLabel={drafts.length === 0 ? "Start a claim" : undefined}
                onCtaPress={drafts.length === 0 ? () => router.push("/claim/new") : undefined}
              />
            ) : (
              <View style={{ gap: spacing.md }}>
                {recent.map((c) => (
                  <ClaimCard
                    key={c.claim_id}
                    claim={c}
                    onPress={() => router.push(`/claim/${c.claim_id}/submitted`)}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
      <Fab
        testID="home-new-claim-fab"
        bottom={insets.bottom + 16}
        onPress={() => router.push("/claim/new")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  content: { padding: spacing.lg, gap: spacing.lg },
  header: { marginTop: spacing.sm, marginBottom: spacing.xs },
  greeting: {
    fontSize: typography.h2,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: 2,
    fontSize: typography.body,
    color: colors.textSecondary,
  },
  sectionTitle: {
    marginTop: spacing.sm,
    fontSize: typography.h3,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  sectionHeader: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  sectionHint: {
    fontSize: typography.caption,
    color: colors.accent,
    fontStyle: "italic",
    fontWeight: typography.semibold,
  },
});
