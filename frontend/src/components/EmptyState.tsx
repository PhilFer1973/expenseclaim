import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii, shadow, spacing, typography } from "@/src/theme/tokens";

export function EmptyState({
  title,
  subtitle,
  icon = "documents-outline",
  ctaLabel,
  onCtaPress,
  testID,
}: {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  ctaLabel?: string;
  onCtaPress?: () => void;
  testID?: string;
}) {
  return (
    <View style={styles.wrap} testID={testID ?? "empty-state"}>
      <View style={styles.iconRing}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={32} color={colors.accent} />
        </View>
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {ctaLabel && onCtaPress ? (
        <Pressable
          testID={`${testID ?? "empty-state"}-cta`}
          onPress={onCtaPress}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Text style={styles.ctaText}>{ctaLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  iconRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.card,
  },
  title: {
    fontSize: typography.h2,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    textAlign: "center",
    letterSpacing: -0.2,
  },
  subtitle: {
    marginTop: 8,
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    maxWidth: 320,
    lineHeight: 22,
  },
  cta: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    height: 48,
    minWidth: 200,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaPressed: { opacity: 0.85 },
  ctaText: {
    color: colors.textOnAccent,
    fontWeight: typography.semibold,
    fontSize: typography.body,
  },
});
