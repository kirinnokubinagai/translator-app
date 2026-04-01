import { useRef, useEffect, useState } from "react";
import { View, Text, ScrollView, Animated, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Mic } from "lucide-react-native";
import { useSubtitles } from "@/hooks/use-subtitles";
import { useSettingsStore } from "@/store/settings-store";
import { useQuota } from "@/hooks/use-quota";
import { LanguagePairSelector } from "@/components/ui/LanguagePairSelector";
import { RecordButton } from "@/components/ui/RecordButton";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { QuotaEmptyModal } from "@/components/quota/QuotaEmptyModal";
import { THEME } from "@/constants/theme";
import { useT } from "@/i18n";
import {
  preloadRewardedAd,
  showRewardedAd,
  subscribeRewardedAdReady,
} from "@/services/ads/rewarded-ad";
import { requestAdNonce, consumeAdNonce } from "@/services/api/quota";

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
  const { canStartConversation, watchAdForQuota, syncBalance } = useQuota();
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [isAdReady, setIsAdReady] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const t = useT();

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [subtitles]);

  useEffect(() => {
    preloadRewardedAd();
    return subscribeRewardedAdReady(setIsAdReady);
  }, []);

  const handleToggle = () => {
    if (isListening) {
      stopListening();
      return;
    }
    if (!canStartConversation) {
      setShowQuotaModal(true);
      return;
    }
    startListening();
  };

  const handleWatchAdFromModal = async () => {
    const nonceReady = await requestAdNonce();
    if (!nonceReady) return;
    const rewarded = await showRewardedAd();
    if (!rewarded) {
      consumeAdNonce();
      return;
    }

    const nonce = consumeAdNonce();
    if (!nonce) return;

    await watchAdForQuota(nonce);
    await syncBalance();
    setShowQuotaModal(false);
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
          showSwap={false}
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
          <SubtitleIdleState isDark={isDark} isListening={isListening} t={t} />
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
          label={isListening ? t("subtitles.stopListening") : t("subtitles.startListening")}
        />
      </View>

      {/* クォータ不足モーダル */}
      <QuotaEmptyModal
        visible={showQuotaModal}
        onClose={() => setShowQuotaModal(false)}
        onWatchAd={handleWatchAdFromModal}
        isAdReady={isAdReady}
      />
    </SafeAreaView>
  );
}

type SubtitleIdleStateProps = {
  isDark: boolean;
  isListening: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
};

/** 波形アニメーションのバー数 */
const WAVE_BAR_COUNT = 5;
/** 波形アニメーションの周期（ミリ秒） */
const WAVE_DURATION_MS = 600;

/**
 * リスニング中の波形アニメーション
 */
function WaveformAnimation() {
  const anims = useRef(
    Array.from({ length: WAVE_BAR_COUNT }, () => new Animated.Value(0.3))
  ).current;

  useEffect(() => {
    const animations = anims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 100),
          Animated.timing(anim, {
            toValue: 1,
            duration: WAVE_DURATION_MS,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.3,
            duration: WAVE_DURATION_MS,
            useNativeDriver: true,
          }),
        ])
      )
    );
    animations.forEach((a) => a.start());

    return () => {
      animations.forEach((a) => a.stop());
    };
  }, [anims]);

  return (
    <View style={waveStyles.container}>
      {anims.map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            waveStyles.bar,
            { transform: [{ scaleY: anim }] },
          ]}
        />
      ))}
    </View>
  );
}

const waveStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    height: 32,
  },
  bar: {
    width: 4,
    height: 24,
    borderRadius: 2,
    backgroundColor: "rgba(250,250,249,0.4)",
  },
});

/**
 * 字幕の初期状態表示
 */
function SubtitleIdleState({ isDark, isListening, t }: SubtitleIdleStateProps) {
  if (isListening) {
    return (
      <View style={{ alignItems: "center", gap: THEME.spacing.sm }}>
        <WaveformAnimation />
        <Text style={{ fontSize: 16, color: "rgba(250,250,249,0.5)" }}>
          {t("subtitles.waitingForAudio")}
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
        {t("subtitles.idleTitle")}
      </Text>
      <Text
        style={{
          fontSize: 14,
          color: THEME.colors.textSecondary,
          textAlign: "center",
        }}
      >
        {t("subtitles.idleDescription")}
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
