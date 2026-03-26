import { Tabs, useRouter } from "expo-router";
import { Pressable } from "react-native";
import { MessageSquare, Subtitles, Mic, History, Settings } from "lucide-react-native";
import { THEME, TAB_BAR_HEIGHT } from "@/constants/theme";

/**
 * タブレイアウト
 */
export default function TabLayout() {
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: THEME.colors.surface },
        headerTintColor: THEME.colors.text,
        headerTitleStyle: { fontWeight: "600" },
        tabBarStyle: {
          backgroundColor: THEME.colors.surface,
          borderTopColor: THEME.colors.border,
          height: TAB_BAR_HEIGHT,
          paddingTop: 8,
        },
        tabBarActiveTintColor: THEME.colors.primary,
        tabBarInactiveTintColor: THEME.colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="conversation"
        options={{
          title: "通訳",
          headerShown: true,
          headerRight: () => (
            <Pressable
              onPress={() => router.push("/settings")}
              hitSlop={8}
              style={({ pressed }) => ({
                marginRight: 16,
                padding: 6,
                borderRadius: THEME.borderRadius.full,
                backgroundColor: pressed ? THEME.colors.border : "transparent",
              })}
            >
              <Settings size={20} color={THEME.colors.textSecondary} />
            </Pressable>
          ),
          tabBarIcon: ({ color, size }) => (
            <MessageSquare size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="subtitles"
        options={{
          title: "字幕",
          tabBarIcon: ({ color, size }) => (
            <Subtitles size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="memo"
        options={{
          title: "メモ",
          tabBarIcon: ({ color, size }) => <Mic size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "履歴",
          tabBarIcon: ({ color, size }) => (
            <History size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
