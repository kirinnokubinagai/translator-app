import { Coins, Package, Play, TrendingUp } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { AD_REWARD_QUOTA, QUOTA_PACKS } from "@/constants/quota";
import { THEME } from "@/constants/theme";
import { useQuota } from "@/hooks/use-quota";
import { useT } from "@/i18n";
import {
  isRewardedAdReady,
  preloadRewardedAd,
  showRewardedAd,
  subscribeRewardedAdReady,
} from "@/services/ads/rewarded-ad";
import { consumeAdNonce, requestAdNonce } from "@/services/api/quota";
import {
  getOfferings,
  getRevenueCatAppUserId,
  initRevenueCat,
  purchasePackage,
} from "@/services/purchases/revenuecat";
import type { QuotaPackType } from "@/types/quota";

/**
 * クォータ管理・購入画面
 */
export default function QuotaScreen() {
  const { balance, isLoading, error, watchAdForQuota, purchasePack, syncBalance, clearError } =
    useQuota();
  const t = useT();

  const [purchasing, setPurchasing] = useState(false);
  const [adReady, setAdReady] = useState(isRewardedAdReady());
  const [purchaseAvailable, setPurchaseAvailable] = useState(false);

  useEffect(() => {
    initRevenueCat().then((ok) => setPurchaseAvailable(ok));
    preloadRewardedAd();
    return subscribeRewardedAdReady(setAdReady);
  }, []);

  const handleWatchAd = useCallback(async () => {
    const nonceReady = await requestAdNonce();
    if (!nonceReady) return;
    const rewarded = await showRewardedAd();
    if (!rewarded) {
      consumeAdNonce();
      return;
    }
    const nonce = consumeAdNonce();
    if (!nonce) return;
    await watchAdForQuota(nonce);
    await syncBalance();
  }, [syncBalance, watchAdForQuota]);

  const handlePurchase = useCallback(
    async (pack: QuotaPackType) => {
      setPurchasing(true);
      try {
        const offerings = await getOfferings();
        const pkg = offerings.find((p) => p.product.identifier.includes(pack));
        if (!pkg) {
          throw new Error(t("quota.packageNotFound"));
        }
        const customerInfo = await purchasePackage(pkg);
        if (customerInfo) {
          const transactions = customerInfo.nonSubscriptionTransactions ?? [];
          const latestTx = transactions
            .filter((tx) => tx.productIdentifier === pkg.product.identifier)
            .pop();
          if (!latestTx?.transactionIdentifier) {
            throw new Error(t("quota.transactionNotFound"));
          }
          const transactionId = latestTx.transactionIdentifier;
          const appUserId = (await getRevenueCatAppUserId()) ?? undefined;
          await purchasePack(pack, transactionId, pkg.product.identifier, appUserId);
        }
      } finally {
        setPurchasing(false);
      }
    },
    [purchasePack, t],
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: THEME.colors.background }}
      contentContainerStyle={{ padding: 20 }}
    >
      {error ? (
        <Pressable
          onPress={clearError}
          style={{
            backgroundColor: THEME.colors.errorLight,
            borderWidth: 1,
            borderColor: THEME.colors.error,
            borderRadius: THEME.borderRadius.md,
            padding: 12,
            marginBottom: 16,
          }}
        >
          <Text style={{ color: THEME.colors.error, fontSize: 14 }}>{error}</Text>
        </Pressable>
      ) : null}

      {/* 残高カード */}
      <View
        style={{
          backgroundColor: THEME.colors.surface,
          borderRadius: THEME.borderRadius.lg,
          padding: 24,
          alignItems: "center",
          marginBottom: 24,
          borderWidth: 1,
          borderColor: THEME.colors.border,
        }}
      >
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: `${THEME.colors.primary}15`,
            justifyContent: "center",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <Coins size={32} color={THEME.colors.primary} />
        </View>
        <Text
          style={{
            fontSize: 40,
            fontWeight: "800",
            color: THEME.colors.text,
          }}
        >
          {balance}
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: THEME.colors.textSecondary,
            marginTop: 4,
          }}
        >
          {t("quota.remaining")}
        </Text>
      </View>

      {/* 無料で獲得セクション */}
      <Text
        style={{
          fontSize: 16,
          fontWeight: "700",
          color: THEME.colors.text,
          marginBottom: 12,
        }}
      >
        {t("quota.earnFree")}
      </Text>

      <Pressable
        onPress={handleWatchAd}
        disabled={!adReady || isLoading}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          backgroundColor: THEME.colors.surface,
          borderRadius: THEME.borderRadius.lg,
          padding: 16,
          marginBottom: 24,
          borderWidth: 1,
          borderColor: pressed ? THEME.colors.primary : THEME.colors.border,
          opacity: adReady ? 1 : 0.5,
        })}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: `${THEME.colors.success}15`,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Play size={22} color={THEME.colors.success} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: "600", color: THEME.colors.text }}>
            {t("quota.watchAd")}
          </Text>
          <Text style={{ fontSize: 13, color: THEME.colors.textSecondary, marginTop: 2 }}>
            {t("quota.watchAdReward", { amount: String(AD_REWARD_QUOTA) })}
          </Text>
        </View>
        <TrendingUp size={18} color={THEME.colors.success} />
      </Pressable>

      {/* 購入セクション（RevenueCat初期化済みの場合のみ表示） */}
      {purchaseAvailable ? (
        <>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "700",
              color: THEME.colors.text,
              marginBottom: 12,
            }}
          >
            {t("quota.purchase")}
          </Text>

          {QUOTA_PACKS.map((pack) => (
            <Pressable
              key={pack.type}
              onPress={() => handlePurchase(pack.type)}
              disabled={purchasing || isLoading}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                backgroundColor: THEME.colors.surface,
                borderRadius: THEME.borderRadius.lg,
                padding: 16,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: pressed ? THEME.colors.primary : THEME.colors.border,
              })}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: `${THEME.colors.primary}15`,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Package size={22} color={THEME.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: THEME.colors.text }}>
                  {pack.label} — {t("quota.quotaAmount", { amount: String(pack.amount) })}
                </Text>
                <Text style={{ fontSize: 13, color: THEME.colors.textSecondary, marginTop: 2 }}>
                  {t("quota.perUnit", { price: (pack.priceNum / pack.amount).toFixed(1) })}
                </Text>
              </View>
              <Text style={{ fontSize: 16, fontWeight: "700", color: THEME.colors.primary }}>
                {pack.price}
              </Text>
            </Pressable>
          ))}

          {purchasing && (
            <View style={{ alignItems: "center", marginTop: 16 }}>
              <ActivityIndicator color={THEME.colors.primary} />
              <Text style={{ fontSize: 13, color: THEME.colors.textSecondary, marginTop: 8 }}>
                {t("quota.purchasing")}
              </Text>
            </View>
          )}
        </>
      ) : null}

      {/* 利用状況 */}
      <View
        style={{
          marginTop: 24,
          paddingTop: 24,
          borderTopWidth: 1,
          borderTopColor: THEME.colors.border,
        }}
      >
        <Text
          style={{
            fontSize: 13,
            color: THEME.colors.textMuted,
            textAlign: "center",
            lineHeight: 20,
          }}
        >
          {t("quota.usageInfo")}
        </Text>
      </View>
    </ScrollView>
  );
}
