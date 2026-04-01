import { Pressable, Text, View } from "react-native";
import { Coins } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useQuotaStore } from "@/store/quota-store";
import { THEME } from "@/constants/theme";
import { QUOTA_LOW_THRESHOLD } from "@/constants/quota";

/**
 * バッジの色を残高状態から決定する
 */
function getBadgeColor(isEmpty: boolean, isLow: boolean): string {
  if (isEmpty) return THEME.colors.error;
  if (isLow) return THEME.colors.warning;
  return THEME.colors.primary;
}

/**
 * ヘッダー用クォータ残高バッジ
 */
export function QuotaBadge() {
  const router = useRouter();
  const balance = useQuotaStore((s) => s.balance);

  const isLow = balance <= QUOTA_LOW_THRESHOLD && balance > 0;
  const isEmpty = balance <= 0;

  const badgeColor = getBadgeColor(isEmpty, isLow);

  return (
    <Pressable
      onPress={() => router.push("/quota")}
      hitSlop={8}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        marginRight: 12,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: THEME.borderRadius.full,
        backgroundColor: pressed ? THEME.colors.border : `${badgeColor}15`,
        borderWidth: 1,
        borderColor: `${badgeColor}30`,
      })}
    >
      <Coins size={14} color={badgeColor} />
      <Text
        style={{
          fontSize: 13,
          fontWeight: "700",
          color: badgeColor,
        }}
      >
        {balance}
      </Text>
    </Pressable>
  );
}
