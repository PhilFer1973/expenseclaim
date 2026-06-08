import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useClaims, useDeleteClaim, type ClaimStatus } from "@/src/api/client";
import { ClaimCard } from "@/src/components/ClaimCard";
import { EmptyState } from "@/src/components/EmptyState";
import { Fab } from "@/src/components/Fab";
import { colors, radii, spacing, typography } from "@/src/theme/tokens";

type Filter = "all" | ClaimStatus;
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "submitted", label: "Submitted" },
];

export default function ClaimsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>("all");
  const claims = useClaims(filter === "all" ? undefined : filter);
  const remove = useDeleteClaim();

  const promptDelete = (claimId: string, title: string) => {
    Alert.alert(
      "Delete draft?",
      `"${title}" and all its lines will be removed.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => remove.mutate(claimId),
        },
      ]
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Claims</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                testID={`claims-filter-${f.key}`}
                onPress={() => setFilter(f.key)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 96 }]}
        refreshControl={
          <RefreshControl refreshing={claims.isFetching} onRefresh={() => claims.refetch()} />
        }
      >
        {claims.isLoading ? (
          <ActivityIndicator color={colors.accent} />
        ) : (claims.data ?? []).length === 0 ? (
          <EmptyState
            title="Nothing here yet"
            subtitle="Start a new claim to capture your expenses."
            icon="document-outline"
            ctaLabel="Start a claim"
            onCtaPress={() => router.push("/claim/new")}
            testID="claims-empty"
          />
        ) : (
          <View style={{ gap: spacing.md }}>
            <Text style={styles.hint}>Select a pane to edit</Text>
            {(claims.data ?? []).map((c) => (
              <ClaimCard
                key={c.claim_id}
                claim={c}
                onPress={() =>
                  router.push(
                    c.status === "draft" ? `/claim/${c.claim_id}` : `/claim/${c.claim_id}/submitted`
                  )
                }
                onDelete={
                  c.status === "draft"
                    ? () => promptDelete(c.claim_id, c.claim_title)
                    : undefined
                }
              />
            ))}
          </View>
        )}
      </ScrollView>
      <Fab
        testID="claims-new-fab"
        bottom={insets.bottom + 16}
        onPress={() => router.push("/claim/new")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.pageBg,
  },
  title: {
    fontSize: typography.h1,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  chipsRow: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  chip: {
    height: 36,
    flexShrink: 0,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    fontSize: typography.bodySm,
    color: colors.textSecondary,
    fontWeight: typography.semibold,
  },
  chipTextActive: { color: colors.textOnAccent },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
  hint: {
    fontSize: typography.caption,
    color: colors.textMuted,
    fontStyle: "italic",
    marginBottom: spacing.xs,
  },
});
