import { useCallback, useRef, useState } from "react";
import {
  useAudioRecorder as useExpoAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio";
import { audioToBase64 } from "@/services/audio/recorder";
import { CHUNK_DURATION_MS } from "@/constants/audio";
import { logger } from "@/lib/logger";
import { t } from "@/i18n";
import { useSettingsStore } from "@/store/settings-store";

type UseAudioChunkerReturn = {
  isActive: boolean;
  error: string | null;
  start: (onChunk: (base64: string) => void) => Promise<void>;
  stop: () => Promise<void>;
};

/**
 * 音声自動チャンクフック
 *
 * useExpoAudioRecorderフックのrecorderを使用し、
 * 5秒ごとに自動で録音→停止→base64変換→コールバック→再録音を繰り返す。
 * 再prepareに失敗した場合はループを停止しエラーを表示する。
 */
export function useAudioChunker(): UseAudioChunkerReturn {
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorder = useExpoAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const shouldContinueRef = useRef(false);
  const callbackRef = useRef<((base64: string) => void) | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * 1チャンクサイクルを実行する
   *
   * prepare → record → 5秒待機 → stop → base64取得 → コールバック → 次サイクル
   */
  const runChunkCycle = useCallback(async () => {
    if (!shouldContinueRef.current) return;

    try {
      await recorder.prepareToRecordAsync();
      recorder.record();

      await new Promise<void>((resolve) => {
        timeoutRef.current = setTimeout(resolve, CHUNK_DURATION_MS);
      });

      if (!shouldContinueRef.current) return;

      await recorder.stop();
      const uri = recorder.uri;

      if (uri && callbackRef.current) {
        try {
          const base64 = await audioToBase64(uri);
          callbackRef.current(base64);
        } catch (e) {
          logger.warn(t(useSettingsStore.getState().locale, "errors.chunkReadFailed"), {
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }

      if (shouldContinueRef.current) {
        setTimeout(() => runChunkCycle(), 0);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(t(useSettingsStore.getState().locale, "errors.chunkCycleError"), { error: msg });
      // prepareToRecordAsync失敗など録音開始できない場合のユーザー向けメッセージ
      const locale = useSettingsStore.getState().locale;
      const userMsg =
        msg.includes("prepare") || msg.includes("record")
          ? t(locale, "errors.recordingRestart")
          : msg;
      setError(userMsg);
      shouldContinueRef.current = false;
      setIsActive(false);
    }
  }, [recorder]);

  /**
   * チャンク録音を開始する
   *
   * @param onChunk - 各チャンクのbase64データを受け取るコールバック
   */
  const start = useCallback(
    async (onChunk: (base64: string) => void) => {
      setError(null);

      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        setError(t(useSettingsStore.getState().locale, "errors.microphonePermission"));
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      callbackRef.current = onChunk;
      shouldContinueRef.current = true;
      setIsActive(true);

      runChunkCycle();
    },
    [runChunkCycle]
  );

  /**
   * チャンク録音を停止する
   *
   * チャンクサイクルの途中で止まった場合のみstop()を試みる。
   * すでに最後のサイクルでstop()済みの場合はエラーを無視する。
   */
  const stop = useCallback(async () => {
    shouldContinueRef.current = false;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // recorderがまだ録音中の可能性があるため試みるが、
    // すでに停止済みの場合はエラーを無視する
    try {
      await recorder.stop();
    } catch {
      /* 停止済みの場合のエラーは無視 */
    }

    callbackRef.current = null;
    setIsActive(false);
  }, [recorder]);

  return { isActive, error, start, stop };
}
