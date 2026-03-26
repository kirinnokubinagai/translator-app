import { useState, useCallback, useRef } from "react";
import { useAudioChunker } from "./use-audio-chunker";
import { transcribeSync } from "@/services/api/runpod";
import { translateText } from "@/services/api/translator";
import { useSettingsStore } from "@/store/settings-store";
import { logger } from "@/lib/logger";
import { getErrorMessage } from "@/lib/error";

/** 字幕の最大保持件数 */
const MAX_SUBTITLE_LINES = 20;

type SubtitleLine = {
  id: string;
  originalText: string;
  translatedText: string;
  timestamp: number;
};

type UseSubtitlesReturn = {
  isListening: boolean;
  subtitles: SubtitleLine[];
  isProcessing: boolean;
  error: string | null;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  clearSubtitles: () => void;
};

/**
 * リアルタイム字幕フック
 *
 * マイクボタンを押して録音開始→自動チャンク（5秒ごと）→
 * 各チャンクをRunPod Faster Whisperで文字起こし後、翻訳して字幕として表示する。
 * もう一度押して停止。
 */
export function useSubtitles(): UseSubtitlesReturn {
  const chunker = useAudioChunker();
  const [subtitles, setSubtitles] = useState<SubtitleLine[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const counterRef = useRef(0);
  const settings = useSettingsStore();
  /** 処理中チャンク数を追跡する */
  const processingCountRef = useRef(0);

  /**
   * 1チャンクを処理する（STT→翻訳→字幕追加）
   */
  const processChunk = useCallback(
    async (base64: string) => {
      processingCountRef.current += 1;
      setIsProcessing(true);

      try {
        const sttResult = await transcribeSync(
          base64,
          settings.sourceLanguage
        );
        if (!sttResult.text.trim()) return;

        const translated = await translateText(
          sttResult.text,
          settings.sourceLanguage,
          settings.targetLanguage
        );

        counterRef.current += 1;
        const line: SubtitleLine = {
          id: `subtitle-${counterRef.current}`,
          originalText: sttResult.text,
          translatedText: translated,
          timestamp: Date.now(),
        };
        setSubtitles((prev) => [
          ...prev.slice(-(MAX_SUBTITLE_LINES - 1)),
          line,
        ]);
      } catch (err) {
        setError(getErrorMessage(err));
        logger.error("字幕チャンク処理エラー", {
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
    [settings.sourceLanguage, settings.targetLanguage]
  );

  /**
   * 字幕用録音を開始する（自動チャンク）
   */
  const startListening = useCallback(async () => {
    setError(null);
    await chunker.start(processChunk);
  }, [chunker, processChunk]);

  /**
   * 字幕用録音を停止する（すべてのチャンクは個別処理済み）
   */
  const stopListening = useCallback(async () => {
    await chunker.stop();
  }, [chunker]);

  /**
   * 字幕をクリアする
   */
  const clearSubtitles = useCallback(() => {
    setSubtitles([]);
    counterRef.current = 0;
  }, []);

  /** チャンカーエラーとプロセスエラーを統合する */
  const combinedError = chunker.error ?? error;

  return {
    isListening: chunker.isActive,
    subtitles,
    isProcessing,
    error: combinedError,
    startListening,
    stopListening,
    clearSubtitles,
  };
}
