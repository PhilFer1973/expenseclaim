import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";

import { colors, radii, typography } from "@/src/theme/tokens";

type Variant = "draft" | "submitted" | "uk20" | "uk0" | "unrec" | "review";

const palette: Record<Variant, { bg: string; fg: string; label: string }> = {
  draft: { bg: colors.warningSoft, fg: colors.warning, label: "Draft" },
  submitted: { bg: colors.successSoft, fg: colors.success, label: "Submitted" },
  uk20: { bg: colors.vatUK20Bg, fg: colors.vatUK20Fg, label: "UK20" },
  uk0: { bg: colors.vatUK0Bg, fg: colors.vatUK0Fg, label: "UK0" },
  unrec: { bg: colors.vatUNRECBg, fg: colors.vatUNRECFg, label: "UNREC" },
  review: { bg: colors.vatREVIEWBg, fg: colors.vatREVIEWFg, label: "REVIEW" },
};

export function StatusPill({
  variant,
  label,
  testID,
  style,
}: {
  variant: Variant;
  label?: string;
  testID?: string;
  style?: ViewStyle;
}) {
  const v = palette[variant];
  return (
    <View
      testID={testID}
      style={[styles.pill, { backgroundColor: v.bg }, style]}
    >
      <Text style={[styles.text, { color: v.fg }]}>{label ?? v.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: typography.micro,
    fontWeight: typography.bold,
    letterSpacing: 0.2,
  },
});
