import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { GlassPane } from "@/src/components/GlassPane";
import { colors, radii, shadow, spacing, typography } from "@/src/theme/tokens";
import { formatGBP } from "@/src/utils/format";

export type Period = "7d" | "30d" | "12m";
export const PERIODS: { key: Period; label: string }[] = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "12m", label: "Last 12 months" },
];

/**
 * Direction A hero card.
 * Shows total submitted in the selected rolling window with a tappable
 * period selector.
 */
export function HeroCard({
  total,
  submittedCount,
  draftCount,
  period,
  onPeriodChange,
  pickerOpen,
  onTogglePicker,
}: {
  total: number;
  submittedCount: number;
  draftCount: number;
  period: Period;
  onPeriodChange: (p: Period) => void;
  pickerOpen: boolean;
  onTogglePicker: () => void;
}) {
  const currentLabel = PERIODS.find((p) => p.key === period)?.label ?? "Last 30 days";
  return (
    <GlassPane style={styles.card} radius={radii.cardLarge} testID="home-hero-card">
      <View style={styles.headerRow}>
        <Text style={styles.label}>Submitted</Text>
        <Pressable
          testID="home-hero-period"
          onPress={onTogglePicker}
          style={({ pressed }) => [styles.periodBtn, pressed && styles.periodBtnPressed]}
          hitSlop={6}
        >
          <Text style={styles.periodText}>{currentLabel}</Text>
          <Ionicons
            name={pickerOpen ? "chevron-up" : "chevron-down"}
            size={14}
            color={colors.accentInk}
          />
        </Pressable>
      </View>
      {pickerOpen ? (
        <View style={styles.dropdown}>
          {PERIODS.map((p) => {
            const active = p.key === period;
            return (
              <Pressable
                key={p.key}
                testID={`home-hero-period-${p.key}`}
                onPress={() => onPeriodChange(p.key)}
                style={({ pressed }) => [
                  styles.dropdownItem,
                  active && styles.dropdownItemActive,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={[styles.dropdownText, active && styles.dropdownTextActive]}>
                  {p.label}
                </Text>
                {active ? <Ionicons name="checkmark" size={16} color={colors.accent} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
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
    </GlassPane>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.xl,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    fontSize: typography.bodySm,
    fontWeight: typography.medium,
    color: colors.textSecondary,
  },
  periodBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.accentSoft,
  },
  periodBtnPressed: { opacity: 0.75 },
  periodText: {
    fontSize: typography.caption,
    fontWeight: typography.semibold,
    color: colors.accentInk,
  },
  dropdown: {
    marginTop: spacing.sm,
    backgroundColor: colors.pageBg,
    borderRadius: radii.field,
    overflow: "hidden",
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  dropdownItemActive: { backgroundColor: colors.accentSoft },
  dropdownText: { fontSize: typography.bodySm, color: colors.textPrimary },
  dropdownTextActive: { color: colors.accentInk, fontWeight: typography.semibold },
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
