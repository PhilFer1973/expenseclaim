import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing, typography } from "@/src/theme/tokens";

/**
 * Full-screen "Scanning…" overlay shown while Claude Vision processes a receipt.
 * Pure RN (no extra libs) — a softly pulsing sparkles icon with a moving
 * gradient bar underneath.
 */
export function ScanningOverlay({
  visible,
  label = "Scanning receipt…",
  subline = "Reading supplier, date and amounts",
}: {
  visible: boolean;
  label?: string;
  subline?: string;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    pulse.setValue(0);
    sweep.setValue(0);
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
    Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    ).start();
  }, [visible, pulse, sweep]);

  if (!visible) return null;

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  const translateX = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: ["-100%", "100%"],
  });

  return (
    <View style={styles.root} pointerEvents="auto">
      <View style={styles.card}>
        <Animated.View style={[styles.iconWrap, { transform: [{ scale }], opacity }]}>
          <Ionicons name="sparkles" size={36} color={colors.accent} />
        </Animated.View>
        <Text style={styles.title}>{label}</Text>
        <Text style={styles.subline}>{subline}</Text>
        <View style={styles.track}>
          <Animated.View style={[styles.bar, { transform: [{ translateX }] }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8, 14, 26, 0.78)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    zIndex: 50,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radii.cardLarge,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: typography.h3,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    textAlign: "center",
  },
  subline: {
    fontSize: typography.bodySm,
    color: colors.textSecondary,
    textAlign: "center",
  },
  track: {
    width: "100%",
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accentSoft,
    overflow: "hidden",
    marginTop: spacing.sm,
  },
  bar: {
    width: "60%",
    height: "100%",
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
});
