import { View, Text, ScrollView, Switch, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Activity } from "lucide-react-native";
import { useSettingsStore } from "@/store/settings-store";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { THEME } from "@/constants/theme";

/**
 * 設定画面
 */
export default function SettingsScreen() {
  const settings = useSettingsStore();
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 24 }}>
        <View style={{ gap: 12 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "700",
              color: THEME.colors.text,
            }}
          >
            言語設定
          </Text>
          <LanguageSelector
            value={settings.sourceLanguage}
            onChange={settings.setSourceLanguage}
            label="ソース言語（話す言語）"
          />
          <LanguageSelector
            value={settings.targetLanguage}
            onChange={settings.setTargetLanguage}
            label="ターゲット言語（翻訳先）"
          />
        </View>

        <View style={{ gap: 16 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "700",
              color: THEME.colors.text,
            }}
          >
            一般設定
          </Text>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              backgroundColor: THEME.colors.surface,
              padding: 16,
              borderRadius: THEME.borderRadius.md,
              borderWidth: 1,
              borderColor: THEME.colors.border,
            }}
          >
            <View>
              <Text style={{ fontSize: 16, color: THEME.colors.text }}>
                自動音声再生
              </Text>
              <Text style={{ fontSize: 13, color: THEME.colors.textSecondary }}>
                翻訳後に自動で音声を再生
              </Text>
            </View>
            <Switch
              value={settings.autoPlayTts}
              onValueChange={settings.setAutoPlayTts}
              trackColor={{
                false: THEME.colors.border,
                true: THEME.colors.primary,
              }}
            />
          </View>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              backgroundColor: THEME.colors.surface,
              padding: 16,
              borderRadius: THEME.borderRadius.md,
              borderWidth: 1,
              borderColor: THEME.colors.border,
            }}
          >
            <View>
              <Text style={{ fontSize: 16, color: THEME.colors.text }}>
                触覚フィードバック
              </Text>
              <Text style={{ fontSize: 13, color: THEME.colors.textSecondary }}>
                ボタン操作時の振動
              </Text>
            </View>
            <Switch
              value={settings.hapticFeedback}
              onValueChange={settings.setHapticFeedback}
              trackColor={{
                false: THEME.colors.border,
                true: THEME.colors.primary,
              }}
            />
          </View>
        </View>

        <View style={{ gap: 12 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "700",
              color: THEME.colors.text,
            }}
          >
            開発者ツール
          </Text>
          <Pressable
            onPress={() => router.push("/diagnostic")}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              backgroundColor: THEME.colors.surface,
              padding: 16,
              borderRadius: THEME.borderRadius.md,
              borderWidth: 1,
              borderColor: THEME.colors.border,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Activity size={20} color={THEME.colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, color: THEME.colors.text }}>
                パイプライン診断
              </Text>
              <Text
                style={{ fontSize: 13, color: THEME.colors.textSecondary }}
              >
                録音→音声認識→翻訳の動作確認
              </Text>
            </View>
          </Pressable>
        </View>

        <View
          style={{
            alignItems: "center",
            paddingTop: 32,
          }}
        >
          <Text style={{ fontSize: 13, color: THEME.colors.textMuted }}>
            即時通訳 v1.0.0
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
