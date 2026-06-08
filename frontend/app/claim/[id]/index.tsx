import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
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

import { useClaim, useDeleteLine, useSubmitClaim } from "@/src/api/client";
import { Button } from "@/src/components/Button";
import { EmptyState } from "@/src/components/EmptyState";
import { LineCard } from "@/src/components/LineCard";
import { StatusPill } from "@/src/components/StatusPill";
import { colors, radii, shadow, spacing, typography } from "@/src/theme/tokens";
import { formatGBP } from "@/src/utils/format";

export default function ClaimBuilderScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const claim = useClaim(id);
  const submit = useSubmitClaim();
  const removeLine = useDeleteLine(id);
  const [error, setError] = useState<string | null>(null);

  if (claim.isLoading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!claim.data) {
    return (
      <View style={[styles.root, styles.center]}>
        <EmptyState title="Claim not found" icon="alert-circle-outline" />
      </View>
    );
  }

  // Submitted claims redirect to the read-only view.
  if (claim.data.status === "submitted") {
    router.replace(`/claim/${id}/submitted`);
    return null;
  }

  const onSubmit = async () => {
    setError(null);
    try {
      await submit.mutateAsync(id);
      router.replace(`/claim/${id}/submitted`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to submit");
    }
  };

  const lines = claim.data.lines;
  const canSubmit = lines.length > 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.headerBar}>
        <Pressable testID="builder-back" onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </Pressable>
        <StatusPill variant="draft" />
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        refreshControl={
          <RefreshControl refreshing={claim.isFetching} onRefresh={() => claim.refetch()} />
        }
      >
        <View style={styles.titleBlock}>
          <Text style={styles.title} testID="builder-title">
            {claim.data.claim_title}
          </Text>
          <Text style={styles.ref}>{claim.data.claim_ref}</Text>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Running total</Text>
            <Text style={styles.totalValue} testID="builder-total">
              {formatGBP(claim.data.running_gross_total)}
            </Text>
          </View>
        </View>

        <Pressable
          testID="builder-add-line"
          onPress={() => router.push(`/claim/${id}/line/new`)}
          style={({ pressed }) => [styles.addLine, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="add-circle" size={24} color={colors.accent} />
          <Text style={styles.addLineText}>Add a line</Text>
        </Pressable>

        {lines.length === 0 ? (
          <EmptyState
            title="No lines yet"
            subtitle="Tap Add a line to capture a receipt or enter a no-receipt expense."
            icon="receipt-outline"
            testID="builder-empty"
          />
        ) : (
          <View style={{ gap: spacing.md }}>
            {lines.map((line) => (
              <LineCard
                key={line.claim_line_id}
                line={line}
                onPress={() => router.push(`/claim/${id}/line/${line.claim_line_id}`)}
                onDelete={() =>
                  Alert.alert("Delete line?", "This line will be removed from the claim.", [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: () => removeLine.mutate(line.claim_line_id),
                    },
                  ])
                }
              />
            ))}
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={[styles.submitBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          testID="builder-submit"
          label={canSubmit ? `Submit claim · ${formatGBP(claim.data.running_gross_total)}` : "Add a line to submit"}
          onPress={onSubmit}
          loading={submit.isPending}
          disabled={!canSubmit}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  center: { alignItems: "center", justifyContent: "center" },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  content: { padding: spacing.lg, gap: spacing.lg },
  titleBlock: {
    backgroundColor: colors.surface,
    borderRadius: radii.cardLarge,
    padding: spacing.xl,
    ...shadow.card,
  },
  title: {
    fontSize: typography.h2,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  ref: { marginTop: 4, fontSize: typography.caption, color: colors.textSecondary },
  totalRow: {
    marginTop: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  totalLabel: { fontSize: typography.bodySm, color: colors.textSecondary },
  totalValue: {
    fontSize: typography.display,
    fontWeight: typography.extrabold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  addLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.accentSoft,
  },
  addLineText: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: colors.accentInk,
  },
  error: { color: colors.danger, textAlign: "center", marginTop: spacing.md },
  submitBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    padding: spacing.lg,
  },
});
