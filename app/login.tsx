import { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Image } from "react-native";
import { Mail, Lock, AlertCircle } from "lucide-react-native";
import { useAuthStore } from "@/store/auth-store";
import { THEME } from "@/constants/theme";
import { GoogleIcon } from "@/components/ui/GoogleIcon";
import { AppleIcon } from "@/components/ui/AppleIcon";
import { useT } from "@/i18n";

/**
 * ログイン画面
 */
export default function LoginScreen() {
  const router = useRouter();
  const {
    isLoading,
    error,
    loginWithEmail,
    loginWithSocial,
    clearError,
  } = useAuthStore();
  const t = useT();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [focusedField, setFocusedField] = useState<string | null>(null);

  /** メールログイン処理 */
  const handleEmailLogin = async () => {
    if (!email.trim() || !password.trim()) return;

    const success = await loginWithEmail({ email: email.trim(), password });
    if (!success) return;

    router.replace("/(tabs)/conversation");
  };

  /** ソーシャルログイン処理 */
  const handleSocialLogin = async (provider: "apple" | "google") => {
    const success = await loginWithSocial(provider);
    if (!success) return;

    router.replace("/(tabs)/conversation");
  };

  /** 新規登録画面へ遷移 */
  const handleGoToSignup = () => {
    clearError();
    router.push("/signup");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingHorizontal: THEME.spacing.xl,
            gap: THEME.spacing.lg,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* ヘッダー */}
          <View style={{ alignItems: "center", gap: THEME.spacing.sm }}>
            <Image
              source={require("../assets/icon.png")}
              style={{ width: 80, height: 80, borderRadius: THEME.borderRadius.lg }}
            />
            <Text
              style={{
                fontSize: 28,
                fontWeight: "700",
                color: THEME.colors.text,
                textAlign: "center",
              }}
            >
              {t("auth.login")}
            </Text>
            <Text
              style={{
                fontSize: 15,
                color: THEME.colors.textSecondary,
                textAlign: "center",
              }}
            >
              {t("auth.loginDescription")}
            </Text>
          </View>

          {/* エラー表示 */}
          {error ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                backgroundColor: THEME.colors.errorLight,
                padding: 12,
                borderRadius: THEME.borderRadius.sm,
                borderWidth: 1,
                borderColor: THEME.colors.error,
              }}
            >
              <AlertCircle size={18} color={THEME.colors.error} />
              <Text
                style={{
                  flex: 1,
                  fontSize: 14,
                  color: THEME.colors.error,
                }}
              >
                {error}
              </Text>
            </View>
          ) : null}

          {/* メール入力 */}
          <View style={{ gap: THEME.spacing.md }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: THEME.colors.surface,
                borderWidth: focusedField === "email" ? 2 : 1,
                borderColor: focusedField === "email" ? THEME.colors.primary : THEME.colors.border,
                borderRadius: THEME.borderRadius.md,
                paddingHorizontal: 14,
              }}
            >
              <Mail size={18} color={focusedField === "email" ? THEME.colors.primary : THEME.colors.textMuted} />
              <TextInput
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  paddingHorizontal: 10,
                  fontSize: 16,
                  color: THEME.colors.text,
                }}
                placeholder={t("auth.email")}
                placeholderTextColor={THEME.colors.textMuted}
                accessibilityLabel={t("auth.email")}
                value={email}
                onChangeText={(text) => {
                  clearError();
                  setEmail(text);
                }}
                onFocus={() => setFocusedField("email")}
                onBlur={() => setFocusedField(null)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: THEME.colors.surface,
                borderWidth: focusedField === "password" ? 2 : 1,
                borderColor: focusedField === "password" ? THEME.colors.primary : THEME.colors.border,
                borderRadius: THEME.borderRadius.md,
                paddingHorizontal: 14,
              }}
            >
              <Lock size={18} color={focusedField === "password" ? THEME.colors.primary : THEME.colors.textMuted} />
              <TextInput
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  paddingHorizontal: 10,
                  fontSize: 16,
                  color: THEME.colors.text,
                }}
                placeholder={t("auth.password")}
                placeholderTextColor={THEME.colors.textMuted}
                accessibilityLabel={t("auth.password")}
                value={password}
                onChangeText={(text) => {
                  clearError();
                  setPassword(text);
                }}
                onFocus={() => setFocusedField("password")}
                onBlur={() => setFocusedField(null)}
                secureTextEntry
                editable={!isLoading}
              />
            </View>
          </View>

          {/* ログインボタン */}
          <Pressable
            onPress={handleEmailLogin}
            disabled={isLoading || !email.trim() || !password.trim()}
            accessibilityRole="button"
            accessibilityLabel={t("auth.login")}
            accessibilityState={{ disabled: isLoading || !email.trim() || !password.trim() }}
            style={{
              backgroundColor: THEME.colors.primary,
              paddingVertical: 16,
              borderRadius: THEME.borderRadius.md,
              alignItems: "center",
              justifyContent: "center",
              opacity:
                isLoading || !email.trim() || !password.trim() ? 0.5 : 1,
            }}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text
                style={{ fontSize: 17, fontWeight: "600", color: "#ffffff" }}
              >
                {t("auth.login")}
              </Text>
            )}
          </Pressable>

          {/* 区切り線 */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: THEME.spacing.md,
            }}
          >
            <View
              style={{
                flex: 1,
                height: 1,
                backgroundColor: THEME.colors.border,
              }}
            />
            <Text
              style={{ fontSize: 13, color: THEME.colors.textMuted }}
            >
              {t("common.or")}
            </Text>
            <View
              style={{
                flex: 1,
                height: 1,
                backgroundColor: THEME.colors.border,
              }}
            />
          </View>

          {/* ソーシャルログイン */}
          <View style={{ gap: 10 }}>
            {/* Googleログイン */}
            <Pressable
              onPress={() => handleSocialLogin("google")}
              disabled={isLoading}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                backgroundColor: "#ffffff",
                paddingVertical: 14,
                borderRadius: THEME.borderRadius.md,
                borderWidth: 1,
                borderColor: THEME.colors.border,
                opacity: isLoading ? 0.5 : 1,
              }}
            >
              <GoogleIcon size={20} />
              <Text
                style={{ fontSize: 16, fontWeight: "600", color: THEME.colors.text }}
              >
                {t("auth.loginWithGoogle")}
              </Text>
            </Pressable>

            {/* Appleログイン（iOSのみ） */}
            {Platform.OS === "ios" ? (
              <Pressable
                onPress={() => handleSocialLogin("apple")}
                disabled={isLoading}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  backgroundColor: "#000000",
                  paddingVertical: 14,
                  borderRadius: THEME.borderRadius.md,
                  opacity: isLoading ? 0.5 : 1,
                }}
              >
                <AppleIcon size={20} color="#ffffff" />
                <Text
                  style={{ fontSize: 16, fontWeight: "600", color: "#ffffff" }}
                >
                  {t("auth.loginWithApple")}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {/* フッターリンク */}
          <View style={{ alignItems: "center", gap: THEME.spacing.md }}>
            <Pressable onPress={handleGoToSignup} disabled={isLoading}>
              <Text
                style={{
                  fontSize: 15,
                  color: THEME.colors.primary,
                  fontWeight: "500",
                }}
              >
                {t("auth.goToSignup")}
              </Text>
            </Pressable>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
