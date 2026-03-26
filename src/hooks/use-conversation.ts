import { useCallback, useRef, useState } from "react";
import * as Crypto from "expo-crypto";
import { useConversationStore } from "@/store/conversation-store";
import { useSettingsStore } from "@/store/settings-store";
import { useAudioChunker } from "./use-audio-chunker";
import { transcribeSync } from "@/services/api/runpod";
import { translateText } from "@/services/api/translator";
import { speak } from "@/services/api/tts";
import { logger } from "@/lib/logger";
import { getErrorMessage } from "@/lib/error";
import type { ConversationMessage, Speaker } from "@/types/conversation";

type UseConversationReturn = {
  messages: ConversationMessage[];
  activeSpeaker: Speaker;
  isRecording: boolean;
  isProcessing: boolean;
  error: string | null;
  startSpeaking: (speaker: Speaker) => Promise<void>;
  stopSpeaking: () => Promise<void>;
  clearConversation: () => void;
};

/**
 * 対面通訳フック
 *
 * マイクボタンを押して録音開始→自動チャンク（5秒ごと）→
 * 各チャンクをSTT→翻訳→メッセージ追加でリアルタイム通訳を実行する。
 * もう一度押して停止。
 */
export function useConversation(): UseConversationReturn {
  const store = useConversationStore();
  const settings = useSettingsStore();
  const chunker = useAudioChunker();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeSpeakerRef = useRef<Speaker>("speaker1");
  /** 処理中チャンク数を追跡する */
  const processingCountRef = useRef(0);

  /**
   * 1チャンクを処理する（STT→翻訳→メッセージ追加）
   */
  const processChunk = useCallback(
    async (base64: string) => {
      const currentSpeaker = activeSpeakerRef.current;
      const sourceLanguage =
        currentSpeaker === "speaker1"
          ? store.speaker1Language
          : store.speaker2Language;
      const targetLanguage =
        currentSpeaker === "speaker1"
          ? store.speaker2Language
          : store.speaker1Language;

      processingCountRef.current += 1;
      setIsProcessing(true);

      try {
        const sttResult = await transcribeSync(base64, sourceLanguage);
        if (!sttResult.text.trim()) return;

        const translated = await translateText(
          sttResult.text,
          sourceLanguage,
          targetLanguage
        );

        const message: ConversationMessage = {
          id: Crypto.randomUUID(),
          speaker: currentSpeaker,
          originalText: sttResult.text,
          translatedText: translated,
          sourceLanguage,
          targetLanguage,
          timestamp: Date.now(),
        };
        store.addMessage(message);

        if (settings.autoPlayTts) {
          speak(translated, targetLanguage);
        }
      } catch (err) {
        setError(getErrorMessage(err));
        logger.error("チャンク通訳処理エラー", {
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        processingCountRef.current -= 1;
        if (processingCountRef.current <= 0) {
          processingCountRef.current = 0;
          setIsProcessing(false);
        }
      }
    },
    [store, settings.autoPlayTts]
  );

  /**
   * 録音開始（自動チャンク）
   */
  const startSpeaking = useCallback(
    async (speaker: Speaker) => {
      setError(null);
      activeSpeakerRef.current = speaker;
      store.setActiveSpeaker(speaker);
      await chunker.start(processChunk);
    },
    [chunker, store, processChunk]
  );

  /**
   * 録音停止（すべてのチャンクは個別処理済み）
   */
  const stopSpeaking = useCallback(async () => {
    await chunker.stop();
  }, [chunker]);

  /**
   * 会話クリア
   */
  const clearConversation = useCallback(() => {
    store.clearMessages();
  }, [store]);

  /** チャンカーエラーとプロセスエラーを統合する */
  const combinedError = chunker.error ?? error;

  return {
    messages: store.messages,
    activeSpeaker: store.activeSpeaker,
    isRecording: chunker.isActive,
    isProcessing,
    error: combinedError,
    startSpeaking,
    stopSpeaking,
    clearConversation,
  };
}
