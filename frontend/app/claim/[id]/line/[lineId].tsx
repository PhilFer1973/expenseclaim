import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
  useSuggestCategory,
  useSummariseNarrative,
  useUpdateLine,
  type CategorySuggestion,
  type ClaimLine,
} from "@/src/api/client";
import { Button } from "@/src/components/Button";
import { NarrativeRecorder } from "@/src/components/NarrativeRecorder";
import { StatusPill } from "@/src/components/StatusPill";
import { colors, radii, spacing, typography } from "@/src/theme/tokens";
import { formatGBP, formatUKDateInput, isoToUK, ukToISO } from "@/src/utils/format";

const VAT_VARIANT = { UK20: "uk20", UK0: "uk0", UNREC: "unrec", REVIEW: "review" } as const;

type VatCodeKey = keyof typeof VAT_VARIANT;

/**
 * Live preview of the VAT code the backend will assign, mirroring
 * services/vat_service.compute_vat_code so the on-screen badge updates as the
 * user edits the VAT amount. The backend remains authoritative on save.
 */
function previewVatCode(args: {
  receiptStatus: string;
  category: string | null;
  vatNum: number;
  supplierVatNumber: string | null | undefined;
}): VatCodeKey {
  if (args.receiptStatus === "no_receipt") return "UK0";
  if (args.category === "Client Entertaining") return "UNREC";
  const v = isNaN(args.vatNum) ? 0 : args.vatNum;
  if (v > 0) return "UK20"; // any positive UK VAT is standard-rated
  return "UK0";
}

export default function EditLineScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, lineId } = useLocalSearchParams<{ id: string; lineId: string }>();
  const claim = useClaim(id);
  const categories = useCategories();
  const update = useUpdateLine(id);
  const suggest = useSuggestCategory();
  const summarise = useSummariseNarrative();

  const line: ClaimLine | undefined = claim.data?.lines.find(
    (l) => l.claim_line_id === lineId
  );
  const readOnly = claim.data?.status === "submitted";

  const [category, setCategory] = useState<string | null>(null);
  const [supplier, setSupplier] = useState("");
  const [gross, setGross] = useState("");
  const [vat, setVat] = useState("");
  const [narrative, setNarrative] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<CategorySuggestion[]>([]);
  const [aiExplanation, setAiExplanation] = useState<string>("");
  const [aiTriedFor, setAiTriedFor] = useState<string | null>(null);

  useEffect(() => {
    if (line) {
      setCategory(line.category);
      setSupplier(line.supplier_name ?? "");
      setGross(line.gross_amount != null ? Number(line.gross_amount).toFixed(2) : "");
      setVat(line.vat_amount != null ? Number(line.vat_amount).toFixed(2) : "");
      setNarrative(line.narrative_final ?? "");
      setDate(isoToUK(line.receipt_date));
      // Hydrate persisted suggestions from the row if present.
      if (Array.isArray(line.ai_category_suggestions)) {
        setAiSuggestions(line.ai_category_suggestions as CategorySuggestion[]);
      }
      if (line.ai_category_explanation) {
        setAiExplanation(line.ai_category_explanation);
      }
    }
  }, [line]);

  // Auto-trigger category suggestions once per line, in the background, only
  // if there's enough context to be useful (supplier OR gross) and the user
  // hasn't already picked a category.
  useEffect(() => {
    if (!line || readOnly) return;
    if (aiTriedFor === line.claim_line_id) return;
    if (line.category) return;
    if (!line.supplier_name && !line.gross_amount && !line.narrative_final) return;
    setAiTriedFor(line.claim_line_id);
    suggest
      .mutateAsync({ lineId: line.claim_line_id })
      .then((res) => {
        setAiSuggestions(res.ranked);
        setAiExplanation(res.explanation);
      })
      .catch(() => {
        // Silent — manual chips still work.
      });
  }, [line, readOnly, aiTriedFor, suggest]);

  if (claim.isLoading || !line) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const grossNum = parseFloat(gross.replace(",", "."));
  const vatNum = parseFloat(vat.replace(",", "."));
  const isReceipt = line.receipt_status === "receipt";

  // Net is always Gross − VAT (VAT defaults to 0 when blank). Display-only;
  // the backend recomputes and stores it on save.
  const netComputed = !isNaN(grossNum)
    ? grossNum - (isNaN(vatNum) ? 0 : vatNum)
    : null;

  // Live VAT-code preview — updates as the user edits the VAT amount.
  const liveVatCode = previewVatCode({
    receiptStatus: line.receipt_status,
    category,
    vatNum,
    supplierVatNumber: line.supplier_vat_number,
  });
  const shownVatCode = readOnly ? line.vat_code : liveVatCode;

  // Required fields — mirror the app's own completeness check (LineCard /
  // claim builder incompleteCount): date, gross > 0, category, narrative.
  // Mark these in red while incomplete so the user knows what still needs
  // filling before the claim can be submitted.
  const grossIncomplete = isNaN(grossNum) || grossNum <= 0;
  const categoryIncomplete = !category;
  const narrativeIncomplete = !narrative.trim();
  const dateIncomplete = !ukToISO(date);

  const onSave = async () => {
    setError(null);
    try {
      await update.mutateAsync({
        lineId,
        body: {
          category,
          supplier_name: supplier.trim() || null,
          gross_amount: isNaN(grossNum) ? null : grossNum,
          // VAT is user-editable on receipt lines; backend derives net & vat_code.
          ...(isReceipt ? { vat_amount: isNaN(vatNum) ? 0 : vatNum } : {}),
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
          <StatusPill variant={VAT_VARIANT[shownVatCode]} />
          <Text style={styles.metaText}>
            {line.receipt_status === "no_receipt" ? "No receipt" : "Receipt"} · VAT code set automatically
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

        {isReceipt && !readOnly ? (
          <Pressable
            testID="edit-line-retake"
            onPress={() => router.push(`/claim/${id}/line/scan?lineId=${lineId}`)}
            style={({ pressed }) => [styles.retakeBtn, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="camera-outline" size={18} color={colors.accentInk} />
            <Text style={styles.retakeText}>
              {line.receipt_url ? "Retake photo" : "Take photo"}
            </Text>
          </Pressable>
        ) : null}

        {line.image_quality_status === "blurry" && !readOnly ? (
          <View style={styles.warnBanner}>
            <Ionicons name="warning-outline" size={18} color={colors.warning} />
            <Text style={styles.warnText}>
              The receipt photo looks blurry. Please double-check the fields below, or
              retake the photo for a cleaner scan.
            </Text>
          </View>
        ) : null}

        {line.duplicate_flag && !readOnly ? (
          <View style={styles.warnBanner}>
            <Ionicons name="copy-outline" size={18} color={colors.warning} />
            <Text style={styles.warnText}>
              Possible duplicate — another line with the same supplier, date, and amount
              already exists. Review before submitting.
            </Text>
          </View>
        ) : null}

        {line.old_receipt_flag && !readOnly ? (
          <View style={styles.warnBanner}>
            <Ionicons name="time-outline" size={18} color={colors.warning} />
            <Text style={styles.warnText}>
              This receipt is over 90 days old. Your finance team may query it.
            </Text>
          </View>
        ) : null}

        <Field label="Supplier">
          <TextInput
            testID="edit-line-supplier"
            value={supplier}
            onChangeText={setSupplier}
            editable={!readOnly}
            placeholder="e.g. Pret A Manger"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, readOnly && styles.inputReadOnly]}
          />
        </Field>

        <Field label="Date" required={!readOnly} incomplete={dateIncomplete}>
          <TextInput
            testID="edit-line-date"
            value={date}
            onChangeText={(t) => setDate(formatUKDateInput(t))}
            editable={!readOnly}
            placeholder="dd-mm-yyyy"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, readOnly && styles.inputReadOnly]}
            inputMode="numeric"
            maxLength={10}
          />
        </Field>

        <Field label="Gross amount (£)" required={!readOnly} incomplete={grossIncomplete}>
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

        {isReceipt && !readOnly ? (
          <>
            <Field label="VAT amount (£)">
              <TextInput
                testID="edit-line-vat"
                value={vat}
                onChangeText={(t) => setVat(t.replace(/[^0-9.,]/g, ""))}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                inputMode="decimal"
              />
            </Field>
            <View style={styles.netRow}>
              <Text style={styles.netLabel}>Net (Gross − VAT)</Text>
              <Text style={styles.netValue} testID="edit-line-net">
                {formatGBP(netComputed)}
              </Text>
            </View>
            <View style={styles.netRow}>
              <Text style={styles.netLabel}>VAT code</Text>
              <StatusPill testID="edit-line-vatcode" variant={VAT_VARIANT[liveVatCode]} />
            </View>
          </>
        ) : null}

        {readOnly && line.vat_amount != null && Number(line.vat_amount) > 0 ? (
          <View style={styles.breakdownCard} testID="edit-line-vat-breakdown">
            <Text style={styles.breakdownTitle}>VAT breakdown</Text>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Net</Text>
              <Text style={styles.breakdownValue}>
                {formatGBP(
                  line.net_amount != null
                    ? line.net_amount
                    : line.gross_amount != null
                    ? Number(line.gross_amount) - Number(line.vat_amount)
                    : null
                )}
              </Text>
            </View>
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownVatLabel}>
                <Text style={styles.breakdownLabel}>VAT</Text>
                <StatusPill variant={VAT_VARIANT[line.vat_code]} />
              </View>
              <Text style={styles.breakdownValue}>{formatGBP(line.vat_amount)}</Text>
            </View>
            <View style={[styles.breakdownRow, styles.breakdownTotalRow]}>
              <Text style={styles.breakdownLabelStrong}>Gross</Text>
              <Text style={styles.breakdownValueStrong}>{formatGBP(line.gross_amount)}</Text>
            </View>
          </View>
        ) : null}

        {/* Zero-VAT submitted lines have no breakdown card; still show the code. */}
        {readOnly && !(line.vat_amount != null && Number(line.vat_amount) > 0) ? (
          <View style={styles.netRow}>
            <Text style={styles.netLabel}>VAT code</Text>
            <StatusPill testID="edit-line-vatcode-ro" variant={VAT_VARIANT[line.vat_code]} />
          </View>
        ) : null}

        <Field label="Category" required={!readOnly} incomplete={categoryIncomplete}>
          {aiSuggestions.length > 0 && !readOnly ? (
            <View style={styles.aiBlock}>
              <View style={styles.aiHeader}>
                <Ionicons name="sparkles" size={14} color={colors.accentInk} />
                <Text style={styles.aiHeaderText}>AI suggestions</Text>
                {suggest.isPending ? (
                  <ActivityIndicator size="small" color={colors.accentInk} />
                ) : null}
              </View>
              <View style={styles.chipsWrap}>
                {aiSuggestions.map((s, idx) => {
                  const active = s.category === category;
                  return (
                    <Pressable
                      key={`${s.category}-${idx}`}
                      testID={`edit-line-ai-cat-${s.category}`}
                      onPress={() => setCategory(s.category)}
                      style={[styles.aiChip, active && styles.aiChipActive]}
                    >
                      <Ionicons
                        name="sparkles"
                        size={12}
                        color={active ? colors.textOnAccent : colors.accentInk}
                        style={{ marginRight: 4 }}
                      />
                      <Text
                        style={[styles.aiChipText, active && styles.aiChipTextActive]}
                      >
                        {s.category}
                      </Text>
                      <Text
                        style={[
                          styles.aiChipScore,
                          active && styles.aiChipTextActive,
                        ]}
                      >
                        {" "}
                        {Math.round((s.confidence || 0) * 100)}%
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {aiExplanation ? (
                <Text style={styles.aiExplanation}>{aiExplanation}</Text>
              ) : null}
            </View>
          ) : null}
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

        <Field label="Narrative (max 50 chars)" required={!readOnly} incomplete={narrativeIncomplete}>
          <NarrativeRecorder
            testID="edit-line-narrative"
            value={narrative}
            onChangeText={(t) => setNarrative(t.slice(0, 50))}
            disabled={readOnly}
            busy={summarise.isPending}
            placeholder="What was this for?"
            maxLength={50}
            onTranscript={async (raw) => {
              if (!lineId) return;
              try {
                const res = await summarise.mutateAsync({ text: raw, lineId });
                setNarrative(res.summary.slice(0, 50));
              } catch {
                // Already shown as narrative raw; user can edit manually.
              }
            }}
          />
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

function Field({
  label,
  required,
  incomplete,
  children,
}: {
  label: string;
  required?: boolean;
  incomplete?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>
        {label}
        {required ? (
          <Text style={incomplete ? styles.asteriskRequired : styles.asteriskOk}> *</Text>
        ) : null}
      </Text>
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
  warnBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.warningSoft,
    padding: spacing.md,
    borderRadius: radii.field,
  },
  warnText: { flex: 1, fontSize: typography.bodySm, color: colors.textPrimary },
  label: { fontSize: typography.bodySm, color: colors.textSecondary, fontWeight: typography.medium },
  asteriskRequired: { color: colors.danger, fontWeight: typography.bold },
  asteriskOk: { color: colors.textMuted, fontWeight: typography.bold },
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
  retakeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.field,
    paddingVertical: spacing.md,
  },
  retakeText: {
    fontSize: typography.bodySm,
    fontWeight: typography.semibold,
    color: colors.accentInk,
  },
  netRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  netLabel: { fontSize: typography.bodySm, color: colors.textSecondary },
  netValue: { fontSize: typography.body, color: colors.textPrimary, fontWeight: typography.semibold },
  breakdownCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radii.card,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  breakdownTitle: {
    fontSize: typography.caption,
    fontWeight: typography.semibold,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  breakdownVatLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  breakdownLabel: { fontSize: typography.body, color: colors.textSecondary },
  breakdownValue: { fontSize: typography.body, color: colors.textPrimary, fontWeight: typography.medium },
  breakdownTotalRow: {
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  breakdownLabelStrong: { fontSize: typography.body, color: colors.textPrimary, fontWeight: typography.semibold },
  breakdownValueStrong: { fontSize: typography.h3, color: colors.textPrimary, fontWeight: typography.bold },
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
  aiBlock: {
    backgroundColor: colors.accentSoft,
    borderRadius: radii.field,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  aiHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  aiHeaderText: {
    flex: 1,
    fontSize: typography.caption,
    fontWeight: typography.semibold,
    color: colors.accentInk,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  aiChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  aiChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  aiChipText: {
    fontSize: typography.bodySm,
    fontWeight: typography.semibold,
    color: colors.accentInk,
  },
  aiChipScore: {
    fontSize: typography.caption,
    color: colors.accentInk,
  },
  aiChipTextActive: { color: colors.textOnAccent },
  aiExplanation: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    fontStyle: "italic",
  },
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
