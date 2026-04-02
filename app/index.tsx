import { Redirect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { THEME } from "@/constants/theme";
import { logger } from "@/lib/logger";
import { isRewardedAdReady, showRewardedAd } from "@/services/ads/rewarded-ad";
import { consumeAdNonce, requestAdNonce } from "@/services/api/quota";
import { useAuthStore } from "@/store/auth-store";
import { useQuotaStore } from "@/store/quota-store";
import { useSettingsStore } from "@/store/settings-store";

/** 広告準備の最大待機時間（ミリ秒） */
const AD_READY_TIMEOUT_MS = 8000;
/** 広告準備チェック間隔（ミリ秒） */
const AD_POLL_INTERVAL_MS = 500;

/**
 * エントリーポイント
 *
 * オンボーディング → 認証 → 起動広告（無料ユーザー）/ ローディング（有料ユーザー） → タブ画面
 */
export default function Index() {
  const hasCompletedOnboarding = useSettingsStore((s) => s.hasCompletedOnboarding);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const initialize = useAuthStore((s) => s.initialize);
  const totalPurchased = useQuotaStore((s) => s.totalPurchased);
  const earnByAd = useQuotaStore((s) => s.earnByAd);

  const [isHydrated, setIsHydrated] = useState(false);
  const [startupComplete, setStartupComplete] = useState(false);

  /** ストアのhydration完了を待つ */
  useEffect(() => {
    const settingsReady = useSettingsStore.persist.hasHydrated();
    const authReady = useAuthStore.persist.hasHydrated();

    if (settingsReady && authReady) {
      setIsHydrated(true);
      return;
    }

    const unsubSettings = useSettingsStore.persist.onFinishHydration(() => {
      if (useAuthStore.persist.hasHydrated()) {
        setIsHydrated(true);
      }
    });
    const unsubAuth = useAuthStore.persist.onFinishHydration(() => {
      if (useSettingsStore.persist.hasHydrated()) {
        setIsHydrated(true);
      }
    });

    return () => {
      unsubSettings();
      unsubAuth();
    };
  }, []);

  /** hydration完了後にセッション検証を実行 */
  useEffect(() => {
    if (!isHydrated) return;
    if (isInitialized) return;

    initialize().catch((error) => {
      logger.error("セッション検証エラー", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, [isHydrated, isInitialized, initialize]);

  /** 起動広告フロー（無料ユーザー向け） */
  const runStartupAd = useCallback(async (): Promise<void> => {
    // 広告ロード完了を待つ（最大AD_READY_TIMEOUT_MS）
    const startTime = Date.now();
    while (!isRewardedAdReady() && Date.now() - startTime < AD_READY_TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, AD_POLL_INTERVAL_MS));
    }

    if (!isRewardedAdReady()) {
      logger.debug("起動広告がタイムアウト、スキップ");
      return;
    }

    // nonce取得 → 広告表示 → クォータ付与
    const nonceOk = await requestAdNonce();
    if (!nonceOk) {
      logger.warn("広告nonce取得失敗、スキップ");
      return;
    }

    const rewarded = await showRewardedAd();
    if (rewarded) {
      const nonce = consumeAdNonce();
      if (nonce) {
        await earnByAd(nonce);
      }
    }
  }, [earnByAd]);

  /** 認証完了後の起動処理 */
  useEffect(() => {
    if (!isHydrated || !isInitialized || !isAuthenticated) return;
    if (startupComplete) return;

    const isPaidUser = totalPurchased > 0;

    if (isPaidUser) {
      // 有料ユーザー: ローディングを少し見せてからスキップ
      const timer = setTimeout(() => setStartupComplete(true), 1500);
      return () => clearTimeout(timer);
    }

    // 無料ユーザー: 広告表示フローを実行
    runStartupAd().finally(() => {
      setStartupComplete(true);
    });
  }, [isHydrated, isInitialized, isAuthenticated, startupComplete, totalPurchased, runStartupAd]);

  // --- ルーティング判定 ---

  if (!isHydrated || !isInitialized) {
    return <StartupLoadingScreen message="" />;
  }

  if (!hasCompletedOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  if (!startupComplete) {
    const isPaidUser = totalPurchased > 0;
    return <StartupLoadingScreen message={isPaidUser ? "準備中..." : "広告を読み込み中..."} />;
  }

  return <Redirect href="/(tabs)/conversation" />;
}

/**
 * 起動ローディング画面
 */
function StartupLoadingScreen({ message }: { message: string }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: THEME.colors.background,
        gap: 16,
      }}
    >
      <ActivityIndicator size="large" color={THEME.colors.primary} />
      {message ? (
        <Text style={{ color: THEME.colors.textSecondary, fontSize: 14 }}>{message}</Text>
      ) : null}
    </View>
  );
}
