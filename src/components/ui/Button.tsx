import { Pressable, Text, ActivityIndicator, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { useSettingsStore } from "@/store/settings-store";
import { THEME } from "@/constants/theme";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = {
  children: React.ReactNode;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
};

const VARIANT_STYLES: Record<ButtonVariant, { bg: string; text: string; border?: string }> = {
  primary: { bg: "#14b8a6", text: "#ffffff" },
  secondary: { bg: "#f5f5f4", text: "#1c1917" },
  outline: { bg: "transparent", text: "#14b8a6", border: "#14b8a6" },
  ghost: { bg: "transparent", text: "#78716c" },
  danger: { bg: "#ef4444", text: "#ffffff" },
};

const SIZE_STYLES: Record<ButtonSize, { paddingH: number; paddingV: number; fontSize: number }> = {
  sm: { paddingH: 12, paddingV: 6, fontSize: 14 },
  md: { paddingH: 20, paddingV: 12, fontSize: 16 },
  lg: { paddingH: 28, paddingV: 16, fontSize: 18 },
};

/**
 * 汎用ボタンコンポーネント
 */
export function Button({
  children,
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const { hapticFeedback } = useSettingsStore();
  const variantStyle = VARIANT_STYLES[variant];
  const sizeStyle = SIZE_STYLES[size];

  const handlePress = () => {
    if (disabled || loading) return;
    if (hapticFeedback) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          backgroundColor: variantStyle.bg,
          paddingHorizontal: sizeStyle.paddingH,
          paddingVertical: sizeStyle.paddingV,
          borderRadius: THEME.borderRadius.md,
          borderWidth: variantStyle.border ? 1 : 0,
          borderColor: variantStyle.border,
          opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variantStyle.text} />
      ) : null}
      {typeof children === "string" ? (
        <Text
          style={{
            color: variantStyle.text,
            fontSize: sizeStyle.fontSize,
            fontWeight: "600",
          }}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}
