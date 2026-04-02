import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { Activity, ChevronRight, Coins, Globe, LogOut, User } from "lucide-react-native";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { THEME } from "@/constants/theme";
import type { Locale } from "@/i18n";
import { useT } from "@/i18n";
import { useAuthStore } from "@/store/auth-store";
import { useQuotaStore } from "@/store/quota-store";
import { useSettingsStore } from "@/store/settings-store";

/** アプリバージョン（app.json / app.config.ts から取得） */
const APP_VERSION = Constants.expoConfig?.version ?? "0.0.0";

/** UIロケールの表示名 */
const LOCALE_LABELS: Record<Locale, string> = {
  ja: "日本語",
  en: "English",
};

/**
 * 設定画面
 */
export default function SettingsScreen() {
  const settings = useSettingsStore();
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLogout = useAuthStore((s) => s.logout);
  const quotaBalance = useQuotaStore((s) => s.balance);
  const t = useT();

  /** ログアウト処理 */
  const handleLogout = async () => {
    await authLogout();
    router.replace("/login");
  };

  /** ログイン画面へ遷移 */
  const handleGoToLogin = () => {
    router.push("/login");
  };

  /** ロケール切替 */
  const handleToggleLocale = () => {
    const next: Locale = settings.locale === "ja" ? "en" : "ja";
    settings.setLocale(next);
  };

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
            {t("settings.languageSettings")}
          </Text>
          <LanguageSelector
            value={settings.sourceLanguage}
            onChange={settings.setSourceLanguage}
            label={t("settings.sourceLanguage")}
          />
          <LanguageSelector
            value={settings.targetLanguage}
            onChange={settings.setTargetLanguage}
            label={t("settings.targetLanguage")}
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
            {t("settings.generalSettings")}
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
                {t("settings.autoPlayTts")}
              </Text>
              <Text style={{ fontSize: 13, color: THEME.colors.textSecondary }}>
                {t("settings.autoPlayTtsDescription")}
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
                {t("settings.hapticFeedback")}
              </Text>
              <Text style={{ fontSize: 13, color: THEME.colors.textSecondary }}>
                {t("settings.hapticFeedbackDescription")}
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

          {/* 表示言語切替 */}
          <Pressable
            onPress={handleToggleLocale}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              backgroundColor: THEME.colors.surface,
              padding: 16,
              borderRadius: THEME.borderRadius.md,
              borderWidth: 1,
              borderColor: THEME.colors.border,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Globe size={20} color={THEME.colors.primary} />
              <View>
                <Text style={{ fontSize: 16, color: THEME.colors.text }}>
                  {t("settings.uiLanguage")}
                </Text>
                <Text style={{ fontSize: 13, color: THEME.colors.textSecondary }}>
                  {t("settings.uiLanguageDescription")}
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: 15, fontWeight: "600", color: THEME.colors.primary }}>
              {LOCALE_LABELS[settings.locale]}
            </Text>
          </Pressable>
        </View>

        {/* クォータ */}
        <View style={{ gap: 12 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "700",
              color: THEME.colors.text,
            }}
          >
            {t("settings.quota")}
          </Text>
          <Pressable
            onPress={() => router.push("/quota")}
            accessibilityRole="button"
            accessibilityLabel={t("quota.quotaAccessibilityLabel", {
              balance: String(quotaBalance),
            })}
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
            <Coins size={20} color={THEME.colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, color: THEME.colors.text }}>
                {t("settings.quotaBalance")}: {quotaBalance}
              </Text>
              <Text style={{ fontSize: 13, color: THEME.colors.textSecondary }}>
                {t("settings.quotaDescription")}
              </Text>
            </View>
            <ChevronRight size={18} color={THEME.colors.textMuted} />
          </Pressable>
        </View>

        <View style={{ gap: 12 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "700",
              color: THEME.colors.text,
            }}
          >
            {t("settings.developerTools")}
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
                {t("settings.pipelineDiagnostic")}
              </Text>
              <Text style={{ fontSize: 13, color: THEME.colors.textSecondary }}>
                {t("settings.pipelineDiagnosticDescription")}
              </Text>
            </View>
            <ChevronRight size={18} color={THEME.colors.textMuted} />
          </Pressable>
        </View>

        {/* アカウント */}
        <View style={{ gap: 12 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "700",
              color: THEME.colors.text,
            }}
          >
            {t("settings.account")}
          </Text>

          {isAuthenticated && authUser ? (
            <View style={{ gap: 12 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  backgroundColor: THEME.colors.surface,
                  padding: 16,
                  borderRadius: THEME.borderRadius.md,
                  borderWidth: 1,
                  borderColor: THEME.colors.border,
                }}
              >
                <User size={20} color={THEME.colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, color: THEME.colors.text }}>
                    {authUser.name ?? authUser.email}
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      color: THEME.colors.textSecondary,
                    }}
                  >
                    {authUser.email}
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={handleLogout}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  backgroundColor: THEME.colors.surface,
                  padding: 16,
                  borderRadius: THEME.borderRadius.md,
                  borderWidth: 1,
                  borderColor: THEME.colors.error,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <LogOut size={20} color={THEME.colors.error} />
                <Text style={{ fontSize: 16, color: THEME.colors.error }}>
                  {t("settings.logout")}
                </Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={handleGoToLogin}
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
              <User size={20} color={THEME.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, color: THEME.colors.text }}>
                  {t("settings.loginOrSignup")}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: THEME.colors.textSecondary,
                  }}
                >
                  {t("settings.loginOrSignupDescription")}
                </Text>
              </View>
              <ChevronRight size={18} color={THEME.colors.textMuted} />
            </Pressable>
          )}
        </View>

        {/* セクション区切り線 */}
        <View style={{ height: 1, backgroundColor: THEME.colors.border, marginVertical: 8 }} />

        <View
          style={{
            alignItems: "center",
            paddingTop: 16,
            paddingBottom: 24,
          }}
        >
          <Text style={{ fontSize: 11, color: THEME.colors.textMuted, opacity: 0.6 }}>
            {t("settings.appVersion", { version: APP_VERSION })}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
