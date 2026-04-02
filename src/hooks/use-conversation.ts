import * as Crypto from "expo-crypto";
import { useCallback, useRef, useState } from "react";
import { ApiError, getErrorMessage } from "@/lib/error";
import { logger } from "@/lib/logger";
import { transcribeSync } from "@/services/api/runpod";
import { translateText } from "@/services/api/translator";
import { speak } from "@/services/api/tts";
import { useConversationStore } from "@/store/conversation-store";
import { useQuotaStore } from "@/store/quota-store";
import { useSettingsStore } from "@/store/settings-store";
import type { ConversationMessage, Speaker } from "@/types/conversation";
import { enqueueChunk, type QueueItem } from "./conversation-queue";
import { useAudioChunker } from "./use-audio-chunker";

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
  const quotaStore = useQuotaStore();
  const chunker = useAudioChunker();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeSpeakerRef = useRef<Speaker>("speaker1");
  /** chunkerへの参照（クォータ不足時に停止するため） */
  const chunkerRef = useRef(chunker);
  chunkerRef.current = chunker;
  /** チャンク処理キュー（逐次実行を保証） */
  const queueRef = useRef<QueueItem[]>([]);
  const isQueueRunningRef = useRef(false);
  /** 録音中かどうか（停止後のチャンク処理をスキップ） */
  const isRecordingRef = useRef(false);

  /**
   * キューからチャンクを1つずつ逐次処理する
   */
  const drainQueue = useCallback(async () => {
    if (isQueueRunningRef.current) return;
    isQueueRunningRef.current = true;
    setIsProcessing(true);

    while (queueRef.current.length > 0) {
      const item = queueRef.current.shift()!;

      try {
        const sttResult = await transcribeSync(item.base64, item.sourceLanguage);
        if (!sttResult.text.trim()) continue;

        const translated = await translateText(
          sttResult.text,
          item.sourceLanguage,
          item.targetLanguage,
        );

        const message: ConversationMessage = {
          id: Crypto.randomUUID(),
          speaker: item.speaker,
          originalText: sttResult.text,
          translatedText: translated,
          sourceLanguage: item.sourceLanguage,
          targetLanguage: item.targetLanguage,
          timestamp: Date.now(),
        };
        useConversationStore.getState().addMessage(message);

        if (settings.autoPlayTts) {
          speak(translated, item.targetLanguage);
        }

        await quotaStore.syncBalance();
      } catch (err) {
        if (err instanceof ApiError && err.errorCode === "QUOTA_INSUFFICIENT") {
          queueRef.current = [];
          await chunkerRef.current.stop();
        }
        setError(getErrorMessage(err));
        logger.error("チャンク通訳処理エラー", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    isQueueRunningRef.current = false;
    setIsProcessing(false);
  }, [settings.autoPlayTts, quotaStore]);

  /**
   * チャンクをキューに追加し、逐次処理を開始する
   *
   * 録音時点の話者・言語設定をスナップショットしてキューに積む。
   */
  const processChunk = useCallback(
    (base64: string) => {
      const currentSpeaker = activeSpeakerRef.current;
      const latestState = useConversationStore.getState();
      enqueueChunk(
        queueRef.current,
        base64,
        currentSpeaker,
        latestState.speaker1Language,
        latestState.speaker2Language,
      );
      drainQueue();
    },
    [drainQueue],
  );

  /**
   * 録音開始（自動チャンク）
   */
  const startSpeaking = useCallback(
    async (speaker: Speaker) => {
      setError(null);
      isRecordingRef.current = true;
      activeSpeakerRef.current = speaker;
      store.setActiveSpeaker(speaker);
      await chunker.start(processChunk);
    },
    [chunker, store, processChunk],
  );

  /**
   * 録音停止
   *
   * 新しいチャンクの受付を止めるが、キューに残っている
   * （停止直前まで録れた）チャンクは最後まで処理する。
   */
  const stopSpeaking = useCallback(async () => {
    isRecordingRef.current = false;
    await chunker.stop();
    // キューは破棄しない — drainQueue が残りを処理し終えるまで走る
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
