/** テーマカラー定数 */
export const THEME = {
  colors: {
    primary: "#14b8a6",
    primaryDark: "#0d9488",
    primaryLight: "#ccfbf1",
    background: "#fafaf9",
    surface: "#ffffff",
    text: "#1c1917",
    textSecondary: "#78716c",
    textMuted: "#a8a29e",
    border: "#e7e5e4",
    error: "#ef4444",
    errorLight: "#fee2e2",
    success: "#22c55e",
    successLight: "#dcfce7",
    warning: "#f59e0b",
    warningLight: "#fef3c7",
    info: "#3b82f6",
    infoLight: "#dbeafe",
    subtitleBackground: "#1c1917",
    subtitleText: "#fafaf9",
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    full: 9999,
  },
} as const;

/** タブバーの高さ */
export const TAB_BAR_HEIGHT = 80;
