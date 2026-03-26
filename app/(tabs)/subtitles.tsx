import { useRef, useEffect } from "react";
import { View, Text, ScrollView, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Mic } from "lucide-react-native";
import { useSubtitles } from "@/hooks/use-subtitles";
import { useSettingsStore } from "@/store/settings-store";
import { LanguagePairSelector } from "@/components/ui/LanguagePairSelector";
import { RecordButton } from "@/components/ui/RecordButton";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { THEME } from "@/constants/theme";

/** 字幕フェードインアニメーションの周期（ミリ秒） */
const FADE_IN_DURATION_MS = 300;

/**
 * リアルタイム字幕画面
 * 暗い背景に字幕が下からストリームで表示される
 */
export default function SubtitlesScreen() {
  const { isListening, subtitles, error, startListening, stopListening } =
    useSubtitles();
  const settings = useSettingsStore();
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [subtitles]);

  const handleToggle = () => {
    if (isListening) {
      stopListening();
      return;
    }
    startListening();
  };

  const isDark = isListening;

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: isDark
          ? THEME.colors.subtitleBackground
          : THEME.colors.background,
      }}
    >
      {/* 言語ペアセレクター（上部） */}
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

      {/* 字幕表示エリア */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, paddingHorizontal: THEME.spacing.md }}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: subtitles.length === 0 ? "center" : "flex-end",
          paddingBottom: THEME.spacing.md,
        }}
      >
        {subtitles.length === 0 ? (
          <SubtitleIdleState isDark={isDark} isListening={isListening} />
        ) : (
          subtitles.map((line, index) => (
            <SubtitleLine
              key={line.id}
              translatedText={line.translatedText}
              originalText={line.originalText}
              isDark={isDark}
              isLatest={index === subtitles.length - 1}
            />
          ))
        )}
      </ScrollView>

      {/* 録音ボタン */}
      <View
        style={{
          alignItems: "center",
          paddingVertical: THEME.spacing.lg,
        }}
      >
        <RecordButton
          isRecording={isListening}
          onPress={handleToggle}
          size={70}
          label={isListening ? "字幕を停止" : "タップして字幕を開始"}
        />
      </View>
    </SafeAreaView>
  );
}

type SubtitleIdleStateProps = {
  isDark: boolean;
  isListening: boolean;
};

/**
 * 字幕の初期状態表示
 */
function SubtitleIdleState({ isDark, isListening }: SubtitleIdleStateProps) {
  if (isListening) {
    return (
      <View style={{ alignItems: "center", gap: THEME.spacing.sm }}>
        <Text style={{ fontSize: 16, color: "rgba(250,250,249,0.5)" }}>
          音声を待っています...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ alignItems: "center", gap: THEME.spacing.md }}>
      <Mic size={48} color={THEME.colors.textMuted} />
      <Text
        style={{
          fontSize: 18,
          fontWeight: "600",
          color: THEME.colors.text,
          textAlign: "center",
        }}
      >
        タップして字幕を開始
      </Text>
      <Text
        style={{
          fontSize: 14,
          color: THEME.colors.textSecondary,
          textAlign: "center",
        }}
      >
        リアルタイムで音声を認識し{"\n"}翻訳字幕を表示します
      </Text>
    </View>
  );
}

type SubtitleLineProps = {
  translatedText: string;
  originalText: string;
  isDark: boolean;
  isLatest: boolean;
};

/**
 * 字幕1行コンポーネント
 * フェードインアニメーション付き
 */
function SubtitleLine({
  translatedText,
  originalText,
  isDark,
  isLatest,
}: SubtitleLineProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: FADE_IN_DURATION_MS,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  return (
    <Animated.View
      style={{
        marginBottom: THEME.spacing.md,
        opacity: isLatest ? fadeAnim : 1,
      }}
    >
      <Text
        style={{
          fontSize: 20,
          fontWeight: "600",
          color: isDark ? THEME.colors.subtitleText : THEME.colors.text,
          marginBottom: 4,
        }}
      >
        {translatedText}
      </Text>
      <Text
        style={{
          fontSize: 14,
          color: isDark ? "rgba(250,250,249,0.5)" : THEME.colors.textSecondary,
        }}
      >
        {originalText}
      </Text>
    </Animated.View>
  );
}
