import { useRef, useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  PanResponder,
  LayoutChangeEvent,
  Animated,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Loader2, MessageCircle, Play } from "lucide-react-native";
import { useConversation } from "@/hooks/use-conversation";
import { useConversationStore } from "@/store/conversation-store";
import { useQuota } from "@/hooks/use-quota";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { RecordButton } from "@/components/ui/RecordButton";
import { QuotaEmptyModal } from "@/components/quota/QuotaEmptyModal";
import { THEME } from "@/constants/theme";
import { t } from "@/i18n";
import type { Locale } from "@/i18n";
import type { ConversationMessage } from "@/types/conversation";
import {
  preloadRewardedAd,
  showRewardedAd,
  subscribeRewardedAdReady,
} from "@/services/ads/rewarded-ad";
import { requestAdNonce, consumeAdNonce } from "@/services/api/quota";
import { useT } from "@/i18n";

/** 話者2エリアの背景色（淡い青みがかった白） */
const SPEAKER2_BG = "#f0f9ff";
/** 話者1エリアの背景色（暖かみのある白） */
const SPEAKER1_BG = "#fafaf9";
/** メッセージバブルの影色 */
const BUBBLE_SHADOW = "#0c0a09";
/** ドラッグ分割比率の最小値 */
const SPLIT_RATIO_MIN = 0.2;
/** ドラッグ分割比率の最大値 */
const SPLIT_RATIO_MAX = 0.8;
/** ドラッグ分割比率の初期値（50:50） */
const SPLIT_RATIO_DEFAULT = 0.5;
/** ドラッグハンドルの幅 */
const DRAG_HANDLE_WIDTH = 40;
/** ドラッグハンドルの高さ */
const DRAG_HANDLE_HEIGHT = 4;
/** 区切り線のタッチ領域の高さ */
const DIVIDER_HIT_HEIGHT = 36;

/**
 * 言語コードからUIロケールを導出する
 *
 * @param language - 言語コード
 * @returns 対応するLocale（"ja" または "en"）
 */
function toLocale(language: string): Locale {
  if (language === "ja") return "ja";
  return "en";
}

/**
 * 対面通訳画面
 *
 * 物理レイアウト（テーブルに置いた状態）:
 * ┌────────────────────────────────────┐
 * │ [マイク] English → Japanese       │ ← 話者2の手元（上端）180度回転
 * │                                    │
 * │ 翻訳テキスト...                   │ ← 180度回転
 * │                                    │
 * │ [English ▼]                       │ ← 話者2の言語選択（中央線近く）
 * ├──── 2px 区切り線 ─────────────────┤
 * │ [日本語 ▼]                        │ ← 話者1の言語選択（中央線近く）
 * │                                    │
 * │ 翻訳テキスト...                   │
 * │                                    │
 * │ [マイク] 日本語 → 英語            │ ← 話者1の手元（下端）
 * └────────────────────────────────────┘
 */
export default function ConversationScreen() {
  const {
    messages,
    activeSpeaker,
    isRecording,
    isProcessing,
    error,
    startSpeaking,
    stopSpeaking,
  } = useConversation();

  const store = useConversationStore();
  const { canStartConversation, watchAdForQuota, syncBalance } = useQuota();
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [isAdReady, setIsAdReady] = useState(false);
  const tl = useT();

  /** スクロールビューのref（最新メッセージへの自動スクロール用） */
  const scrollRef1 = useRef<ScrollView>(null);
  const scrollRef2 = useRef<ScrollView>(null);

  /** 話者エリアの分割比率（話者2側の割合） */
  const [splitRatio, setSplitRatio] = useState(SPLIT_RATIO_DEFAULT);
  /** 現在の分割比率をrefで保持（PanResponderのstale closure対策） */
  const splitRatioRef = useRef(SPLIT_RATIO_DEFAULT);
  /** コンテナ全体の高さをrefで保持（PanResponderのstale closure対策） */
  const containerHeightRef = useRef(0);
  /** ドラッグ開始時の分割比率を保持 */
  const splitRatioAtDragStart = useRef(SPLIT_RATIO_DEFAULT);

  /**
   * コンテナのレイアウト変更時に高さを記録する
   */
  const handleContainerLayout = useCallback((e: LayoutChangeEvent) => {
    containerHeightRef.current = e.nativeEvent.layout.height;
  }, []);

  /** splitRatio変更時にrefも同期 */
  useEffect(() => {
    splitRatioRef.current = splitRatio;
  }, [splitRatio]);

  useEffect(() => {
    preloadRewardedAd();
    return subscribeRewardedAdReady(setIsAdReady);
  }, []);

  /**
   * 区切り線のドラッグで分割比率を変更するPanResponder
   */
  const dividerPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => {
        splitRatioAtDragStart.current = splitRatioRef.current;
      },
      onPanResponderMove: (_, gestureState) => {
        if (containerHeightRef.current <= 0) return;
        const newRatio = Math.max(
          SPLIT_RATIO_MIN,
          Math.min(
            SPLIT_RATIO_MAX,
            splitRatioAtDragStart.current + gestureState.dy / containerHeightRef.current
          )
        );
        setSplitRatio(newRatio);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (containerHeightRef.current <= 0) return;
        const newRatio = Math.max(
          SPLIT_RATIO_MIN,
          Math.min(
            SPLIT_RATIO_MAX,
            splitRatioAtDragStart.current + gestureState.dy / containerHeightRef.current
          )
        );
        setSplitRatio(newRatio);
      },
    })
  ).current;

  const handleSpeaker2Press = () => {
    if (isRecording && activeSpeaker === "speaker2") {
      stopSpeaking();
      return;
    }
    if (isRecording) return;
    if (!canStartConversation) {
      setShowQuotaModal(true);
      return;
    }
    startSpeaking("speaker2");
  };

  const handleSpeaker1Press = () => {
    if (isRecording && activeSpeaker === "speaker1") {
      stopSpeaking();
      return;
    }
    if (isRecording) return;
    if (!canStartConversation) {
      setShowQuotaModal(true);
      return;
    }
    startSpeaking("speaker1");
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

  /** 全メッセージをタイムスタンプ順にソート */
  const allMsgsSorted = [...messages].sort((a, b) => a.timestamp - b.timestamp);

  /**
   * メッセージ追加時に両スクロールビューを最下部にスクロールする
   */
  useEffect(() => {
    if (allMsgsSorted.length === 0) return;
    const timer = setTimeout(() => {
      scrollRef1.current?.scrollToEnd({ animated: true });
      scrollRef2.current?.scrollToEnd({ animated: true });
    }, 100);
    return () => clearTimeout(timer);
  }, [allMsgsSorted.length]);

  const isSpeaker1Recording = isRecording && activeSpeaker === "speaker1";
  const isSpeaker2Recording = isRecording && activeSpeaker === "speaker2";

  /** 話者ごとのUIロケール */
  const sp1Locale: Locale = toLocale(store.speaker1Language);
  const sp2Locale: Locale = toLocale(store.speaker2Language);

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <View style={styles.container} onLayout={handleContainerLayout}>
        {/* ===== 話者2エリア（180度回転） ===== */}
        <View style={[styles.speakerArea, styles.speaker2Area, { flex: splitRatio }]}>
          <View style={styles.speakerInner}>
            {/* 言語選択（物理的に中央線近く＝コード上部） */}
            <View style={styles.langSelectorRow}>
              <LanguageSelector
                value={store.speaker2Language}
                onChange={(lang) => store.setSpeaker2Language(lang)}
                style={styles.langSelectorCompact}
                compact
              />
            </View>

            {/* メッセージエリア */}
            <ScrollView
              ref={scrollRef2}
              style={styles.messageScroll}
              contentContainerStyle={[
                styles.messageScrollContent,
                allMsgsSorted.length === 0 && !isSpeaker2Recording && styles.messageScrollEmpty,
              ]}
            >
              {allMsgsSorted.length === 0 && !isSpeaker2Recording ? (
                <EmptyHint text={t(sp2Locale, "conversation.emptyState")} />
              ) : (
                allMsgsSorted.slice(-6).map((m) => (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    showOriginalAsMain={m.speaker === "speaker2"}
                  />
                ))
              )}
            </ScrollView>

            {/* マイク（物理的に上端＝話者2の手元） */}
            <View style={[styles.micRow, styles.micRowSpeaker2]}>
              <RecordButton
                isRecording={isSpeaker2Recording}
                onPress={handleSpeaker2Press}
                disabled={!isSpeaker2Recording && (isProcessing || isRecording)}
                size={56}
                testID="record-button-speaker2"
              />
              {isSpeaker2Recording && (
                <Text style={styles.recordingLabel}>{tl("conversation.recording")}</Text>
              )}
            </View>

            {/* エラーオーバーレイ（話者2用） */}
            {error && activeSpeaker === "speaker2" ? (
              <View style={styles.errorOverlay}>
                <ErrorBanner
                  message={error}
                  onRetry={() => startSpeaking("speaker2")}
                  onDismiss={() => {}}
                />
              </View>
            ) : null}

            {/* クォータ不足時のインライン広告ボタン（話者2用） */}
            {error && error.toLowerCase().includes("quota") && activeSpeaker === "speaker2" && isAdReady ? (
              <View style={styles.inlineAdButton}>
                <Pressable
                  onPress={handleWatchAdFromModal}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    paddingVertical: 8,
                    paddingHorizontal: 16,
                    borderRadius: THEME.borderRadius.sm,
                    backgroundColor: pressed ? THEME.colors.primaryDark : THEME.colors.primary,
                  })}
                >
                  <Play size={14} color="#ffffff" />
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#ffffff" }}>
                    {tl("errors.watchAdToContinue")}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>

        {/* ===== ドラッグ可能な区切り線 ===== */}
        <View
          {...dividerPanResponder.panHandlers}
          style={styles.dividerTouchArea}
        >
          <View style={styles.dividerLine}>
            {isProcessing ? (
              <View style={styles.dividerProcessing}>
                <Loader2 size={10} color={THEME.colors.primary} />
              </View>
            ) : null}
          </View>
          <View style={styles.dragHandle} />
        </View>

        {/* ===== 話者1エリア（正位置） ===== */}
        <View style={[styles.speakerArea, styles.speaker1Area, { flex: 1 - splitRatio }]}>
          <View style={styles.speakerInner}>
            {/* 言語選択（物理的に中央線近く） */}
            <View style={styles.langSelectorRow}>
              <LanguageSelector
                value={store.speaker1Language}
                onChange={(lang) => store.setSpeaker1Language(lang)}
                style={styles.langSelectorCompact}
                compact
              />
            </View>

            {/* メッセージエリア */}
            <ScrollView
              ref={scrollRef1}
              style={styles.messageScroll}
              contentContainerStyle={[
                styles.messageScrollContent,
                allMsgsSorted.length === 0 && !isSpeaker1Recording && styles.messageScrollEmpty,
              ]}
            >
              {allMsgsSorted.length === 0 && !isSpeaker1Recording ? (
                <EmptyHint text={t(sp1Locale, "conversation.emptyState")} />
              ) : (
                allMsgsSorted.slice(-6).map((m) => (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    showOriginalAsMain={m.speaker === "speaker1"}
                  />
                ))
              )}
            </ScrollView>

            {/* マイク（物理的に下端＝話者1の手元） */}
            <View style={styles.micRow}>
              <RecordButton
                isRecording={isSpeaker1Recording}
                onPress={handleSpeaker1Press}
                disabled={!isSpeaker1Recording && (isProcessing || isRecording)}
                size={56}
                testID="record-button-speaker1"
              />
              {isSpeaker1Recording && (
                <Text style={styles.recordingLabel}>{tl("conversation.recording")}</Text>
              )}
            </View>

            {/* エラーオーバーレイ（話者1用） */}
            {error && activeSpeaker !== "speaker2" ? (
              <View style={styles.errorOverlay}>
                <ErrorBanner
                  message={error}
                  onRetry={() => startSpeaking("speaker1")}
                  onDismiss={() => {}}
                />
              </View>
            ) : null}

            {/* クォータ不足時のインライン広告ボタン（話者1用） */}
            {error && error.toLowerCase().includes("quota") && activeSpeaker !== "speaker2" && isAdReady ? (
              <View style={styles.inlineAdButton}>
                <Pressable
                  onPress={handleWatchAdFromModal}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    paddingVertical: 8,
                    paddingHorizontal: 16,
                    borderRadius: THEME.borderRadius.sm,
                    backgroundColor: pressed ? THEME.colors.primaryDark : THEME.colors.primary,
                  })}
                >
                  <Play size={14} color="#ffffff" />
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#ffffff" }}>
                    {tl("errors.watchAdToContinue")}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* ===== クォータ不足モーダル ===== */}
      <QuotaEmptyModal
        visible={showQuotaModal}
        onClose={() => setShowQuotaModal(false)}
        onWatchAd={handleWatchAdFromModal}
        isAdReady={isAdReady}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// サブコンポーネント
// ─────────────────────────────────────────────────────────────

/**
 * メッセージがない時のヒント表示（アイコン + サブテキスト付き）
 */
function EmptyHint({ text }: { text: string }) {
  return (
    <View style={styles.emptyHint}>
      <MessageCircle size={32} color={THEME.colors.textMuted} />
      <Text style={styles.emptyHintTitle}>{text}</Text>
      <Text style={styles.emptyHintSub}>
        {/* マイクボタンから録音してください */}
      </Text>
    </View>
  );
}

type MessageBubbleProps = {
  message: ConversationMessage;
  /** trueのとき、originalTextをメインテキストとして表示する（話者自身の発言側） */
  showOriginalAsMain: boolean;
};

/** 自分の発言バブル背景色 */
const BUBBLE_MINE_BG = "#e0f2f1";
/** 相手の発言バブル背景色 */
const BUBBLE_THEIRS_BG = "#f5f5f4";

/** メッセージバブルのフェードインアニメーション周期（ミリ秒） */
const BUBBLE_FADE_DURATION_MS = 250;

/**
 * 翻訳結果のメッセージバブル（フェードインアニメーション付き）
 */
function MessageBubble({ message, showOriginalAsMain }: MessageBubbleProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const mainText = showOriginalAsMain ? message.originalText : message.translatedText;
  const subText = showOriginalAsMain ? message.translatedText : message.originalText;
  const isMine = showOriginalAsMain;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: BUBBLE_FADE_DURATION_MS,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  return (
    <Animated.View
      style={[
        styles.bubble,
        { backgroundColor: isMine ? BUBBLE_MINE_BG : BUBBLE_THEIRS_BG, opacity: fadeAnim },
      ]}
    >
      <Text style={[styles.bubbleTranslated, isMine && { color: THEME.colors.primaryDark }]}>{mainText}</Text>
      {subText ? <Text style={styles.bubbleOriginal}>{subText}</Text> : null}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
// スタイル定義
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },

  container: {
    flex: 1,
  },

  errorOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },

  speakerArea: {
    overflow: "hidden",
  },
  speaker2Area: {
    transform: [{ rotate: "180deg" }],
    backgroundColor: SPEAKER2_BG,
  },
  speakerInner: {
    flex: 1,
    flexDirection: "column",
  },
  speaker1Area: {
    backgroundColor: SPEAKER1_BG,
  },

  langSelectorRow: {
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: 2,
  },
  langSelectorCompact: {
    flex: 0,
  },

  messageScroll: {
    flex: 1,
    paddingHorizontal: THEME.spacing.sm,
  },
  messageScrollContent: {
    paddingVertical: 2,
    gap: 4,
  },
  messageScrollEmpty: {
    flexGrow: 1,
    justifyContent: "center",
  },

  micRow: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  micRowSpeaker2: {
    paddingBottom: 16,
  },

  recordingLabel: {
    fontSize: 11,
    color: THEME.colors.error,
    fontWeight: "600",
    marginTop: 2,
  },

  dividerTouchArea: {
    height: DIVIDER_HIT_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    backgroundColor: "transparent",
  },
  dividerLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: THEME.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  dragHandle: {
    width: DRAG_HANDLE_WIDTH,
    height: DRAG_HANDLE_HEIGHT,
    backgroundColor: THEME.colors.textMuted,
    borderRadius: DRAG_HANDLE_HEIGHT / 2,
  },
  dividerProcessing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: THEME.borderRadius.full,
    borderWidth: 1,
    borderColor: THEME.colors.primary,
    position: "absolute",
  },

  emptyHint: {
    alignItems: "center",
    paddingVertical: THEME.spacing.md,
    gap: 8,
  },
  emptyHintTitle: {
    fontSize: 14,
    color: THEME.colors.textMuted,
    letterSpacing: 0.3,
    fontWeight: "500",
  },
  emptyHintSub: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    textAlign: "center",
  },
  emptyHintText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    letterSpacing: 0.3,
  },
  inlineAdButton: {
    position: "absolute",
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },

  bubble: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.sm,
    padding: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    shadowColor: BUBBLE_SHADOW,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  bubbleTranslated: {
    fontSize: 14,
    color: THEME.colors.text,
    fontWeight: "500",
    lineHeight: 20,
  },
  bubbleOriginal: {
    fontSize: 10,
    color: THEME.colors.textSecondary,
    marginTop: 2,
    lineHeight: 14,
  },
});
