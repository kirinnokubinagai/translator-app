import "../global.css";
import { useEffect, useRef } from "react";
import { AppState, LogBox } from "react-native";

// Dev Client環境でExpoSecureStoreのネイティブモジュール未登録エラーを抑制
// try-catchで捕捉済みだがDevClientのエラーオーバレイが先にインターセプトするため
if (__DEV__) {
  LogBox.ignoreLogs(["Cannot find native module 'ExpoSecureStore'"]);
}

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { THEME } from "@/constants/theme";
import { logger } from "@/lib/logger";
import { preloadRewardedAd } from "@/services/ads/rewarded-ad";
import { registerDevice } from "@/services/api/device";
import { warmupEndpoints } from "@/services/api/warmup";
import { useQuotaStore } from "@/store/quota-store";

/** デバイス登録リトライの最大回数 */
const REGISTER_MAX_RETRIES = 3;
/** リトライ間隔（ミリ秒） */
const REGISTER_RETRY_DELAY_MS = 3000;

/**
 * デバイス登録をリトライ付きで実行する
 *
 * 成功したらクォータを初期化する。
 * 失敗したら指数バックオフでリトライし、それでもダメなら
 * アプリ復帰時に再試行する。
 */
async function registerDeviceWithRetry(): Promise<boolean> {
  for (let attempt = 0; attempt < REGISTER_MAX_RETRIES; attempt++) {
    const success = await registerDevice();
    if (success) {
      await useQuotaStore.getState().initialize();
      return true;
    }
    if (attempt < REGISTER_MAX_RETRIES - 1) {
      const delay = REGISTER_RETRY_DELAY_MS * 2 ** attempt;
      logger.warn("デバイス登録リトライ", { attempt: String(attempt + 1), delay: String(delay) });
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  logger.error("デバイス登録が全リトライ後も失敗");
  return false;
}

/**
 * ルートレイアウト
 */
export default function RootLayout() {
  const registered = useRef(false);

  useEffect(() => {
    // デバイス登録とウォームアップを並列実行
    registerDeviceWithRetry().then((ok) => {
      registered.current = ok;
    });
    warmupEndpoints().catch((error) => {
      logger.warn("ウォームアップ失敗（非致命的）", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
    preloadRewardedAd();

    // アプリ復帰時に未登録なら再試行
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && !registered.current) {
        registerDeviceWithRetry().then((ok) => {
          registered.current = ok;
        });
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: THEME.colors.surface },
          headerTintColor: THEME.colors.text,
          headerTitleStyle: { fontWeight: "600" },
          contentStyle: { backgroundColor: THEME.colors.background },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen
          name="signup"
          options={{
            title: "アカウント作成",
            presentation: "modal",
            animation: "fade_from_bottom",
          }}
        />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="settings"
          options={{
            title: "設定",
            presentation: "modal",
            animation: "fade_from_bottom",
          }}
        />
        <Stack.Screen
          name="memo/[id]"
          options={{
            title: "メモ詳細",
          }}
        />
        <Stack.Screen
          name="diagnostic"
          options={{
            title: "診断",
          }}
        />
        <Stack.Screen
          name="quota"
          options={{
            title: "クォータ",
            presentation: "modal",
            animation: "fade_from_bottom",
          }}
        />
      </Stack>
    </>
  );
}
