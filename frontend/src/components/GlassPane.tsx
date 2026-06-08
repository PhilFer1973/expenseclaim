import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";

import { colors, radii, shadow } from "@/src/theme/tokens";

/**
 * Reusable glass-pane container.
 *
 * Renders a translucent glass card with:
 *  - subtle linear gradient fill (top-left highlight → soft bottom)
 *  - a 1.5 px bright rim (via shadow.card border)
 *  - a strong soft drop-shadow
 *  - an additional inner "sheen" line near the top edge
 *
 * Wrap any card content with this. Width/spacing are inherited from the
 * children container; we only paint the background layer.
 */
export function GlassPane({
  children,
  style,
  radius = radii.card,
  testID,
  intensity = 1,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  radius?: number;
  testID?: string;
  /** 0..1 — overall glass intensity (1 = max bright). Defaults to 1. */
  intensity?: number;
}) {
  // Soft white sheen that sits ON TOP of the darker grey base — gives a
  // glass-like highlight while preserving the darker grey colour.
  const sheenTop = `rgba(255,255,255,${0.32 * intensity})`;
  const sheenMid = `rgba(255,255,255,${0.08 * intensity})`;
  const sheenBot = `rgba(15,23,42,${0.05 * intensity})`;
  return (
    <View
      testID={testID}
      style={[styles.shell, { borderRadius: radius }, style]}
    >
      <LinearGradient
        colors={[sheenTop, sheenMid, sheenBot]}
        locations={[0, 0.55, 1]}
        start={{ x: 0.1, y: 0.0 }}
        end={{ x: 0.9, y: 1.0 }}
        style={[StyleSheet.absoluteFillObject, { borderRadius: radius }]}
        pointerEvents="none"
      />
      {/* Bright top sheen strip */}
      <LinearGradient
        colors={["rgba(255,255,255,0.7)", "rgba(255,255,255,0)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.sheen, { borderTopLeftRadius: radius, borderTopRightRadius: radius }]}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: colors.surface, // rgba semi-transparent
    overflow: "hidden",
    ...shadow.card,
  },
  sheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 16,
    opacity: 0.55,
  },
});
