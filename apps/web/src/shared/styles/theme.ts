import {
  ActionIcon,
  Button,
  Paper,
  createTheme,
  virtualColor,
} from "@mantine/core";

const ink = [
  "#f4f2ef",
  "#dedbd6",
  "#c2beb8",
  "#9f9992",
  "#7b756f",
  "#5b5651",
  "#45413d",
  "#34312e",
  "#292724",
  "#1e1c1a",
] as const;

const cream = [
  "#fffdf9",
  "#f7f2ea",
  "#eee8df",
  "#e4dbcf",
  "#d5c9ba",
  "#c2b3a1",
  "#a89783",
  "#897662",
  "#685744",
  "#4b3d30",
] as const;

export const appTheme = createTheme({
  autoContrast: true,
  black: "#292724",
  white: "#fffdf9",
  colors: {
    ink,
    cream,
    brand: virtualColor({
      name: "brand",
      light: "ink",
      dark: "cream",
    }),
  },
  primaryColor: "brand",
  primaryShade: { light: 7, dark: 2 },
  cursorType: "pointer",
  defaultRadius: "md",
  fontFamily:
    '"Avenir Next", Avenir, "Segoe UI", Helvetica, Arial, sans-serif',
  headings: {
    fontFamily:
      '"Iowan Old Style", Baskerville, "Times New Roman", Times, serif',
    fontWeight: "400",
    textWrap: "balance",
    sizes: {
      h1: { fontSize: "clamp(3rem, 7vw, 6.5rem)", lineHeight: "0.96" },
      h2: { fontSize: "clamp(2.25rem, 5vw, 4.5rem)", lineHeight: "1" },
      h3: { fontSize: "clamp(1.75rem, 3vw, 2.75rem)", lineHeight: "1.08" },
    },
  },
  fontSizes: {
    xs: "0.75rem",
    sm: "0.875rem",
    md: "1rem",
    lg: "1.125rem",
    xl: "1.375rem",
  },
  lineHeights: {
    xs: "1.35",
    sm: "1.45",
    md: "1.55",
    lg: "1.5",
    xl: "1.4",
  },
  fontWeights: {
    regular: "400",
    medium: "500",
    bold: "600",
  },
  spacing: {
    xs: "0.5rem",
    sm: "0.75rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2.5rem",
  },
  radius: {
    xs: "0.375rem",
    sm: "0.625rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2.25rem",
  },
  shadows: {
    xs: "0 1px 2px rgba(41, 39, 36, 0.04)",
    sm: "0 6px 20px rgba(41, 39, 36, 0.06)",
    md: "0 16px 48px rgba(41, 39, 36, 0.08)",
    lg: "0 24px 72px rgba(41, 39, 36, 0.1)",
    xl: "0 32px 96px rgba(41, 39, 36, 0.12)",
  },
  respectReducedMotion: true,
  components: {
    ActionIcon: ActionIcon.extend({
      defaultProps: {
        radius: "xl",
      },
    }),
    Button: Button.extend({
      defaultProps: {
        radius: "xl",
        size: "md",
      },
    }),
    Paper: Paper.extend({
      defaultProps: {
        radius: "lg",
      },
    }),
  },
});
