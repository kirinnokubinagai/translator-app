import { useRef, useEffect } from "react";
import { View, Text, ActivityIndicator, Animated, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Mic, Copy, Volume2, Check } from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import * as Crypto from "expo-crypto";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { useSpeechToText } from "@/hooks/use-speech-to-text";
import { useTranslation } from "@/hooks/use-translation";
import { useSettingsStore } from "@/store/settings-store";
import { useMemoStore } from "@/store/memo-store";
import { LanguagePairSelector } from "@/components/ui/LanguagePairSelector";
import { RecordButton } from "@/components/ui/RecordButton";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { speak } from "@/services/api/tts";
import { THEME } from "@/constants/theme";
import type { Memo } from "@/types/memo";
import { useState } from "react";

/** パルスアニメーションの最小透明度 */
const PULSE_MIN_OPACITY = 0.3;
/** パルスアニメーションの周期（ミリ秒） */
const PULSE_DURATION_MS = 800;

/**
 * 音声メモ画面
 * expo-avで録音し、RunPod Whisperで文字起こし後に翻訳してメモとして保存する
 */
export default function MemoScreen() {
  const recorder = useAudioRecorder();
  const stt = useSpeechToText();
  const translation = useTranslation();
  const settings = useSettingsStore();
  const memoStore = useMemoStore();
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const isProcessing = stt.isTranscribing || translation.isTranslating;
  const error = recorder.error ?? stt.error ?? translation.error;
  const hasResult = !recorder.isRecording && !isProcessing && !!stt.transcribedText;

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!recorder.isRecording) {
      pulseAnim.setValue(1);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: PULSE_MIN_OPACITY,
          duration: PULSE_DURATION_MS,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: PULSE_DURATION_MS,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [recorder.isRecording, pulseAnim]);

  const handleRecordPress = async () => {
    if (recorder.isRecording) {
      const result = await recorder.stopRecord();
      if (!result) return;

      const sttResult = await stt.transcribe(
        result.base64,
        settings.sourceLanguage
      );
      if (!sttResult) return;

      const translated = await translation.translate(
        sttResult.text,
        settings.sourceLanguage,
        settings.targetLanguage
      );
      if (!translated) return;

      const memo: Memo = {
        id: Crypto.randomUUID(),
        originalText: sttResult.text,
        translatedText: translated,
        sourceLanguage: settings.sourceLanguage,
        targetLanguage: settings.targetLanguage,
        audioUri: result.uri,
        duration: result.duration,
        createdAt: Date.now(),
      };
      await memoStore.addMemo(memo);
      setSaved(true);

      if (settings.autoPlayTts) {
        speak(translated, settings.targetLanguage);
      }
      return;
    }

    // 録音開始時にリセット
    stt.reset();
    translation.reset();
    setSaved(false);
    setCopied(false);
    await recorder.startRecord();
  };

  const handleCopyTranslation = async () => {
    if (!translation.translatedText) return;
    await Clipboard.setStringAsync(translation.translatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePlayTranslation = () => {
    if (!translation.translatedText) return;
    speak(translation.translatedText, settings.targetLanguage);
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.colors.background }}>
      {/* 言語ペアセレクター */}
      <View
        style={{
          paddingHorizontal: THEME.spacing.md,
          paddingVertical: THEME.spacing.sm,
        }}
      >
        <LanguagePairSelector
          sourceLanguage={settings.sourceLanguage}
          targetLanguage={settings.targetLanguage}
          onSourceChange={settings.setSourceLanguage}
          onTargetChange={settings.setTargetLanguage}
          onSwap={settings.swapLanguages}
        />
      </View>

      {/* エラー表示 */}
      {error ? (
        <View style={{ paddingHorizontal: THEME.spacing.md }}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {/* メインコンテンツエリア */}
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: THEME.spacing.xl,
          gap: THEME.spacing.md,
        }}
      >
        {/* 待機状態 */}
        {!recorder.isRecording && !isProcessing && !hasResult ? (
          <View style={{ alignItems: "center", gap: THEME.spacing.md }}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: THEME.colors.primaryLight,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Mic size={36} color={THEME.colors.primary} />
            </View>
            <Text
              style={{
                fontSize: 16,
                color: THEME.colors.textSecondary,
                textAlign: "center",
              }}
            >
              タップして録音
            </Text>
          </View>
        ) : null}

        {/* 録音中 */}
        {recorder.isRecording ? (
          <View style={{ alignItems: "center", gap: THEME.spacing.sm }}>
            <Animated.View
              style={{
                width: 16,
                height: 16,
                borderRadius: 8,
                backgroundColor: THEME.colors.error,
                opacity: pulseAnim,
              }}
            />
            <Text
              style={{
                fontSize: 48,
                fontWeight: "200",
                color: THEME.colors.text,
                fontVariant: ["tabular-nums"],
              }}
            >
              {formatDuration(recorder.duration)}
            </Text>
            <Text style={{ fontSize: 14, color: THEME.colors.textSecondary }}>
              タップして停止
            </Text>
          </View>
        ) : null}

        {/* 処理中 */}
        {isProcessing ? (
          <View style={{ alignItems: "center", gap: THEME.spacing.md }}>
            <ActivityIndicator size="large" color={THEME.colors.primary} />
            <Text
              style={{
                fontSize: 16,
                fontWeight: "500",
                color: THEME.colors.textSecondary,
              }}
            >
              {stt.isTranscribing ? "音声認識中..." : "翻訳中..."}
            </Text>
          </View>
        ) : null}

        {/* 結果表示カード */}
        {hasResult ? (
          <View
            style={{
              width: "100%",
              backgroundColor: THEME.colors.surface,
              borderRadius: THEME.borderRadius.md,
              borderWidth: 1,
              borderColor: THEME.colors.border,
              overflow: "hidden",
            }}
          >
            {/* 保存確認バッジ */}
            {saved ? (
              <View
                style={{
                  backgroundColor: THEME.colors.successLight,
                  paddingVertical: 6,
                  paddingHorizontal: THEME.spacing.md,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Check size={14} color={THEME.colors.success} />
                <Text
                  style={{
                    fontSize: 13,
                    color: THEME.colors.success,
                    fontWeight: "600",
                  }}
                >
                  保存しました
                </Text>
              </View>
            ) : null}

            {/* 原文 */}
            <View style={{ padding: THEME.spacing.md }}>
              <Text
                style={{
                  fontSize: 12,
                  color: THEME.colors.textMuted,
                  marginBottom: 4,
                  fontWeight: "600",
                }}
              >
                原文
              </Text>
              <Text style={{ fontSize: 15, color: THEME.colors.text, lineHeight: 22 }}>
                {stt.transcribedText}
              </Text>
            </View>

            {/* 区切り線 */}
            <View
              style={{
                height: 1,
                backgroundColor: THEME.colors.border,
                marginHorizontal: THEME.spacing.md,
              }}
            />

            {/* 翻訳 */}
            {translation.translatedText ? (
              <View style={{ padding: THEME.spacing.md }}>
                <Text
                  style={{
                    fontSize: 12,
                    color: THEME.colors.textMuted,
                    marginBottom: 4,
                    fontWeight: "600",
                  }}
                >
                  翻訳
                </Text>
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: "600",
                    color: THEME.colors.primary,
                    lineHeight: 24,
                  }}
                >
                  {translation.translatedText}
                </Text>

                {/* アクションボタン */}
                <View
                  style={{
                    flexDirection: "row",
                    gap: THEME.spacing.md,
                    marginTop: THEME.spacing.md,
                  }}
                >
                  <Pressable
                    onPress={handlePlayTranslation}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      paddingVertical: 6,
                      paddingHorizontal: 12,
                      borderRadius: THEME.borderRadius.sm,
                      backgroundColor: pressed
                        ? THEME.colors.primaryLight
                        : THEME.colors.background,
                    })}
                  >
                    <Volume2 size={16} color={THEME.colors.primary} />
                    <Text
                      style={{
                        fontSize: 13,
                        color: THEME.colors.primary,
                        fontWeight: "500",
                      }}
                    >
                      再生
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={handleCopyTranslation}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      paddingVertical: 6,
                      paddingHorizontal: 12,
                      borderRadius: THEME.borderRadius.sm,
                      backgroundColor: pressed
                        ? THEME.colors.primaryLight
                        : THEME.colors.background,
                    })}
                  >
                    {copied ? (
                      <Check size={16} color={THEME.colors.success} />
                    ) : (
                      <Copy size={16} color={THEME.colors.primary} />
                    )}
                    <Text
                      style={{
                        fontSize: 13,
                        color: copied ? THEME.colors.success : THEME.colors.primary,
                        fontWeight: "500",
                      }}
                    >
                      {copied ? "コピー済み" : "コピー"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* 録音ボタン */}
      <View
        style={{
          alignItems: "center",
          paddingVertical: THEME.spacing.lg,
          borderTopWidth: 1,
          borderTopColor: THEME.colors.border,
        }}
      >
        <RecordButton
          isRecording={recorder.isRecording}
          onPress={handleRecordPress}
          disabled={isProcessing}
          label={
            recorder.isRecording
              ? "タップして停止"
              : isProcessing
                ? "処理中..."
                : "タップして録音"
          }
        />
      </View>
    </SafeAreaView>
  );
}
