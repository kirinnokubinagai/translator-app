import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { THEME } from "@/constants/theme";

/**
 * ルートレイアウト
 */
export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: THEME.colors.surface },
          headerTintColor: THEME.colors.text,
          headerTitleStyle: { fontWeight: "600" },
          contentStyle: { backgroundColor: THEME.colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="settings"
          options={{
            title: "設定",
            presentation: "modal",
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
      </Stack>
    </>
  );
}
