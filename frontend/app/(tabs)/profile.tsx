import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useMe } from "@/src/api/client";
import { colors, radii, shadow, spacing, typography } from "@/src/theme/tokens";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const me = useMe();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 96 }]}
      >
        <Text style={styles.h1}>Profile</Text>

        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {me.data
                ? me.data.name
                    .split(" ")
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join("")
                : "?"}
            </Text>
          </View>
          <Text style={styles.name} testID="profile-name">
            {me.data?.name ?? "—"}
          </Text>
          <Text style={styles.email}>{me.data?.email ?? ""}</Text>
          <View style={styles.demoPill}>
            <Ionicons name="flash" size={12} color={colors.accentInk} />
            <Text style={styles.demoText}>Demo employee</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Row label="Role" value="Employee" />
          <Divider />
          <Row label="Currency" value="GBP" />
          <Divider />
          <Row label="Authentication" value="Demo profile (v1)" />
        </View>

        <Text style={styles.smallNote}>
          Authentication, approvals and reimbursement tracking are in the v2 backlog.
        </Text>
      </ScrollView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  content: { padding: spacing.lg, gap: spacing.lg },
  h1: {
    fontSize: typography.h1,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  avatarWrap: { alignItems: "center", marginTop: spacing.md, gap: 4 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: typography.bold,
    color: colors.accentInk,
  },
  name: { fontSize: typography.h2, fontWeight: typography.bold, color: colors.textPrimary },
  email: { fontSize: typography.bodySm, color: colors.textSecondary },
  demoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: spacing.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.accentSoft,
  },
  demoText: {
    fontSize: typography.micro,
    fontWeight: typography.bold,
    color: colors.accentInk,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
    ...shadow.card,
  },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.sm },
  rowLabel: { fontSize: typography.body, color: colors.textSecondary },
  rowValue: { fontSize: typography.body, color: colors.textPrimary, fontWeight: typography.semibold },
  divider: { height: 1, backgroundColor: colors.hairline },
  smallNote: {
    fontSize: typography.caption,
    color: colors.textMuted,
    textAlign: "center",
    paddingHorizontal: spacing.lg,
  },
});
