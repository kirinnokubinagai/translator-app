import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useEffect, useState } from "react";
import { useSettingsStore } from "@/store/settings-store";
import { useAuthStore } from "@/store/auth-store";
import { THEME } from "@/constants/theme";
import { logger } from "@/lib/logger";

/**
 * エントリーポイント
 * オンボーディング → 認証（セッション検証含む） → タブ画面の順にリダイレクト
 */
export default function Index() {
  const hasCompletedOnboarding = useSettingsStore(
    (s) => s.hasCompletedOnboarding
  );
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const initialize = useAuthStore((s) => s.initialize);
  const [isHydrated, setIsHydrated] = useState(false);

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

  if (!isHydrated || !isInitialized) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: THEME.colors.background,
        }}
      >
        <ActivityIndicator color={THEME.colors.primary} />
      </View>
    );
  }

  if (!hasCompletedOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return <Redirect href="/(tabs)/conversation" />;
}
