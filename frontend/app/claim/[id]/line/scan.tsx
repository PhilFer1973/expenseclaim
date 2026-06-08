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
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAddLine, useUploadReceipt } from "@/src/api/client";
import { Button } from "@/src/components/Button";
import { colors, radii, spacing, typography } from "@/src/theme/tokens";

type Captured = { uri: string; base64: string; width: number; height: number };

export default function ScanReceiptScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [captured, setCaptured] = useState<Captured | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addLine = useAddLine(id);
  const uploadReceipt = useUploadReceipt(id);

  const onCapture = async () => {
    try {
      setError(null);
      setWorking(true);
      const shot: CameraCapturedPicture | undefined = await cameraRef.current?.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
      });
      if (!shot) return;
      // Compress to <=200KB target: 1600px long edge + JPEG q=0.7
      const compressed = await ImageManipulator.manipulateAsync(
        shot.uri,
        [{ resize: { width: 1600 } }],
        {
          compress: 0.7,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );
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
      // 1. Create the line (receipt path; fields will be filled on review screen).
      const line = await addLine.mutateAsync({ receipt_status: "receipt" });
      // 2. Upload the image to that line.
      await uploadReceipt.mutateAsync({
        lineId: line.claim_line_id,
        image_base64: captured.base64,
        width: captured.width,
        height: captured.height,
      });
      // 3. Go to review screen to fill in supplier / amounts / category / narrative.
      router.replace(`/claim/${id}/line/${line.claim_line_id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
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
      </View>
    );
  }

  // Camera state
  return (
    <View style={styles.cameraRoot}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} facing="back" />
      <View style={[styles.cameraOverlay, { paddingTop: insets.top + 12 }]}>
        <View style={styles.cameraHeader}>
          <Pressable testID="scan-back" onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
          <Text style={styles.cameraTitle}>Capture receipt</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Edge-detection style frame */}
        <View style={styles.frameWrap}>
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
          <Text style={styles.hint}>Line up the receipt inside the frame</Text>
        </View>

        {error ? <Text style={[styles.error, { color: "#fff" }]}>{error}</Text> : null}

        <View style={[styles.shutterRow, { paddingBottom: insets.bottom + spacing.xl }]}>
          <View style={{ width: 56 }} />
          <Pressable
            testID="scan-shutter"
            onPress={onCapture}
            disabled={working}
            style={styles.shutter}
          >
            <View style={styles.shutterInner} />
          </Pressable>
          <View style={{ width: 56 }} />
        </View>
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
  cameraOverlay: { flex: 1, justifyContent: "space-between" },
  cameraHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  cameraTitle: { color: "#fff", fontSize: typography.body, fontWeight: typography.semibold },
  frameWrap: {
    alignSelf: "center",
    width: "80%",
    aspectRatio: 0.7,
    justifyContent: "flex-end",
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
    position: "absolute",
    bottom: -28,
    alignSelf: "center",
    color: "#fff",
    fontSize: typography.caption,
    opacity: 0.85,
  },
  shutterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xl,
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
});
