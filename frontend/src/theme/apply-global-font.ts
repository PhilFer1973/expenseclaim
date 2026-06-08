/**
 * Apply Hanken Grotesk globally to all RN <Text> and <TextInput> components.
 *
 * We patch the defaultProps once at module load. The patch ensures the
 * fontFamily reflects the requested numeric `fontWeight` so weight semantics
 * are preserved even on Android (where fontWeight alone doesn't pick the
 * right Hanken Grotesk PostScript family).
 */
import { Text, TextInput, StyleSheet, type TextStyle } from "react-native";

import { DEFAULT_FAMILY, FAMILY_FOR_WEIGHT } from "@/src/hooks/use-app-fonts";

type AnyTextStyle = TextStyle | TextStyle[] | null | undefined | false;

function pickWeight(style: AnyTextStyle): string | undefined {
  const flat = StyleSheet.flatten(style as TextStyle);
  if (!flat || typeof flat !== "object") return undefined;
  const w = (flat as TextStyle).fontWeight;
  if (typeof w === "string" || typeof w === "number") return String(w);
  return undefined;
}

function withFontFamily<P extends { style?: AnyTextStyle }>(props: P): P {
  const weight = pickWeight(props.style);
  const family = (weight && FAMILY_FOR_WEIGHT[weight]) || DEFAULT_FAMILY;
  return {
    ...props,
    style: [{ fontFamily: family }, props.style] as unknown as P["style"],
  };
}

let applied = false;
export function applyGlobalFont() {
  if (applied) return;
  applied = true;

  // Text
  // @ts-expect-error - defaultProps is private API but stable enough.
  const TextRender = Text.render;
  // @ts-expect-error
  Text.render = function patchedTextRender(...args: unknown[]) {
    const props = args[0] as Record<string, unknown> & { style?: AnyTextStyle };
    args[0] = withFontFamily(props);
    return TextRender.apply(this, args as Parameters<typeof TextRender>);
  };

  // TextInput
  // @ts-expect-error
  const TextInputRender = TextInput.render;
  if (TextInputRender) {
    // @ts-expect-error
    TextInput.render = function patchedTextInputRender(...args: unknown[]) {
      const props = args[0] as Record<string, unknown> & { style?: AnyTextStyle };
      args[0] = withFontFamily(props);
      return TextInputRender.apply(this, args as Parameters<typeof TextInputRender>);
    };
  } else {
    // Fallback: defaultProps for TextInput where .render isn't exposed.
    // @ts-expect-error
    const existing = TextInput.defaultProps || {};
    // @ts-expect-error
    TextInput.defaultProps = {
      ...existing,
      style: [{ fontFamily: DEFAULT_FAMILY }, existing.style],
    };
  }
}
