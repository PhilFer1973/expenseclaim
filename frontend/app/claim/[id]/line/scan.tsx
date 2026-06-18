import { Ionicons } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DocumentScanner from "react-native-document-scanner-plugin";

import {
  useAddLine,
  useDeleteLine,
  useExtractReceipt,
  useUploadReceipt,
} from "@/src/api/client";
import { Button } from "@/src/components/Button";
import { ScanningOverlay } from "@/src/components/ScanningOverlay";
import { colors, radii, spacing, typography } from "@/src/theme/tokens";

type Captured = { uri: string; base64: string; width: number; height: number };

export default function ScanReceiptScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // `lineId` is present when retaking the photo for an existing line.
  const { id, lineId: existingLineId } = useLocalSearchParams<{ id: string; lineId?: string }>();

  const [captured, setCaptured] = useState<Captured | null>(null);
  const [working, setWorking] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notReadable, setNotReadable] = useState(false);
  const [workLineId, setWorkLineId] = useState<string | null>(existingLineId ?? null);
  const launchedRef = useRef(false);

  const addLine = useAddLine(id);
  const uploadReceipt = useUploadReceipt(id);
  const extract = useExtractReceipt(id);
  const deleteLine = useDeleteLine(id);

  // Open the native document scanner: it detects the receipt edges, lets the
  // user adjust corners, corrects perspective and returns a clean cropped
  // image. That cleaned image is what we send to the Claude Vision API.
  const launchScanner = useCallback(async () => {
    setError(null);
    setNotReadable(false);
    try {
      const { scannedImages } = await DocumentScanner.scanDocument({
        maxNumDocuments: 1,
        croppedImageQuality: 100,
      });
      if (!scannedImages || scannedImages.length === 0) {
        // User cancelled the scanner. Leave the screen if nothing captured yet.
        setCaptured((prev) => {
          if (!prev) router.back();
          return prev;
        });
        return;
      }
      setWorking(true);
      const uri = scannedImages[0];
      const info = await ImageManipulator.manipulateAsync(uri, [], {});
      const longest = Math.max(info.width, info.height);
      const ops =
        longest > 2000
          ? [{ resize: info.width >= info.height ? { width: 2000 } : { height: 2000 } }]
          : [];
      const processed = await ImageManipulator.manipulateAsync(uri, ops, {
        compress: 0.8,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      });
      setCaptured({
        uri: processed.uri,
        base64: processed.base64 ?? "",
        width: processed.width,
        height: processed.height,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setWorking(false);
    }
  }, [router]);

  // Auto-open the scanner once when the screen mounts.
  useEffect(() => {
    if (launchedRef.current) return;
    launchedRef.current = true;
    launchScanner();
  }, [launchScanner]);

  const onSave = async () => {
    if (!captured?.base64) return;
    setError(null);
    setWorking(true);
    try {
      // 1. Reuse the line we're already working with (retake), else create one.
      const targetLineId =
        workLineId ?? (await addLine.mutateAsync({ receipt_status: "receipt" })).claim_line_id;
      setWorkLineId(targetLineId);
      // 2. Upload the cleaned image to that line (replaces any current image).
      await uploadReceipt.mutateAsync({
        lineId: targetLineId,
        image_base64: captured.base64,
        width: captured.width,
        height: captured.height,
      });
      // 3. Claude Vision extraction — the star of the show. Overlay while it works.
      setScanning(true);
      let extracted: Awaited<ReturnType<typeof extract.mutateAsync>>["extracted"] | null = null;
      try {
        const res = await extract.mutateAsync({ lineId: targetLineId });
        extracted = res.extracted;
      } catch (extractError) {
        // eslint-disable-next-line no-console
        console.warn("Vision extract failed", extractError);
      } finally {
        setScanning(false);
      }

      // 4. No guessing: only accept a sharp, confident read. A "blurry" image
      //    makes the model confabulate amounts, so bounce it for a rescan.
      const unreliable =
        !extracted ||
        extracted.image_quality !== "ok" ||
        (extracted.confidence ?? 0) < 0.7 ||
        extracted.gross_amount == null;
      if (unreliable) {
        setNotReadable(true);
        setWorking(false);
        return;
      }

      // 5. Good extraction — go to the line detail to confirm the fields.
      router.replace(`/claim/${id}/line/${targetLineId}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setScanning(false);
      setWorking(false);
    }
  };

  const onEnterWithoutReceipt = async () => {
    setWorking(true);
    try {
      if (workLineId) {
        try {
          await deleteLine.mutateAsync(workLineId);
        } catch {
          // Best-effort cleanup; proceed regardless.
        }
      }
      router.replace(`/claim/${id}/line/no-receipt`);
    } finally {
      setWorking(false);
    }
  };

  // Not-readable state — extraction failed; never show guessed values.
  if (notReadable && captured) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable testID="scan-notreadable-back" onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.title}>Couldn&apos;t read receipt</Text>
          <View style={{ width: 26 }} />
        </View>
        <View style={styles.previewWrap}>
          <Image source={{ uri: captured.uri }} style={styles.preview} resizeMode="contain" />
        </View>
        <View style={styles.notReadableBanner}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
          <Text style={styles.warnText}>
            This photo was too blurry to read accurately, so nothing has been
            filled in. For a sharp scan: lay the receipt flat on a surface, keep
            your fingers off the text, use good light, and hold the phone steady
            and parallel until it focuses. Then rescan — or enter without a receipt.
          </Text>
        </View>
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button
            testID="scan-notreadable-retake"
            label="Rescan"
            onPress={launchScanner}
            disabled={working}
          />
          <Button
            testID="scan-notreadable-noreceipt"
            label="Enter without receipt"
            variant="secondary"
            onPress={onEnterWithoutReceipt}
            loading={working}
          />
        </View>
      </View>
    );
  }

  // Preview state — the cleaned scan, ready to send to Vision.
  if (captured) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable testID="scan-discard" onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.title}>Preview</Text>
          <View style={{ width: 26 }} />
        </View>
        <View style={styles.previewWrap}>
          <Image source={{ uri: captured.uri }} style={styles.preview} resizeMode="contain" />
        </View>
        <Text style={styles.previewHint}>
          Make sure the supplier, date and totals are sharp and fully visible.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button
            testID="scan-retake"
            label="Rescan"
            variant="secondary"
            onPress={launchScanner}
            disabled={working}
          />
          <Button testID="scan-save" label="Use this receipt" onPress={onSave} loading={working} />
        </View>
        <ScanningOverlay visible={scanning} />
      </View>
    );
  }

  // Launching / processing the scanner.
  return (
    <View style={[styles.root, styles.center]}>
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.loadingText}>
        {working ? "Preparing image…" : "Opening scanner…"}
      </Text>
      {error ? (
        <>
          <Text style={[styles.error, { marginTop: spacing.lg }]}>{error}</Text>
          <View style={{ width: "70%", gap: spacing.sm, marginTop: spacing.lg }}>
            <Button testID="scan-retry" label="Try again" onPress={launchScanner} />
            <Button testID="scan-cancel" label="Go back" variant="ghost" onPress={() => router.back()} />
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  center: { alignItems: "center", justifyContent: "center", padding: spacing.xl },
  loadingText: { marginTop: spacing.md, fontSize: typography.body, color: colors.textSecondary },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: { fontSize: typography.h3, fontWeight: typography.semibold, color: colors.textPrimary },
  previewWrap: {
    flex: 1,
    margin: spacing.lg,
    backgroundColor: "#000",
    borderRadius: radii.cardLarge,
    overflow: "hidden",
  },
  preview: { width: "100%", height: "100%" },
  previewHint: {
    textAlign: "center",
    paddingHorizontal: spacing.lg,
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  error: {
    color: colors.danger,
    fontSize: typography.bodySm,
    textAlign: "center",
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  footer: {
    padding: spacing.lg,
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  notReadableBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.warningSoft,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.field,
  },
  warnText: { flex: 1, fontSize: typography.bodySm, color: colors.textPrimary },
});
