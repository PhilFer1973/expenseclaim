import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { GlassPane } from "@/src/components/GlassPane";
import { StatusPill } from "@/src/components/StatusPill";
import { colors, radii, spacing, typography } from "@/src/theme/tokens";
import type { ClaimSummary } from "@/src/api/client";
import { formatGBP, formatUKDate } from "@/src/utils/format";

export function ClaimCard({
  claim,
  onPress,
  onDelete,
}: {
  claim: ClaimSummary;
  onPress: () => void;
  onDelete?: () => void;
}) {
  const isDraft = claim.status === "draft";
  return (
    <Pressable
      testID={`claim-card-${claim.claim_id}`}
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <GlassPane style={styles.card}>
        <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {claim.claim_title}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {claim.claim_ref ?? ""}
            {claim.line_count > 0 ? ` · ${claim.line_count} lines` : ""}
          </Text>
          {claim.submitted_at ? (
            <Text style={styles.submittedAt} numberOfLines={1}>
              Submitted {formatUKDate(claim.submitted_at)}
            </Text>
          ) : null}
        </View>
        <StatusPill variant={isDraft ? "draft" : "submitted"} />
      </View>
      <View style={styles.row}>
        <Text style={styles.amount}>{formatGBP(claim.running_gross_total)}</Text>
        {isDraft && onDelete ? (
          <Pressable
            testID={`claim-card-delete-${claim.claim_id}`}
            onPress={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            hitSlop={10}
            style={({ pressed }) => [styles.iconBtn, styles.deleteBtn, pressed && styles.pressed]}
          >
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
          </Pressable>
        ) : null}
      </View>
      </GlassPane>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
  },
  pressed: { opacity: 0.85 },
  top: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  title: {
    fontSize: typography.h3,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  meta: {
    marginTop: 4,
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  submittedAt: {
    marginTop: 2,
    fontSize: typography.caption,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  row: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  amount: {
    fontSize: typography.h2,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtn: { backgroundColor: colors.dangerSoft },
});
