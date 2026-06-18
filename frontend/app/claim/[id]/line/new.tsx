import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radii, shadow, spacing, typography } from "@/src/theme/tokens";

export default function NewLineChooserScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable testID="new-line-back" onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Add a line</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.content}>
        <Pressable
          testID="new-line-scan"
          onPress={() => router.push(`/claim/${id}/line/scan`)}
          style={({ pressed }) => [styles.option, pressed && { opacity: 0.85 }]}
        >
          <View style={[styles.iconBubble, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name="camera-outline" size={26} color={colors.accentInk} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.optionTitle}>Scan receipt</Text>
            <Text style={styles.optionSubtitle}>
              Capture a photo. AI fills in supplier, amounts and category.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Pressable>

        <Pressable
          testID="new-line-upload"
          onPress={() => router.push(`/claim/${id}/line/scan?source=upload`)}
          style={({ pressed }) => [styles.option, pressed && { opacity: 0.85 }]}
        >
          <View style={[styles.iconBubble, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name="image-outline" size={26} color={colors.accentInk} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.optionTitle}>Upload receipt</Text>
            <Text style={styles.optionSubtitle}>
              Pick a saved photo or PDF receipt. Best for emailed or digital receipts.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Pressable>

        <Pressable
          testID="new-line-no-receipt"
          onPress={() => router.replace(`/claim/${id}/line/no-receipt`)}
          style={({ pressed }) => [styles.option, pressed && { opacity: 0.85 }]}
        >
          <View style={[styles.iconBubble, { backgroundColor: colors.warningSoft }]}>
            <Ionicons name="document-text-outline" size={26} color={colors.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.optionTitle}>No receipt</Text>
            <Text style={styles.optionSubtitle}>
              Enter the details by hand. VAT will be set to UK0.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: { fontSize: typography.h3, fontWeight: typography.semibold, color: colors.textPrimary },
  content: { padding: spacing.lg, gap: spacing.md },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
    ...shadow.card,
  },
  iconBubble: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  optionTitle: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  optionSubtitle: {
    marginTop: 2,
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
});
