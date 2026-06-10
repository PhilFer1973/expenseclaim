import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";

import { colors, radii, shadow } from "@/src/theme/tokens";

/**
 * Frosted-blue glass panel.
 *
 * Renders a translucent white panel with:
 *  - semi-transparent white base (rgba(255,255,255,0.55))
 *  - soft linear gradient: bright top highlight → near-clear → faint blue tint
 *  - a 1px rim border via shadow.card
 *  - a narrow bright sheen strip along the top edge
 *
 * Width/spacing are inherited from children; this component only paints
 * the background layer. Wrap any card content with this.
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
  /** 0..1 — overall glass intensity (1 = max). Defaults to 1. */
  intensity?: number;
}) {
  const sheenTop = `rgba(255,255,255,${0.45 * intensity})`;
  const sheenMid = `rgba(255,255,255,${0.05 * intensity})`;
  const sheenBot = `rgba(37,99,235,${0.04 * intensity})`; // faint blue tint at bottom
  return (
    <View
      testID={testID}
      style={[styles.shell, { borderRadius: radius }, style]}
    >
      <LinearGradient
        colors={[sheenTop, sheenMid, sheenBot]}
        locations={[0, 0.5, 1]}
        start={{ x: 0.1, y: 0.0 }}
        end={{ x: 0.9, y: 1.0 }}
        style={[StyleSheet.absoluteFillObject, { borderRadius: radius }]}
        pointerEvents="none"
      />
      {/* Bright top sheen strip */}
      <LinearGradient
        colors={["rgba(255,255,255,0.60)", "rgba(255,255,255,0)"]}
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
    backgroundColor: colors.surface,
    overflow: "hidden",
    ...shadow.card,
  },
  sheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 18,
    opacity: 0.65,
  },
});
