import { useRouter } from "expo-router";
import { Coins, Play, ShoppingCart, X } from "lucide-react-native";
import { Modal, Pressable, Text, View } from "react-native";
import { AD_REWARD_QUOTA } from "@/constants/quota";
import { THEME } from "@/constants/theme";
import { useT } from "@/i18n";

type QuotaEmptyModalProps = {
  visible: boolean;
  onClose: () => void;
  onWatchAd: () => void;
  isAdReady: boolean;
};

/**
 * クォータ不足時のモーダル
 */
export function QuotaEmptyModal({ visible, onClose, onWatchAd, isAdReady }: QuotaEmptyModalProps) {
  const router = useRouter();
  const t = useT();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.5)",
          padding: 24,
        }}
      >
        <View
          style={{
            backgroundColor: THEME.colors.surface,
            borderRadius: THEME.borderRadius.lg,
            padding: 24,
            width: "100%",
            maxWidth: 340,
          }}
        >
          {/* 閉じるボタン */}
          <Pressable
            onPress={onClose}
            accessibilityLabel={t("accessibility.close")}
            accessibilityRole="button"
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              padding: 4,
            }}
          >
            <X size={20} color={THEME.colors.textMuted} />
          </Pressable>

          {/* アイコン */}
          <View style={{ alignItems: "center", marginBottom: 16 }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: `${THEME.colors.warning}15`,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Coins size={28} color={THEME.colors.warning} />
            </View>
          </View>

          {/* タイトル */}
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: THEME.colors.text,
              textAlign: "center",
              marginBottom: 8,
            }}
          >
            {t("quota.insufficient")}
          </Text>

          <Text
            style={{
              fontSize: 14,
              color: THEME.colors.textSecondary,
              textAlign: "center",
              marginBottom: 24,
              lineHeight: 20,
            }}
          >
            {t("quota.insufficientDescription")}
          </Text>

          {/* 広告視聴ボタン */}
          <Pressable
            onPress={onWatchAd}
            disabled={!isAdReady}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              paddingVertical: 14,
              borderRadius: THEME.borderRadius.lg,
              backgroundColor: isAdReady
                ? pressed
                  ? THEME.colors.primaryDark
                  : THEME.colors.primary
                : THEME.colors.border,
              marginBottom: 12,
            })}
          >
            <Play size={18} color="#fff" />
            <Text style={{ fontSize: 15, fontWeight: "600", color: "#fff" }}>
              {isAdReady
                ? t("quota.watchAdButton", { amount: String(AD_REWARD_QUOTA) })
                : t("quota.adPreparing")}
            </Text>
          </Pressable>

          {/* 購入ボタン */}
          <Pressable
            onPress={() => {
              onClose();
              router.push("/quota");
            }}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              paddingVertical: 14,
              borderRadius: THEME.borderRadius.lg,
              backgroundColor: pressed ? THEME.colors.border : "transparent",
              borderWidth: 1,
              borderColor: THEME.colors.border,
              marginBottom: 0,
            })}
          >
            <ShoppingCart size={18} color={THEME.colors.text} />
            <Text
              style={{
                fontSize: 15,
                fontWeight: "600",
                color: THEME.colors.text,
              }}
            >
              {t("quota.purchaseButton")}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
