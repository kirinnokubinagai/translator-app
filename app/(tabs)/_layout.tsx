import { Tabs, useRouter } from "expo-router";
import { History, MessageSquare, Mic, Settings, Subtitles } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { QuotaBadge } from "@/components/quota/QuotaBadge";
import { TAB_BAR_HEIGHT, THEME } from "@/constants/theme";
import { useT } from "@/i18n";

/**
 * タブレイアウト
 */
export default function TabLayout() {
  const router = useRouter();
  const t = useT();

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
        headerRight: () => (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <QuotaBadge />
            <Pressable
              onPress={() => router.push("/settings")}
              hitSlop={8}
              testID="settings-button"
              accessibilityLabel={t("accessibility.settings")}
              accessibilityRole="button"
              style={({ pressed }) => ({
                marginRight: 16,
                padding: 6,
                borderRadius: THEME.borderRadius.full,
                backgroundColor: pressed ? THEME.colors.border : "transparent",
              })}
            >
              <Settings size={20} color={THEME.colors.textSecondary} />
            </Pressable>
          </View>
        ),
      }}
    >
      <Tabs.Screen
        name="conversation"
        options={{
          title: t("tabs.conversation"),
          tabBarIcon: ({ color, size }) => <MessageSquare size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="subtitles"
        options={{
          title: t("tabs.subtitles"),
          tabBarIcon: ({ color, size }) => <Subtitles size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="memo"
        options={{
          title: t("tabs.memo"),
          tabBarIcon: ({ color, size }) => <Mic size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t("tabs.history"),
          tabBarIcon: ({ color, size }) => <History size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
