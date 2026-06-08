import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useCreateClaim } from "@/src/api/client";
import { Button } from "@/src/components/Button";
import { colors, radii, spacing, typography } from "@/src/theme/tokens";

export default function NewClaimScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const create = useCreateClaim();
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim()) {
      setError("Please give your claim a short title.");
      return;
    }
    setError(null);
    try {
      const claim = await create.mutateAsync(title.trim());
      router.replace(`/claim/${claim.claim_id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create claim");
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.root, { paddingTop: insets.top }]}
    >
      <View style={styles.header}>
        <Pressable
          testID="new-claim-close"
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Ionicons name="close" size={26} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>New claim</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.body}>
        <Text style={styles.label}>Claim title</Text>
        <TextInput
          testID="new-claim-title-input"
          autoFocus
          value={title}
          onChangeText={setTitle}
          maxLength={120}
          placeholder="e.g. London client visits"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          returnKeyType="done"
          onSubmitEditing={submit}
        />
        <Text style={styles.hint}>
          You can add receipts and lines on the next screen.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Button
          testID="new-claim-create-button"
          label="Create draft"
          onPress={submit}
          loading={create.isPending}
          disabled={!title.trim()}
        />
      </View>
    </KeyboardAvoidingView>
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
  body: { flex: 1, padding: spacing.lg, gap: spacing.sm },
  label: { fontSize: typography.bodySm, color: colors.textSecondary, fontWeight: typography.medium },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radii.field,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    fontSize: typography.body,
    color: colors.textPrimary,
  },
  hint: { marginTop: 6, fontSize: typography.caption, color: colors.textMuted },
  error: { marginTop: spacing.sm, color: colors.danger, fontSize: typography.bodySm },
  footer: { padding: spacing.lg, gap: spacing.sm },
});
