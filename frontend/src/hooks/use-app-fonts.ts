/**
 * Hanken Grotesk font loader for Direction A design system.
 * Maps numeric React Native weights to the matching Hanken Grotesk family.
 */
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
  HankenGrotesk_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/hanken-grotesk";

export const FONT_MAP = {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
  HankenGrotesk_800ExtraBold,
};

export function useAppFonts(): readonly [boolean, Error | null] {
  return useFonts(FONT_MAP);
}

/** Mapping from numeric weight (string) to the Hanken Grotesk PostScript family. */
export const FAMILY_FOR_WEIGHT: Record<string, string> = {
  "400": "HankenGrotesk_400Regular",
  "500": "HankenGrotesk_500Medium",
  "600": "HankenGrotesk_600SemiBold",
  "700": "HankenGrotesk_700Bold",
  "800": "HankenGrotesk_800ExtraBold",
};

export const DEFAULT_FAMILY = "HankenGrotesk_400Regular";
