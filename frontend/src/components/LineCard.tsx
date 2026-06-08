import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

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
  return (
    <Pressable
      testID={`line-card-${line.claim_line_id}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && !readOnly && styles.pressed]}
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
        {line.duplicate_flag ? (
          <Text style={[styles.tag, styles.flag]}>Possible duplicate</Text>
        ) : null}
        {line.old_receipt_flag ? (
          <Text style={[styles.tag, styles.flag]}>Old receipt</Text>
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
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
