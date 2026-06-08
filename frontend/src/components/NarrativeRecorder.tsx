import { Ionicons } from "@expo/vector-icons";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import * as Linking from "expo-linking";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { colors, radii, spacing, typography } from "@/src/theme/tokens";

/**
 * Voice + manual narrative field with on-device speech recognition.
 *
 * Behaviour:
 *  - Tap mic to start; tap again to stop.
 *  - While recording, a pulsing red dot is shown.
 *  - On stop, raw transcript is set into the editable field and onTranscript
 *    is invoked so the parent can call the summariser.
 *  - If permissions are denied, we surface a friendly toast with an
 *    "Open settings" button (only after a denial).
 */
export type NarrativeRecorderProps = {
  value: string;
  onChangeText: (v: string) => void;
  onTranscript?: (raw: string) => void;
  disabled?: boolean;
  busy?: boolean;
  maxLength?: number;
  placeholder?: string;
  testID?: string;
};

export function NarrativeRecorder({
  value,
  onChangeText,
  onTranscript,
  disabled,
  busy,
  maxLength = 50,
  placeholder = "What was this for?",
  testID,
}: NarrativeRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [partial, setPartial] = useState<string>("");
  const finalRef = useRef<string>("");
  const pulse = useRef(new Animated.Value(0)).current;
  const isWeb = Platform.OS === "web";

  // Loop pulse while recording
  useEffect(() => {
    if (!recording) {
      pulse.setValue(0);
      return;
    }
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [recording, pulse]);

  useSpeechRecognitionEvent("result", (e) => {
    const text = e.results?.[0]?.transcript ?? "";
    if (e.isFinal) {
      finalRef.current = text;
      setPartial("");
    } else {
      setPartial(text);
    }
  });
  useSpeechRecognitionEvent("end", () => {
    setRecording(false);
    const raw = (finalRef.current || partial || "").trim();
    if (raw) {
      onChangeText(raw.slice(0, maxLength));
      onTranscript?.(raw);
    }
    setPartial("");
    finalRef.current = "";
  });
  useSpeechRecognitionEvent("error", (e) => {
    setRecording(false);
    setPartial("");
    finalRef.current = "";
    if (e.error === "not-allowed" || e.error === "service-not-allowed") {
      Alert.alert(
        "Microphone access needed",
        "We use the mic to capture a quick voice memo for this expense. You can enable it in Settings.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ]
      );
    }
  });

  const onMicPress = useCallback(async () => {
    if (disabled || busy) return;
    if (isWeb) {
      Alert.alert(
        "Not available in web preview",
        "Voice capture works on iOS/Android. Test it on your device after a native build."
      );
      return;
    }
    if (recording) {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {
        // ignore
      }
      setRecording(false);
      return;
    }
    // Permissions
    try {
      const perm = await ExpoSpeechRecognitionModule.getPermissionsAsync();
      if (!perm.granted) {
        if (!perm.canAskAgain) {
          Alert.alert(
            "Microphone permission denied",
            "Please enable Microphone & Speech Recognition for this app in Settings.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Open Settings", onPress: () => Linking.openSettings() },
            ]
          );
          return;
        }
        const req = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!req.granted) {
          if (!req.canAskAgain) {
            Alert.alert(
              "Microphone permission denied",
              "Please enable Microphone & Speech Recognition for this app in Settings.",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Open Settings", onPress: () => Linking.openSettings() },
              ]
            );
          }
          return;
        }
      }
    } catch (e) {
      Alert.alert("Voice unavailable", "Speech recognition is not available on this device.");
      return;
    }

    finalRef.current = "";
    setPartial("");
    setRecording(true);
    try {
      ExpoSpeechRecognitionModule.start({
        lang: "en-GB",
        interimResults: true,
        maxAlternatives: 1,
        continuous: false,
        addsPunctuation: true,
        requiresOnDeviceRecognition: false,
      });
    } catch (e) {
      setRecording(false);
      Alert.alert("Voice unavailable", "Could not start speech recognition.");
    }
  }, [disabled, busy, recording, isWeb]);

  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] });

  return (
    <View style={{ gap: 6 }}>
      <View style={styles.row}>
        <TextInput
          testID={testID}
          value={recording ? partial || value : value}
          onChangeText={(t) => onChangeText(t.slice(0, maxLength))}
          editable={!disabled && !recording}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, disabled && styles.disabled]}
          multiline
        />
        <Pressable
          testID="narrative-mic"
          onPress={onMicPress}
          disabled={disabled || busy}
          style={[styles.mic, recording && styles.micActive]}
          hitSlop={10}
        >
          {busy ? (
            <ActivityIndicator color={recording ? "#fff" : colors.accent} />
          ) : recording ? (
            <Animated.View style={{ transform: [{ scale }], opacity }}>
              <Ionicons name="mic" size={22} color="#fff" />
            </Animated.View>
          ) : (
            <Ionicons name="mic-outline" size={22} color={colors.accent} />
          )}
        </Pressable>
      </View>
      <View style={styles.footer}>
        <Text style={styles.hint}>
          {recording
            ? "Listening… tap mic to stop"
            : busy
            ? "Summarising with AI…"
            : "Type or tap the mic to speak"}
        </Text>
        <Text style={styles.count}>{value.length}/{maxLength}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "stretch", gap: spacing.sm },
  input: {
    flex: 1,
    minHeight: 56,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radii.field,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    fontSize: typography.body,
    color: colors.textPrimary,
    textAlignVertical: "top",
  },
  disabled: { backgroundColor: colors.pageBg, color: colors.textSecondary },
  mic: {
    width: 56,
    minHeight: 56,
    borderRadius: radii.field,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  micActive: { backgroundColor: colors.danger, borderColor: colors.danger },
  footer: { flexDirection: "row", justifyContent: "space-between" },
  hint: { fontSize: typography.caption, color: colors.textMuted, fontStyle: "italic" },
  count: { fontSize: typography.caption, color: colors.textMuted },
});
