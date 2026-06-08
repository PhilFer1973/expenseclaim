import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { GlassPane } from "@/src/components/GlassPane";
import { StatusPill } from "@/src/components/StatusPill";
import { colors, radii, spacing, typography } from "@/src/theme/tokens";
import type { ClaimLine, VatCode } from "@/src/api/client";
import { formatGBP, formatUKDate } from "@/src/utils/format";

const vatVariant: Record<VatCode, "uk20" | "uk0" | "unrec" | "review"> = {
  UK20: "uk20",
  UK0: "uk0",
  UNREC: "unrec",
  REVIEW: "review",
};

export function LineCard({
  line,
  onPress,
  onDelete,
  readOnly,
}: {
  line: ClaimLine;
  onPress: () => void;
  onDelete?: () => void;
  readOnly?: boolean;
}) {
  const noReceipt = line.receipt_status === "no_receipt";
  const title = line.supplier_name ?? (noReceipt ? "No-receipt expense" : "Receipt");
  const incomplete =
    !line.category ||
    !line.narrative_final ||
    !line.gross_amount ||
    !line.receipt_date;
  return (
    <Pressable
      testID={`line-card-${line.claim_line_id}`}
      onPress={onPress}
      style={({ pressed }) => [pressed && !readOnly && styles.pressed]}
    >
      <GlassPane
        style={[styles.card, incomplete && !readOnly ? styles.cardIncomplete : null]}
      >
        <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {line.category ?? "—"}
            {line.receipt_date ? ` · ${formatUKDate(line.receipt_date)}` : ""}
          </Text>
        </View>
        <Text style={styles.amount}>{formatGBP(line.gross_amount ?? 0)}</Text>
      </View>
      <View style={styles.row}>
        <StatusPill variant={vatVariant[line.vat_code]} />
        {noReceipt ? <Text style={styles.tag}>No receipt</Text> : null}
        {incomplete && !readOnly ? (
          <View style={styles.pillIncomplete}>
            <Ionicons name="alert-circle" size={12} color={colors.warning} />
            <Text style={styles.pillIncompleteText}>Incomplete</Text>
          </View>
        ) : null}
        {line.duplicate_flag ? (
          <View style={styles.pillWarn}>
            <Ionicons name="copy-outline" size={12} color={colors.warning} />
            <Text style={styles.pillWarnText}>Possible duplicate</Text>
          </View>
        ) : null}
        {line.old_receipt_flag ? (
          <View style={styles.pillWarn}>
            <Ionicons name="time-outline" size={12} color={colors.warning} />
            <Text style={styles.pillWarnText}>Old receipt</Text>
          </View>
        ) : null}
        {!readOnly && onDelete ? (
          <Pressable
            testID={`line-card-delete-${line.claim_line_id}`}
            onPress={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            hitSlop={10}
            style={styles.binBtn}
          >
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
          </Pressable>
        ) : null}
      </View>
      {line.narrative_final ? (
        <Text style={styles.narrative} numberOfLines={2}>
          {line.narrative_final}
        </Text>
      ) : null}
      </GlassPane>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
  },
  pressed: { opacity: 0.85 },
  top: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  title: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  meta: { marginTop: 2, fontSize: typography.caption, color: colors.textSecondary },
  amount: {
    fontSize: typography.h3,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  row: {
    marginTop: spacing.md,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    alignItems: "center",
  },
  tag: { fontSize: typography.micro, color: colors.textSecondary, fontWeight: typography.medium },
  flag: { color: colors.warning, fontWeight: typography.bold },
  cardIncomplete: {
    borderColor: colors.warning,
    borderStyle: "dashed",
  },
  pillIncomplete: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.warningSoft,
  },
  pillIncompleteText: {
    fontSize: typography.micro,
    color: colors.warning,
    fontWeight: typography.bold,
  },
  pillWarn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.warningSoft,
  },
  pillWarnText: {
    fontSize: typography.micro,
    color: colors.warning,
    fontWeight: typography.bold,
  },
  narrative: {
    marginTop: spacing.sm,
    fontSize: typography.bodySm,
    color: colors.textSecondary,
  },
  binBtn: {
    marginLeft: "auto",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.dangerSoft,
  },
});
