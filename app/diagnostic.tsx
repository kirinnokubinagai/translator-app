import { Check, Loader2, Mic, RotateCcw, X } from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { THEME } from "@/constants/theme";
import { useDiagnosticRecorder } from "@/hooks/use-diagnostic-recorder";
import { useT } from "@/i18n";
import { useConversationStore } from "@/store/conversation-store";

/**
 * パイプライン診断画面
 *
 * 録音→STT→翻訳の各ステップを順番にテストし、
 * どのステップで失敗するかを視覚的に表示する。
 */
export default function DiagnosticScreen() {
  const { steps, isRunning, result, startTest, reset } = useDiagnosticRecorder();
  const store = useConversationStore();
  const t = useT();

  const handleStart = () => {
    startTest(store.speaker1Language, store.speaker2Language);
  };

  const hasAnyResult = steps.some((s) => s.status !== "pending");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Text style={{ fontSize: 20, fontWeight: "700", color: THEME.colors.text }}>
          {t("diagnostic.title")}
        </Text>
        <Text style={{ fontSize: 14, color: THEME.colors.textSecondary, lineHeight: 20 }}>
          {t("diagnostic.description")}
        </Text>

        {/* 言語情報 */}
        <View
          style={{
            backgroundColor: THEME.colors.surface,
            borderRadius: THEME.borderRadius.md,
            padding: 12,
            borderWidth: 1,
            borderColor: THEME.colors.border,
          }}
        >
          <Text style={{ fontSize: 13, color: THEME.colors.textSecondary }}>
            {t("diagnostic.languagePairInfo")}
          </Text>
          <Text
            style={{
              fontSize: 15,
              fontWeight: "600",
              color: THEME.colors.text,
              marginTop: 4,
            }}
          >
            {store.speaker1Language} → {store.speaker2Language}
          </Text>
        </View>

        {/* 開始/リセットボタン */}
        <Pressable
          onPress={isRunning ? undefined : hasAnyResult ? reset : handleStart}
          style={({ pressed }) => ({
            backgroundColor: isRunning ? THEME.colors.textMuted : THEME.colors.primary,
            paddingVertical: 16,
            borderRadius: THEME.borderRadius.md,
            alignItems: "center" as const,
            flexDirection: "row" as const,
            justifyContent: "center" as const,
            gap: 8,
            opacity: pressed && !isRunning ? 0.8 : 1,
          })}
        >
          {isRunning ? (
            <Loader2 size={20} color="#fff" />
          ) : hasAnyResult ? (
            <RotateCcw size={20} color="#fff" />
          ) : (
            <Mic size={20} color="#fff" />
          )}
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
            {isRunning
              ? t("diagnostic.testing")
              : hasAnyResult
                ? t("diagnostic.retryTest")
                : t("diagnostic.startTest")}
          </Text>
        </Pressable>

        {/* ステップ一覧 */}
        {steps.map((step, i) => (
          <View
            key={i}
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 12,
              backgroundColor: THEME.colors.surface,
              padding: 14,
              borderRadius: THEME.borderRadius.sm,
              borderWidth: 1,
              borderColor:
                step.status === "error"
                  ? THEME.colors.error
                  : step.status === "success"
                    ? THEME.colors.success
                    : THEME.colors.border,
            }}
          >
            {/* ステータスアイコン */}
            <View style={{ width: 24, paddingTop: 2 }}>
              {step.status === "pending" ? (
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    borderWidth: 2,
                    borderColor: THEME.colors.border,
                  }}
                />
              ) : step.status === "running" ? (
                <Loader2 size={20} color={THEME.colors.primary} />
              ) : step.status === "success" ? (
                <Check size={20} color={THEME.colors.success} />
              ) : (
                <X size={20} color={THEME.colors.error} />
              )}
            </View>

            {/* ステップ情報 */}
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "600",
                  color: step.status === "error" ? THEME.colors.error : THEME.colors.text,
                }}
              >
                {`${i + 1}. ${step.label}`}
              </Text>
              {step.detail ? (
                <Text
                  style={{
                    fontSize: 13,
                    color:
                      step.status === "error" ? THEME.colors.error : THEME.colors.textSecondary,
                    marginTop: 4,
                    lineHeight: 18,
                  }}
                >
                  {step.detail}
                </Text>
              ) : null}
            </View>
          </View>
        ))}

        {/* 全成功時の結果表示 */}
        {result ? (
          <View
            style={{
              backgroundColor: THEME.colors.primaryLight,
              padding: 16,
              borderRadius: THEME.borderRadius.md,
              gap: 8,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: "700",
                color: THEME.colors.primaryDark,
              }}
            >
              {t("diagnostic.allSuccess")}
            </Text>
            <Text style={{ fontSize: 14, color: THEME.colors.text }}>
              {t("diagnostic.originalLabel")}: {result.originalText}
            </Text>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "600",
                color: THEME.colors.primaryDark,
              }}
            >
              {t("diagnostic.translationLabel")}: {result.translatedText}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
