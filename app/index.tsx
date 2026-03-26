import { Redirect } from "expo-router";
import { useSettingsStore } from "@/store/settings-store";

/**
 * エントリーポイント
 * オンボーディング完了状態に応じてリダイレクト
 */
export default function Index() {
  const hasCompletedOnboarding = useSettingsStore(
    (s) => s.hasCompletedOnboarding
  );

  if (!hasCompletedOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)/conversation" />;
}
