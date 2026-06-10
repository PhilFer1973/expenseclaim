// "Frosted Blue" design tokens.
// Light blue-grey background, translucent white glass panels, blue accents.

export const colors = {
  // Brand
  accent: "#2563eb",
  accentInk: "#1d4ed8",
  accentSoft: "#dbeafe",

  // Surfaces
  pageBg: "#e9edf5",                          // light blue-grey page background
  surface: "rgba(255,255,255,0.55)",           // frosted white glass panel
  surfaceSolid: "#dde6f5",                    // opaque equivalent for nav/tabs
  surfaceHighlight: "rgba(255,255,255,0.80)", // top-edge bright rim
  surfaceShade: "rgba(16,23,41,0.04)",        // subtle inner shadow at bottom
  hairline: "rgba(255,255,255,0.65)",         // panel border

  // Text
  textPrimary: "#0f172a",
  textSecondary: "#64748b",
  textMuted: "#94a3b8",
  textOnAccent: "#ffffff",

  // Status
  success: "#0f9d58",
  successSoft: "#e6f5ed",
  warning: "#d97706",
  warningSoft: "#fef3c7",
  danger: "#dc2626",
  dangerSoft: "#fee2e2",

  // VAT code badge colours
  vatUK20Bg: "#e6f5ed",
  vatUK20Fg: "#0f9d58",
  vatUK0Bg: "#dbeafe",
  vatUK0Fg: "#2563eb",
  vatUNRECBg: "#f1f5f9",
  vatUNRECFg: "#64748b",
  vatREVIEWBg: "#fef3c7",
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
    shadowColor: "#1e3a8a",
    shadowOpacity: 0.10,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  fab: {
    shadowColor: "#1e3a8a",
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
} as const;

export const tokens = { colors, radii, spacing, typography, shadow };
export default tokens;
