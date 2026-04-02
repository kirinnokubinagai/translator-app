import * as Haptics from "expo-haptics";
import { ActivityIndicator, Pressable, Text, type ViewStyle } from "react-native";
import { THEME } from "@/constants/theme";
import { useSettingsStore } from "@/store/settings-store";

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
  primary: { bg: THEME.colors.primary, text: THEME.colors.surface },
  secondary: { bg: THEME.colors.background, text: THEME.colors.text },
  outline: { bg: "transparent", text: THEME.colors.primary, border: THEME.colors.primary },
  ghost: { bg: "transparent", text: THEME.colors.textSecondary },
  danger: { bg: THEME.colors.error, text: THEME.colors.surface },
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
      {loading ? <ActivityIndicator size="small" color={variantStyle.text} /> : null}
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
