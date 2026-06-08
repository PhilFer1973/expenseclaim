import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { StatusPill } from "@/src/components/StatusPill";
import { colors, radii, shadow, spacing, typography } from "@/src/theme/tokens";
import type { ClaimSummary } from "@/src/api/client";
import { formatGBP, formatMonthYear } from "@/src/utils/format";

export function ClaimCard({
  claim,
  onPress,
  onEdit,
  onDelete,
}: {
  claim: ClaimSummary;
  onPress: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const isDraft = claim.status === "draft";
  return (
    <Pressable
      testID={`claim-card-${claim.claim_id}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {claim.claim_title}
          </Text>
          <Text style={styles.meta}>
            {claim.claim_ref ?? ""}
            {claim.line_count > 0 ? ` · ${claim.line_count} lines` : ""}
            {claim.submitted_at ? ` · ${formatMonthYear(claim.submitted_at)}` : ""}
          </Text>
        </View>
        <StatusPill variant={isDraft ? "draft" : "submitted"} />
      </View>
      <View style={styles.row}>
        <Text style={styles.amount}>{formatGBP(claim.running_gross_total)}</Text>
        {isDraft ? (
          <View style={styles.actions}>
            {onEdit ? (
              <Pressable
                testID={`claim-card-edit-${claim.claim_id}`}
                onPress={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                hitSlop={10}
                style={({ pressed }) => [styles.iconBtn, styles.editBtn, pressed && styles.pressed]}
              >
                <Ionicons name="pencil" size={18} color={colors.accentInk} />
              </Pressable>
            ) : null}
            {onDelete ? (
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
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
    ...shadow.card,
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
  editBtn: { backgroundColor: colors.accentSoft },
  deleteBtn: { backgroundColor: colors.dangerSoft },
});
