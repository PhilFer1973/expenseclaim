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
  const fillTop = `rgba(255,255,255,${0.85 * intensity})`;
  const fillMid = `rgba(255,255,255,${0.55 * intensity})`;
  const fillBot = `rgba(255,255,255,${0.35 * intensity})`;
  return (
    <View
      testID={testID}
      style={[styles.shell, { borderRadius: radius }, style]}
    >
      <LinearGradient
        colors={[fillTop, fillMid, fillBot]}
        locations={[0, 0.45, 1]}
        start={{ x: 0.0, y: 0.0 }}
        end={{ x: 1.0, y: 1.0 }}
        style={[StyleSheet.absoluteFillObject, { borderRadius: radius }]}
        pointerEvents="none"
      />
      {/* Top sheen */}
      <LinearGradient
        colors={["rgba(255,255,255,0.9)", "rgba(255,255,255,0)"]}
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
