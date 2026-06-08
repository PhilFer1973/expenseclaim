// Direction A — "Clean & Corporate" design tokens.
// Source: project pack `Direction-A.html` README.

export const colors = {
  // Brand
  accent: "#2563eb",
  accentInk: "#1d4ed8",
  accentSoft: "#eef3ff",

  // Surfaces — light metallic grey background, slightly DARKER grey glass panes
  pageBg: "#eef1f6",                        // light metallic grey
  surface: "#c9d0db",                       // darker grey pane base (glass tint)
  surfaceSolid: "#c9d0db",                  // opaque equivalent
  surfaceHighlight: "rgba(255,255,255,0.85)", // top-edge bright rim
  surfaceShade: "rgba(15, 23, 42, 0.06)",   // subtle inner darken at bottom
  hairline: "#b4bbc6",

  // Text
  textPrimary: "#101729",
  textSecondary: "#5b6577",
  textMuted: "#8b95a7",
  textOnAccent: "#ffffff",

  // Status
  success: "#0f9d58",
  successSoft: "#e6f5ed",
  warning: "#d97706",
  warningSoft: "#fdf1e0",
  danger: "#dc2626",
  dangerSoft: "#fde8e8",

  // VAT code badge colours (derived from status palette)
  vatUK20Bg: "#e6f5ed",
  vatUK20Fg: "#0f9d58",
  vatUK0Bg: "#eef3ff",
  vatUK0Fg: "#2563eb",
  vatUNRECBg: "#f1f1f4",
  vatUNRECFg: "#5b6577",
  vatREVIEWBg: "#fdf1e0",
  vatREVIEWFg: "#d97706",
} as const;

export const radii = {
  field: 12,
  card: 16,
  cardLarge: 20,
  pill: 99,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const typography = {
  family: "HankenGrotesk",
  // Sizes
  display: 32,
  h1: 24,
  h2: 20,
  h3: 18,
  body: 15,
  bodySm: 14,
  caption: 12,
  micro: 11.5,
  // Weights (numeric for RN)
  regular: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
  extrabold: "800" as const,
} as const;

export const shadow = {
  card: {
    shadowColor: "#0b1220",
    shadowOpacity: 0.12,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
    borderWidth: 1.5,
    borderColor: colors.surfaceHighlight,
  },
  fab: {
    shadowColor: "#0b1220",
    shadowOpacity: 0.22,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
} as const;

export const tokens = { colors, radii, spacing, typography, shadow };
export default tokens;
