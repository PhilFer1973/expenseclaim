import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { colors, shadow, typography } from "@/src/theme/tokens";

export function Fab({
  onPress,
  label = "New claim",
  testID,
  bottom = 24,
}: {
  onPress: () => void;
  label?: string;
  testID?: string;
  bottom?: number;
}) {
  return (
    <Pressable
      testID={testID ?? "fab"}
      onPress={onPress}
      style={({ pressed }) => [styles.fab, { bottom }, pressed && { opacity: 0.85 }]}
    >
      <Ionicons name="add" size={20} color={colors.textOnAccent} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.accent,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 99,
    ...shadow.fab,
  },
  label: {
    color: colors.textOnAccent,
    fontWeight: typography.bold,
    fontSize: typography.body,
  },
});
