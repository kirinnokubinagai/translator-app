import { useCallback, useState } from "react";
import {
  useAudioRecorder as useExpoAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio";
import { audioToBase64 } from "@/services/audio/recorder";
import { getErrorMessage } from "@/lib/error";
import { logger } from "@/lib/logger";

type UseAudioRecorderReturn = {
  isRecording: boolean;
  duration: number;
  error: string | null;
  startRecord: () => Promise<void>;
  stopRecord: () => Promise<{
    uri: string;
    base64: string;
    duration: number;
  } | null>;
  cancelRecord: () => Promise<void>;
};

/**
 * 音声録音フック
 * expo-audioを使用してマイク録音を管理する
 */
export function useAudioRecorder(): UseAudioRecorderReturn {
  const [error, setError] = useState<string | null>(null);

  const recorder = useExpoAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 100);

  const isRecording = state.isRecording;
  const duration = state.durationMillis;

  const startRecord = useCallback(async () => {
    setError(null);
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      setError("マイクの使用許可が必要です");
      return;
    }
    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (err) {
      setError(getErrorMessage(err));
      logger.error("録音開始エラー", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, [recorder]);

  const stopRecord = useCallback(async () => {
    if (!state.isRecording) return null;
    try {
      const durationMs = state.durationMillis;
      await recorder.stop();
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
      const uri = recorder.uri;
      if (!uri) return null;
      const base64 = await audioToBase64(uri);
      return { uri, base64, duration: durationMs };
    } catch (err) {
      setError(getErrorMessage(err));
      return null;
    }
  }, [recorder, state.isRecording, state.durationMillis]);

  const cancelRecord = useCallback(async () => {
    if (!state.isRecording) return;
    try {
      await recorder.stop();
    } catch {
      /* ignore */
    }
  }, [recorder, state.isRecording]);

  return { isRecording, duration, error, startRecord, stopRecord, cancelRecord };
}
