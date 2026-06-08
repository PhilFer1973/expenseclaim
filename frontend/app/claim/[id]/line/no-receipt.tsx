import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
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

import { useAddLine, useCategories, useSummariseNarrative } from "@/src/api/client";
import { Button } from "@/src/components/Button";
import { NarrativeRecorder } from "@/src/components/NarrativeRecorder";
import { colors, radii, spacing, typography } from "@/src/theme/tokens";
import { todayUK, ukToISO } from "@/src/utils/format";

export default function NoReceiptLineScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const categories = useCategories();
  const add = useAddLine(id);
  const summarise = useSummariseNarrative();

  const [category, setCategory] = useState<string | null>(null);
  const [gross, setGross] = useState("");
  const [narrative, setNarrative] = useState("");
  const [date, setDate] = useState(todayUK());
  const [error, setError] = useState<string | null>(null);

  const grossNum = parseFloat(gross.replace(",", "."));
  const canSave =
    !!category && !!narrative.trim() && !isNaN(grossNum) && grossNum > 0;

  const onSave = async () => {
    setError(null);
    try {
      await add.mutateAsync({
        receipt_status: "no_receipt",
        category,
        gross_amount: grossNum,
        narrative_final: narrative.trim().slice(0, 50),
        receipt_date: ukToISO(date),
      });
      router.replace(`/claim/${id}`);
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
        <Pressable testID="no-receipt-back" onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>No-receipt expense</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.banner}>
          <Ionicons name="information-circle-outline" size={20} color={colors.accentInk} />
          <Text style={styles.bannerText}>
            VAT is set to <Text style={{ fontWeight: typography.bold }}>UK0</Text> (no VAT
            reclaim) when there is no receipt.
          </Text>
        </View>

        <Field label="Date">
          <TextInput
            testID="no-receipt-date"
            value={date}
            onChangeText={setDate}
            placeholder="dd-mm-yyyy"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            inputMode="numeric"
          />
        </Field>

        <Field label="Gross amount (£)">
          <TextInput
            testID="no-receipt-gross"
            value={gross}
            onChangeText={(t) => setGross(t.replace(/[^0-9.,]/g, ""))}
            placeholder="0.00"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
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
                  testID={`no-receipt-cat-${c.name}`}
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
          <NarrativeRecorder
            testID="no-receipt-narrative"
            value={narrative}
            onChangeText={(t) => setNarrative(t.slice(0, 50))}
            busy={summarise.isPending}
            placeholder="What was this for?"
            maxLength={50}
            onTranscript={async (raw) => {
              try {
                const res = await summarise.mutateAsync({ text: raw });
                setNarrative(res.summary.slice(0, 50));
              } catch {
                // already shown raw
              }
            }}
          />
        </Field>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          testID="no-receipt-save"
          label="Save line"
          onPress={onSave}
          disabled={!canSave}
          loading={add.isPending}
        />
      </View>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: { fontSize: typography.h3, fontWeight: typography.semibold, color: colors.textPrimary },
  content: { padding: spacing.lg, gap: spacing.lg },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.card,
  },
  bannerText: { flex: 1, fontSize: typography.bodySm, color: colors.textPrimary },
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
  chipText: {
    fontSize: typography.bodySm,
    color: colors.textSecondary,
    fontWeight: typography.semibold,
  },
  chipTextActive: { color: colors.textOnAccent },
  counter: {
    alignSelf: "flex-end",
    fontSize: typography.caption,
    color: colors.textMuted,
  },
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
