import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  useCategories,
  useClaim,
  useUpdateLine,
  type ClaimLine,
} from "@/src/api/client";
import { Button } from "@/src/components/Button";
import { StatusPill } from "@/src/components/StatusPill";
import { colors, radii, spacing, typography } from "@/src/theme/tokens";
import { isoToUK, ukToISO } from "@/src/utils/format";

const VAT_VARIANT = { UK20: "uk20", UK0: "uk0", UNREC: "unrec", REVIEW: "review" } as const;

export default function EditLineScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, lineId } = useLocalSearchParams<{ id: string; lineId: string }>();
  const claim = useClaim(id);
  const categories = useCategories();
  const update = useUpdateLine(id);

  const line: ClaimLine | undefined = claim.data?.lines.find(
    (l) => l.claim_line_id === lineId
  );
  const readOnly = claim.data?.status === "submitted";

  const [category, setCategory] = useState<string | null>(null);
  const [gross, setGross] = useState("");
  const [narrative, setNarrative] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (line) {
      setCategory(line.category);
      setGross(line.gross_amount?.toString() ?? "");
      setNarrative(line.narrative_final ?? "");
      setDate(isoToUK(line.receipt_date));
    }
  }, [line]);

  if (claim.isLoading || !line) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const grossNum = parseFloat(gross.replace(",", "."));

  const onSave = async () => {
    setError(null);
    try {
      await update.mutateAsync({
        lineId,
        body: {
          category,
          gross_amount: isNaN(grossNum) ? null : grossNum,
          narrative_final: narrative.trim().slice(0, 50),
          receipt_date: ukToISO(date),
        },
      });
      router.back();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.root, { paddingTop: insets.top }]}
    >
      <View style={styles.header}>
        <Pressable testID="edit-line-back" onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>
          {readOnly ? "Line" : "Edit line"}
        </Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.metaRow}>
          <StatusPill variant={VAT_VARIANT[line.vat_code]} />
          <Text style={styles.metaText}>
            {line.receipt_status === "no_receipt" ? "No receipt" : "Receipt"} · VAT locked
          </Text>
        </View>

        {line.receipt_url ? (
          <View style={styles.imageWrap}>
            <Image
              source={{ uri: line.receipt_url }}
              style={styles.image}
              resizeMode="contain"
            />
          </View>
        ) : null}

        <Field label="Date">
          <TextInput
            testID="edit-line-date"
            value={date}
            onChangeText={setDate}
            editable={!readOnly}
            placeholder="dd-mm-yyyy"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, readOnly && styles.inputReadOnly]}
            inputMode="numeric"
          />
        </Field>

        <Field label="Gross amount (£)">
          <TextInput
            testID="edit-line-gross"
            value={gross}
            onChangeText={(t) => setGross(t.replace(/[^0-9.,]/g, ""))}
            editable={!readOnly}
            placeholder="0.00"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, readOnly && styles.inputReadOnly]}
            inputMode="decimal"
          />
        </Field>

        <Field label="Category">
          <View style={styles.chipsWrap}>
            {(categories.data ?? []).map((c) => {
              const active = c.name === category;
              return (
                <Pressable
                  key={c.name}
                  testID={`edit-line-cat-${c.name}`}
                  disabled={readOnly}
                  onPress={() => setCategory(c.name)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {c.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Field>

        <Field label="Narrative (max 50 chars)">
          <TextInput
            testID="edit-line-narrative"
            value={narrative}
            onChangeText={(t) => setNarrative(t.slice(0, 50))}
            editable={!readOnly}
            placeholder="What was this for?"
            placeholderTextColor={colors.textMuted}
            style={[
              styles.input,
              { height: 80, textAlignVertical: "top" },
              readOnly && styles.inputReadOnly,
            ]}
            multiline
            maxLength={50}
          />
          <Text style={styles.counter}>{narrative.length}/50</Text>
        </Field>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      {!readOnly ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button
            testID="edit-line-save"
            label="Save changes"
            onPress={onSave}
            loading={update.isPending}
          />
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: { fontSize: typography.h3, fontWeight: typography.semibold, color: colors.textPrimary },
  content: { padding: spacing.lg, gap: spacing.lg },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  metaText: { fontSize: typography.caption, color: colors.textSecondary },
  imageWrap: {
    aspectRatio: 0.75,
    backgroundColor: "#000",
    borderRadius: radii.card,
    overflow: "hidden",
  },
  image: { width: "100%", height: "100%" },
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
  inputReadOnly: { backgroundColor: colors.pageBg, color: colors.textSecondary },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.lg,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: typography.bodySm, color: colors.textSecondary, fontWeight: typography.semibold },
  chipTextActive: { color: colors.textOnAccent },
  counter: { alignSelf: "flex-end", fontSize: typography.caption, color: colors.textMuted },
  error: { color: colors.danger, fontSize: typography.bodySm },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
});
