import { useRouter } from "expo-router";
import { AlertCircle, Lock, Mail, User } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppleIcon } from "@/components/ui/AppleIcon";
import { GoogleIcon } from "@/components/ui/GoogleIcon";
import { THEME } from "@/constants/theme";
import { useT } from "@/i18n";
import { useAuthStore } from "@/store/auth-store";

/** パスワード最小文字数 */
const PASSWORD_MIN_LENGTH = 8;

/**
 * 新規登録画面
 */
export default function SignupScreen() {
  const router = useRouter();
  const { isLoading, error, registerWithEmail, loginWithSocial, clearError } = useAuthStore();
  const t = useT();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const isFormValid =
    name.trim().length > 0 && email.trim().length > 0 && password.length >= PASSWORD_MIN_LENGTH;

  /** 新規登録処理 */
  const handleSignup = async () => {
    if (!isFormValid) return;

    const success = await registerWithEmail({
      email: email.trim(),
      password,
      name: name.trim(),
    });
    if (!success) return;

    router.replace("/(tabs)/conversation");
  };

  /** ソーシャルアカウント作成処理 */
  const handleSocialSignup = async (provider: "apple" | "google") => {
    const success = await loginWithSocial(provider);
    if (!success) return;

    router.replace("/(tabs)/conversation");
  };

  /** ログイン画面へ戻る */
  const handleGoToLogin = () => {
    clearError();
    router.back();
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
              {t("auth.signup")}
            </Text>
            <Text
              style={{
                fontSize: 15,
                color: THEME.colors.textSecondary,
                textAlign: "center",
              }}
            >
              {t("auth.signupDescription")}
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

          {/* フォーム */}
          <View style={{ gap: THEME.spacing.md }}>
            {/* 名前 */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: THEME.colors.surface,
                borderWidth: focusedField === "name" ? 2 : 1,
                borderColor: focusedField === "name" ? THEME.colors.primary : THEME.colors.border,
                borderRadius: THEME.borderRadius.md,
                paddingHorizontal: 14,
              }}
            >
              <User
                size={18}
                color={focusedField === "name" ? THEME.colors.primary : THEME.colors.textMuted}
              />
              <TextInput
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  paddingHorizontal: 10,
                  fontSize: 16,
                  color: THEME.colors.text,
                }}
                placeholder={t("auth.name")}
                placeholderTextColor={THEME.colors.textMuted}
                value={name}
                onChangeText={(text) => {
                  clearError();
                  setName(text);
                }}
                onFocus={() => setFocusedField("name")}
                onBlur={() => setFocusedField(null)}
                autoCapitalize="words"
                editable={!isLoading}
              />
            </View>

            {/* メール */}
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
              <Mail
                size={18}
                color={focusedField === "email" ? THEME.colors.primary : THEME.colors.textMuted}
              />
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

            {/* パスワード */}
            <View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: THEME.colors.surface,
                  borderWidth: focusedField === "password" ? 2 : 1,
                  borderColor:
                    focusedField === "password" ? THEME.colors.primary : THEME.colors.border,
                  borderRadius: THEME.borderRadius.md,
                  paddingHorizontal: 14,
                }}
              >
                <Lock
                  size={18}
                  color={
                    focusedField === "password" ? THEME.colors.primary : THEME.colors.textMuted
                  }
                />
                <TextInput
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    paddingHorizontal: 10,
                    fontSize: 16,
                    color: THEME.colors.text,
                  }}
                  placeholder={t("auth.passwordWithMin")}
                  placeholderTextColor={THEME.colors.textMuted}
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
              {password.length > 0 && password.length < PASSWORD_MIN_LENGTH ? (
                <Text
                  style={{
                    fontSize: 12,
                    color: THEME.colors.warning,
                    marginTop: 4,
                    marginLeft: 4,
                  }}
                >
                  {t("auth.passwordTooShort", { min: String(PASSWORD_MIN_LENGTH) })}
                </Text>
              ) : null}
            </View>
          </View>

          {/* 登録ボタン */}
          <Pressable
            onPress={handleSignup}
            disabled={isLoading || !isFormValid}
            style={{
              backgroundColor: THEME.colors.primary,
              paddingVertical: 16,
              borderRadius: THEME.borderRadius.md,
              alignItems: "center",
              justifyContent: "center",
              opacity: isLoading || !isFormValid ? 0.5 : 1,
            }}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={{ fontSize: 17, fontWeight: "600", color: "#ffffff" }}>
                {t("auth.signup")}
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
            <View style={{ flex: 1, height: 1, backgroundColor: THEME.colors.border }} />
            <Text style={{ fontSize: 13, color: THEME.colors.textMuted }}>{t("common.or")}</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: THEME.colors.border }} />
          </View>

          {/* ソーシャルアカウント作成 */}
          <View style={{ gap: 10 }}>
            <Pressable
              onPress={() => handleSocialSignup("google")}
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
              <Text style={{ fontSize: 16, fontWeight: "600", color: THEME.colors.text }}>
                {t("auth.signupWithGoogle")}
              </Text>
            </Pressable>

            {Platform.OS === "ios" ? (
              <Pressable
                onPress={() => handleSocialSignup("apple")}
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
                <Text style={{ fontSize: 16, fontWeight: "600", color: "#ffffff" }}>
                  {t("auth.signupWithApple")}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {/* ログインへのリンク */}
          <View style={{ alignItems: "center" }}>
            <Pressable onPress={handleGoToLogin} disabled={isLoading}>
              <Text
                style={{
                  fontSize: 15,
                  color: THEME.colors.primary,
                  fontWeight: "500",
                }}
              >
                {t("auth.goToLogin")}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
