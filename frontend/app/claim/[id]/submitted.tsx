import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useClaim } from "@/src/api/client";
import { EmptyState } from "@/src/components/EmptyState";
import { LineCard } from "@/src/components/LineCard";
import { StatusPill } from "@/src/components/StatusPill";
import { colors, radii, shadow, spacing, typography } from "@/src/theme/tokens";
import { formatGBP, formatLongDate } from "@/src/utils/format";

export default function SubmittedClaimScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const claim = useClaim(id);

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

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.headerBar}>
        <Pressable testID="submitted-back" onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </Pressable>
        <StatusPill variant="submitted" />
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      >
        <View style={styles.successCard} testID="submitted-banner">
          <Ionicons name="checkmark-circle" size={28} color={colors.success} />
          <View style={{ flex: 1 }}>
            <Text style={styles.successTitle}>Submitted — your claim has been filed.</Text>
            {claim.data.submitted_at ? (
              <Text style={styles.successMeta}>{formatLongDate(claim.data.submitted_at)}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.title}>{claim.data.claim_title}</Text>
          <Text style={styles.ref}>{claim.data.claim_ref}</Text>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Claim total</Text>
            <Text style={styles.totalValue}>
              {formatGBP(claim.data.running_gross_total)}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>
          Lines ({claim.data.lines.length})
        </Text>

        <View style={{ gap: spacing.md }}>
          {claim.data.lines.map((line) => (
            <LineCard
              key={line.claim_line_id}
              line={line}
              readOnly
              onPress={() => router.push(`/claim/${id}/line/${line.claim_line_id}`)}
            />
          ))}
        </View>
      </ScrollView>
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
  successCard: {
    backgroundColor: colors.successSoft,
    borderRadius: radii.card,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  successTitle: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  successMeta: { marginTop: 2, fontSize: typography.caption, color: colors.textSecondary },
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
    fontSize: typography.h1,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  sectionTitle: {
    fontSize: typography.h3,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
});
