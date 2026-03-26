import { useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Animated,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Loader2 } from "lucide-react-native";
import { useConversation } from "@/hooks/use-conversation";
import { useConversationStore } from "@/store/conversation-store";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { RecordButton } from "@/components/ui/RecordButton";
import { getLanguageDisplayName } from "@/constants/languages";
import { THEME } from "@/constants/theme";
import { t } from "@/i18n";
import type { Locale } from "@/i18n";
import type { ConversationMessage } from "@/types/conversation";

/** パルスアニメーションの最小不透明度 */
const PULSE_MIN_OPACITY = 0.3;
/** パルスアニメーションの1サイクル時間（ミリ秒） */
const PULSE_DURATION_MS = 800;
/** 話者2エリアの背景色（淡い青みがかった白） */
const SPEAKER2_BG = "#f0f9ff";
/** 話者1エリアの背景色（暖かみのある白） */
const SPEAKER1_BG = "#fafaf9";
/** メッセージバブルの影色 */
const BUBBLE_SHADOW = "#0c0a09";

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
 *
 * 回転エリア（話者2）はコード順序が物理と逆になる:
 *   コード上部 = 言語選択（物理的に中央線近く）
 *   コード中部 = メッセージ
 *   コード下部 = マイク+言語ペア（物理的に上端＝話者2の手元）
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
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isRecording) {
      pulseAnim.setValue(1);
      return;
    }
    const anim = Animated.loop(
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
    anim.start();
    return () => anim.stop();
  }, [isRecording, pulseAnim]);

  const handleSpeaker2Press = () => {
    if (isRecording && activeSpeaker === "speaker2") {
      stopSpeaking();
      return;
    }
    if (isRecording) return;
    startSpeaking("speaker2");
  };

  const handleSpeaker1Press = () => {
    if (isRecording && activeSpeaker === "speaker1") {
      stopSpeaking();
      return;
    }
    if (isRecording) return;
    startSpeaking("speaker1");
  };

  const sp1Msgs = messages.filter((m) => m.speaker === "speaker1");
  const sp2Msgs = messages.filter((m) => m.speaker === "speaker2");

  const isSpeaker1Recording = isRecording && activeSpeaker === "speaker1";
  const isSpeaker2Recording = isRecording && activeSpeaker === "speaker2";
  const isSpeaker1Processing = isProcessing && activeSpeaker === "speaker1";
  const isSpeaker2Processing = isProcessing && activeSpeaker === "speaker2";

  /** 話者ごとのUIロケール */
  const sp1Locale: Locale = toLocale(store.speaker1Language);
  const sp2Locale: Locale = toLocale(store.speaker2Language);

  /** ローカライズされた言語ペア表示 */
  const sp1LangPair = `${getLanguageDisplayName(store.speaker1Language, sp1Locale)} \u2192 ${getLanguageDisplayName(store.speaker2Language, sp1Locale)}`;
  const sp2LangPair = `${getLanguageDisplayName(store.speaker2Language, sp2Locale)} \u2192 ${getLanguageDisplayName(store.speaker1Language, sp2Locale)}`;

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      {/* ===== エラーバナー ===== */}
      {error ? (
        <View style={styles.errorBannerTop}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      {/* ===== 話者2エリア（180度回転） ===== */}
      {/* コード順序は物理と逆: 言語選択→メッセージ→マイク+言語ペア */}
      <View style={[styles.speakerArea, styles.speaker2Area]}>
        <View style={styles.speakerInner}>
          {/* 言語選択（物理的に中央線近く） */}
          <View style={styles.langSelectorRow}>
            <LanguageSelector
              value={store.speaker2Language}
              onChange={(lang) => store.setSpeaker2Language(lang)}
              style={styles.langSelectorCompact}
            />
          </View>

          {/* メッセージエリア（話者1が話した内容の翻訳が表示される） */}
          <ScrollView
            style={styles.messageScroll}
            contentContainerStyle={[
              styles.messageScrollContent,
              sp1Msgs.length === 0 && !isSpeaker2Recording && styles.messageScrollEmpty,
            ]}
          >
            {sp1Msgs.length === 0 && !isSpeaker2Recording ? (
              <EmptyHint text={t(sp2Locale, "conversation.emptyState")} />
            ) : (
              sp1Msgs.slice(-6).map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))
            )}
          </ScrollView>

          {/* マイク + 言語ペア（物理的に上端＝話者2の手元） */}
          <View style={styles.micRow}>
            <RecordButton
              isRecording={isSpeaker2Recording}
              onPress={handleSpeaker2Press}
              disabled={isProcessing || (isRecording && !isSpeaker2Recording)}
              size={72}
            />
            <View style={styles.micLabelBlock}>
              <Text style={styles.micLangPairText}>{sp2LangPair}</Text>
              <StatusLabel
                isRecording={isSpeaker2Recording}
                isProcessing={isSpeaker2Processing}
                pulseAnim={pulseAnim}
                recordingLabel={t(sp2Locale, "conversation.recording")}
                processingLabel={t(sp2Locale, "conversation.translating")}
                tapHint={t(sp2Locale, "conversation.startRecording")}
              />
            </View>
          </View>
        </View>
      </View>

      {/* ===== 区切り線 ===== */}
      <Divider isProcessing={isProcessing} />

      {/* ===== 話者1エリア（正位置） ===== */}
      {/* コード順序は物理と同じ: 言語選択→メッセージ→マイク+言語ペア */}
      <View style={[styles.speakerArea, styles.speaker1Area]}>
        {/* 言語選択（物理的に中央線近く） */}
        <View style={styles.langSelectorRow}>
          <LanguageSelector
            value={store.speaker1Language}
            onChange={(lang) => store.setSpeaker1Language(lang)}
            style={styles.langSelectorCompact}
          />
        </View>

        {/* メッセージエリア（話者2が話した内容の翻訳が表示される） */}
        <ScrollView
          style={styles.messageScroll}
          contentContainerStyle={[
            styles.messageScrollContent,
            sp2Msgs.length === 0 && !isSpeaker1Recording && styles.messageScrollEmpty,
          ]}
        >
          {sp2Msgs.length === 0 && !isSpeaker1Recording ? (
            <EmptyHint text={t(sp1Locale, "conversation.emptyState")} />
          ) : (
            sp2Msgs.slice(-6).map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))
          )}
        </ScrollView>

        {/* マイク + 言語ペア（物理的に下端＝話者1の手元） */}
        <View style={styles.micRow}>
          <RecordButton
            isRecording={isSpeaker1Recording}
            onPress={handleSpeaker1Press}
            disabled={isProcessing || (isRecording && !isSpeaker1Recording)}
            size={72}
          />
          <View style={styles.micLabelBlock}>
            <Text style={styles.micLangPairText}>{sp1LangPair}</Text>
            <StatusLabel
              isRecording={isSpeaker1Recording}
              isProcessing={isSpeaker1Processing}
              pulseAnim={pulseAnim}
              recordingLabel={t(sp1Locale, "conversation.recording")}
              processingLabel={t(sp1Locale, "conversation.translating")}
              tapHint={t(sp1Locale, "conversation.startRecording")}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// サブコンポーネント
// ─────────────────────────────────────────────────────────────

type StatusLabelProps = {
  isRecording: boolean;
  isProcessing: boolean;
  pulseAnim: Animated.Value;
  recordingLabel: string;
  processingLabel: string;
  tapHint: string;
};

/**
 * 録音/翻訳中/タップヒントのステータスラベル
 */
function StatusLabel({
  isRecording,
  isProcessing,
  pulseAnim,
  recordingLabel,
  processingLabel,
  tapHint,
}: StatusLabelProps) {
  if (isRecording) {
    return (
      <Animated.Text style={[styles.recordingLabel, { opacity: pulseAnim }]}>
        {recordingLabel}
      </Animated.Text>
    );
  }
  if (isProcessing) {
    return (
      <View style={styles.translatingRow}>
        <Loader2 size={10} color={THEME.colors.primary} />
        <Text style={styles.translatingText}>{processingLabel}</Text>
      </View>
    );
  }
  return <Text style={styles.tapHint}>{tapHint}</Text>;
}

/**
 * 中央区切り線
 */
function Divider({ isProcessing }: { isProcessing: boolean }) {
  return (
    <View style={styles.divider}>
      {isProcessing ? (
        <View style={styles.dividerProcessing}>
          <Loader2 size={10} color={THEME.colors.primary} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * メッセージがない時の控えめなヒント表示
 */
function EmptyHint({ text }: { text: string }) {
  return (
    <View style={styles.emptyHint}>
      <Text style={styles.emptyHintText}>{text}</Text>
    </View>
  );
}

/**
 * 翻訳結果のメッセージバブル
 */
function MessageBubble({ message }: { message: ConversationMessage }) {
  return (
    <View style={styles.bubble}>
      <Text style={styles.bubbleTranslated}>{message.translatedText}</Text>
      <Text style={styles.bubbleOriginal}>{message.originalText}</Text>
    </View>
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

  errorBannerTop: {
    paddingHorizontal: THEME.spacing.md,
    paddingTop: THEME.spacing.xs,
  },

  /* 話者エリア共通 */
  speakerArea: {
    flex: 1,
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
    flexDirection: "column",
  },

  /* 言語セレクター（コンパクト） */
  langSelectorRow: {
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.xs,
  },
  langSelectorCompact: {
    flex: 0,
  },

  /* メッセージスクロールエリア */
  messageScroll: {
    flex: 1,
    paddingHorizontal: THEME.spacing.md,
  },
  messageScrollContent: {
    paddingVertical: THEME.spacing.xs,
    gap: 6,
  },
  messageScrollEmpty: {
    flexGrow: 1,
    justifyContent: "center",
  },

  /* マイク + 言語ペア行（横並び） */
  micRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: THEME.spacing.md,
  },
  micLabelBlock: {
    gap: 2,
  },
  micLangPairText: {
    fontSize: 13,
    color: THEME.colors.text,
    fontWeight: "600",
    letterSpacing: 0.3,
  },

  /* ステータスラベル */
  recordingLabel: {
    fontSize: 11,
    color: THEME.colors.error,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  translatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  translatingText: {
    fontSize: 11,
    color: THEME.colors.primary,
    fontWeight: "600",
  },
  tapHint: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    letterSpacing: 0.2,
  },

  /* 区切り線 */
  divider: {
    height: 2,
    backgroundColor: THEME.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
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

  /* 空状態ヒント */
  emptyHint: {
    alignItems: "center",
    paddingVertical: THEME.spacing.md,
  },
  emptyHintText: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    letterSpacing: 0.3,
  },

  /* メッセージバブル */
  bubble: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    shadowColor: BUBBLE_SHADOW,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  bubbleTranslated: {
    fontSize: 15,
    color: THEME.colors.text,
    fontWeight: "500",
    lineHeight: 22,
  },
  bubbleOriginal: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    marginTop: 3,
    lineHeight: 16,
  },
});
