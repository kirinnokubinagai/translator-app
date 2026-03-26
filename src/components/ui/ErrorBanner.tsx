import { View, Text, Pressable } from "react-native";
import { AlertCircle, X } from "lucide-react-native";
import { THEME } from "@/constants/theme";

type ErrorBannerProps = {
  message: string;
  onDismiss?: () => void;
  onRetry?: () => void;
};

/**
 * エラーバナーコンポーネント
 */
export function ErrorBanner({ message, onDismiss, onRetry }: ErrorBannerProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: THEME.colors.errorLight,
        borderRadius: THEME.borderRadius.md,
        padding: 12,
        gap: 8,
      }}
    >
      <AlertCircle size={20} color={THEME.colors.error} />
      <Text
        style={{ flex: 1, fontSize: 14, color: THEME.colors.error }}
        numberOfLines={2}
      >
        {message}
      </Text>
      {onRetry ? (
        <Pressable onPress={onRetry}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: THEME.colors.error,
            }}
          >
            再試行
          </Text>
        </Pressable>
      ) : null}
      {onDismiss ? (
        <Pressable onPress={onDismiss}>
          <X size={18} color={THEME.colors.error} />
        </Pressable>
      ) : null}
    </View>
  );
}
