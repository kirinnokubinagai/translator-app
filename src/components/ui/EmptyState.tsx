import { View, Text } from "react-native";
import { THEME } from "@/constants/theme";

type EmptyStateProps = {
  icon: React.ReactNode;
  title: string;
  description?: string;
};

/**
 * 空状態コンポーネント
 */
export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
        gap: 12,
      }}
    >
      {icon}
      <Text
        style={{
          fontSize: 18,
          fontWeight: "600",
          color: THEME.colors.text,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
      {description ? (
        <Text
          style={{
            fontSize: 14,
            color: THEME.colors.textSecondary,
            textAlign: "center",
          }}
        >
          {description}
        </Text>
      ) : null}
    </View>
  );
}
