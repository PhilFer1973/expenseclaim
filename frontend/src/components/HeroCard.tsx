import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, radii, shadow, spacing, typography } from "@/src/theme/tokens";
import { formatGBP } from "@/src/utils/format";

/**
 * Direction A hero card.
 * v1 substitution: "Submitted this period" replaces "Awaiting reimbursement".
 */
export function HeroCard({
  total,
  submittedCount,
  draftCount,
}: {
  total: number;
  submittedCount: number;
  draftCount: number;
}) {
  return (
    <View style={styles.card} testID="home-hero-card">
      <Text style={styles.label}>Submitted this period</Text>
      <Text style={styles.amount} testID="home-hero-total">
        {formatGBP(total)}
      </Text>
      <View style={styles.meta}>
        <View style={styles.metaItem}>
          <Text style={styles.metaValue}>{submittedCount}</Text>
          <Text style={styles.metaLabel}>Submitted</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.metaItem}>
          <Text style={styles.metaValue}>{draftCount}</Text>
          <Text style={styles.metaLabel}>Draft</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.cardLarge,
    padding: spacing.xl,
    ...shadow.card,
  },
  label: {
    fontSize: typography.bodySm,
    fontWeight: typography.medium,
    color: colors.textSecondary,
  },
  amount: {
    marginTop: spacing.sm,
    fontSize: typography.display,
    fontWeight: typography.extrabold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.lg,
  },
  metaItem: { flex: 1 },
  metaValue: {
    fontSize: typography.h2,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  metaLabel: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: colors.hairline,
    marginHorizontal: spacing.lg,
  },
});
