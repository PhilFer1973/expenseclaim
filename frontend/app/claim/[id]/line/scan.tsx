import { Ionicons } from "@expo/vector-icons";
import {
  CameraView,
  useCameraPermissions,
  type CameraCapturedPicture,
} from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

// On-screen capture guide geometry. The captured photo is cropped to this
// region (mapped through the camera's "cover" scaling) so the receipt fills
// the analysed image regardless of how far away the phone is held.
const GUIDE_W_FRAC = 0.86; // guide width as a fraction of screen width
const GUIDE_ASPECT = 0.66; // guide width / height (portrait receipt shape)
const CROP_MARGIN = 1.08; // capture slightly larger than the guide so it can't clip

export default function ScanReceiptScreen() {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const router = useRouter();
  // `lineId` is present when retaking the photo for an existing line.
  const { id, lineId: existingLineId } = useLocalSearchParams<{ id: string; lineId?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [captured, setCaptured] = useState<Captured | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addLine = useAddLine(id);
  const uploadReceipt = useUploadReceipt(id);
  const extract = useExtractReceipt(id);
  const deleteLine = useDeleteLine(id);
  const [scanning, setScanning] = useState(false);
  // The line we've been working with this session (so retakes reuse it
  // instead of spawning orphan lines). Null until first save.
  const [workLineId, setWorkLineId] = useState<string | null>(existingLineId ?? null);
  // Set when extraction couldn't read the receipt reliably — we show a
  // "not readable" prompt instead of saving guessed values.
  const [notReadable, setNotReadable] = useState(false);

  const onCapture = async () => {
    try {
      setError(null);
      setWorking(true);
      const shot: CameraCapturedPicture | undefined = await cameraRef.current?.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
      });
      if (!shot) return;

      // Crop to the on-screen guide box so the receipt fills the analysed
      // image. The camera preview fills the screen using "cover" scaling, so a
      // photo pixel maps to `s` screen pixels; invert that to turn the centred
      // guide rectangle (screen px) into a centred crop on the full photo.
      const actions: ImageManipulator.Action[] = [];
      const s = Math.max(winW / shot.width, winH / shot.height);
      if (isFinite(s) && s > 0) {
        const guideWscreen = GUIDE_W_FRAC * winW;
        const guideHscreen = guideWscreen / GUIDE_ASPECT;
        let cropW = Math.round((guideWscreen / s) * CROP_MARGIN);
        let cropH = Math.round((guideHscreen / s) * CROP_MARGIN);
        cropW = Math.min(cropW, shot.width);
        cropH = Math.min(cropH, shot.height);
        const originX = Math.round((shot.width - cropW) / 2);
        const originY = Math.round((shot.height - cropH) / 2);
        actions.push({ crop: { originX, originY, width: cropW, height: cropH } });
        if (cropW > 1600) actions.push({ resize: { width: 1600 } });
      } else if (shot.width > 1600) {
        actions.push({ resize: { width: 1600 } });
      }
      const compressed = await ImageManipulator.manipulateAsync(shot.uri, actions, {
        compress: 0.7,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      });
      setCaptured({
        uri: compressed.uri,
        base64: compressed.base64 ?? "",
        width: compressed.width,
        height: compressed.height,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Capture failed");
    } finally {
      setWorking(false);
    }
  };

  const onSave = async () => {
    if (!captured?.base64) return;
    setError(null);
    setWorking(true);
    try {
      // 1. Reuse the line we're already working with (retake), else create one.
      const targetLineId =
        workLineId ?? (await addLine.mutateAsync({ receipt_status: "receipt" })).claim_line_id;
      setWorkLineId(targetLineId);
      // 2. Upload the image to that line (replaces any current image).
      await uploadReceipt.mutateAsync({
        lineId: targetLineId,
        image_base64: captured.base64,
        width: captured.width,
        height: captured.height,
      });
      // 3. Run Claude Vision extraction. Show the scanning overlay while it works.
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

      // 4. No guessing: if the receipt couldn't be read reliably, do NOT save
      //    guessed values — prompt the user to retake or enter without a receipt.
      // Only accept a clean, confident read. Anything blurry/low-confidence or
      // missing the total is sent back for a retake rather than saved wrong.
      const unreliable =
        !extracted ||
        extracted.image_quality !== "ok" ||
        (extracted.confidence ?? 0) < 0.8 ||
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

  const onRetakeFromFailure = () => {
    setNotReadable(false);
    setCaptured(null); // back to camera; workLineId is reused on next capture
  };

  const onEnterWithoutReceipt = async () => {
    setWorking(true);
    try {
      // Discard the unreadable scanned line, then go to manual no-receipt entry.
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

  if (!permission) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.root, styles.center, { padding: spacing.xl, paddingTop: insets.top + 80 }]}>
        <Ionicons name="camera-outline" size={48} color={colors.accent} />
        <Text style={styles.permissionTitle}>Camera access needed</Text>
        <Text style={styles.permissionBody}>
          We use the camera to capture receipts so AI can extract the details.
        </Text>
        <View style={{ width: "100%", gap: spacing.sm, marginTop: spacing.xl }}>
          <Button
            testID="scan-grant-camera"
            label="Allow camera"
            onPress={() => requestPermission()}
          />
          <Button
            testID="scan-cancel-perm"
            label="Not now"
            variant="ghost"
            onPress={() => router.back()}
          />
        </View>
      </View>
    );
  }

  // Not-readable state — extraction failed; never show guessed values.
  if (notReadable && captured) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable testID="scan-notreadable-back" onPress={onRetakeFromFailure} hitSlop={12}>
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
            We couldn&apos;t read this receipt clearly, so nothing has been filled in.
            Retake the photo for a clearer scan, or enter the details without a receipt.
          </Text>
        </View>
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button
            testID="scan-notreadable-retake"
            label="Retake photo"
            onPress={onRetakeFromFailure}
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

  // Preview state
  if (captured) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable testID="scan-discard" onPress={() => setCaptured(null)} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.title}>Preview</Text>
          <View style={{ width: 26 }} />
        </View>
        <View style={styles.previewWrap}>
          <Image source={{ uri: captured.uri }} style={styles.preview} resizeMode="contain" />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button
            testID="scan-retake"
            label="Retake"
            variant="secondary"
            onPress={() => setCaptured(null)}
            disabled={working}
          />
          <Button
            testID="scan-save"
            label="Use this receipt"
            onPress={onSave}
            loading={working}
          />
        </View>
        <ScanningOverlay visible={scanning} />
      </View>
    );
  }

  // Camera state
  return (
    <View style={styles.cameraRoot}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} facing="back" />

      {/* Screen-centred capture guide — the photo is cropped to this box. */}
      <View style={styles.guideLayer} pointerEvents="none">
        <View style={styles.frameWrap}>
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
        </View>
        <Text style={styles.hint}>
          Fill the box with the receipt — flat, in focus, well lit. Get close so the text is large and sharp.
        </Text>
      </View>

      <View style={[styles.cameraHeader, { top: insets.top + 12 }]}>
        <Pressable testID="scan-back" onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>
        <Text style={styles.cameraTitle}>Capture receipt</Text>
        <View style={{ width: 28 }} />
      </View>

      {error ? <Text style={[styles.error, styles.errorOnCam]}>{error}</Text> : null}

      <View style={[styles.shutterRow, { bottom: insets.bottom + spacing.xl }]}>
        <Pressable
          testID="scan-shutter"
          onPress={onCapture}
          disabled={working}
          style={styles.shutter}
        >
          <View style={styles.shutterInner} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  cameraRoot: { flex: 1, backgroundColor: "#000" },
  center: { alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: { fontSize: typography.h3, fontWeight: typography.semibold, color: colors.textPrimary },
  permissionTitle: {
    marginTop: spacing.lg,
    fontSize: typography.h2,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    textAlign: "center",
  },
  permissionBody: {
    marginTop: spacing.sm,
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: "center",
  },
  guideLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraHeader: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  cameraTitle: { color: "#fff", fontSize: typography.body, fontWeight: typography.semibold },
  errorOnCam: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    color: "#fff",
  },
  frameWrap: {
    width: `${GUIDE_W_FRAC * 100}%`,
    aspectRatio: GUIDE_ASPECT,
  },
  corner: {
    position: "absolute",
    width: 32,
    height: 32,
    borderColor: "#fff",
  },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  hint: {
    marginTop: spacing.lg,
    width: "86%",
    textAlign: "center",
    color: "#fff",
    fontSize: typography.caption,
    opacity: 0.9,
  },
  shutterRow: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fff",
  },
  previewWrap: {
    flex: 1,
    margin: spacing.lg,
    backgroundColor: "#000",
    borderRadius: radii.cardLarge,
    overflow: "hidden",
  },
  preview: { width: "100%", height: "100%" },
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
