import { useCallback, useState } from "react";
import {
  useAudioRecorder as useExpoAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio";
import { audioToBase64 } from "@/services/audio/recorder";
import { transcribeSync } from "@/services/api/runpod";
import { translateText } from "@/services/api/translator";
import { logger } from "@/lib/logger";
import { useT } from "@/i18n";
import type { LanguageCode } from "@/types/language";

type StepStatus = "pending" | "running" | "success" | "error";

type DiagnosticStep = {
  label: string;
  status: StepStatus;
  detail: string;
};

type UseDiagnosticReturn = {
  steps: DiagnosticStep[];
  isRunning: boolean;
  result: { originalText: string; translatedText: string } | null;
  startTest: (
    sourceLang: LanguageCode,
    targetLang: LanguageCode
  ) => Promise<void>;
  reset: () => void;
};

/** 録音待機時間（ミリ秒） */
const RECORD_DURATION_MS = 3000;

/**
 * ステップラベルのi18nキー
 */
const STEP_LABEL_KEYS = [
  "diagnostic.stepMicPermission",
  "diagnostic.stepRecordStart",
  "diagnostic.stepRecordStop",
  "diagnostic.stepAudioData",
  "diagnostic.stepStt",
  "diagnostic.stepTranslation",
] as const;

/**
 * 録音→STT→翻訳パイプラインをステップ別に診断するフック
 *
 * @returns 各ステップのステータス、実行中フラグ、結果、テスト開始/リセット関数
 */
export function useDiagnosticRecorder(): UseDiagnosticReturn {
  const t = useT();

  const createInitialSteps = (): DiagnosticStep[] =>
    STEP_LABEL_KEYS.map((key) => ({
      label: t(key),
      status: "pending" as StepStatus,
      detail: "",
    }));

  const [steps, setSteps] = useState<DiagnosticStep[]>(createInitialSteps);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<{
    originalText: string;
    translatedText: string;
  } | null>(null);
  const recorder = useExpoAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const updateStep = (index: number, status: StepStatus, detail: string) => {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, status, detail } : s))
    );
  };

  const startTest = useCallback(
    async (sourceLang: LanguageCode, targetLang: LanguageCode) => {
      setIsRunning(true);
      setResult(null);
      setSteps(createInitialSteps());

      // Step 0: マイク許可
      updateStep(0, "running", "");
      try {
        const { granted } = await requestRecordingPermissionsAsync();
        if (!granted) {
          updateStep(0, "error", t("errors.microphonePermission"));
          setIsRunning(false);
          return;
        }
        updateStep(0, "success", "OK");
      } catch (e) {
        updateStep(0, "error", e instanceof Error ? e.message : String(e));
        logger.error("Mic permission error", {
          error: e instanceof Error ? e.message : String(e),
        });
        setIsRunning(false);
        return;
      }

      // Step 1: 録音開始
      updateStep(1, "running", "");
      try {
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });
        await recorder.prepareToRecordAsync();
        recorder.record();
        updateStep(1, "success", "Recording... 3s");
      } catch (e) {
        updateStep(1, "error", e instanceof Error ? e.message : String(e));
        logger.error("Record start error", {
          error: e instanceof Error ? e.message : String(e),
        });
        setIsRunning(false);
        return;
      }

      // 3秒間録音
      await new Promise((resolve) => setTimeout(resolve, RECORD_DURATION_MS));

      // Step 2: 録音停止
      updateStep(2, "running", "");
      try {
        await recorder.stop();
        const uri = recorder.uri;
        if (!uri) {
          updateStep(2, "error", "URI is empty");
          setIsRunning(false);
          return;
        }
        updateStep(2, "success", `URI: ${uri}`);
      } catch (e) {
        updateStep(2, "error", e instanceof Error ? e.message : String(e));
        logger.error("Record stop error", {
          error: e instanceof Error ? e.message : String(e),
        });
        setIsRunning(false);
        return;
      }

      // Step 3: 音声データ取得
      updateStep(3, "running", "Base64...");
      let base64: string;
      try {
        base64 = await audioToBase64(recorder.uri!);
        updateStep(
          3,
          "success",
          `${Math.round(base64.length / 1024)}KB`
        );
      } catch (e) {
        updateStep(3, "error", e instanceof Error ? e.message : String(e));
        logger.error("Base64 conversion error", {
          error: e instanceof Error ? e.message : String(e),
        });
        setIsRunning(false);
        return;
      }

      // Step 4: Faster Whisper送信
      updateStep(4, "running", "Sending...");
      let sttText: string;
      try {
        const sttResult = await transcribeSync(base64, sourceLang);
        sttText = sttResult.text;
        if (!sttText.trim()) {
          updateStep(4, "error", t("errors.sttFailed"));
          setIsRunning(false);
          return;
        }
        updateStep(4, "success", `"${sttText}"`);
      } catch (e) {
        updateStep(4, "error", e instanceof Error ? e.message : String(e));
        logger.error("STT error", {
          error: e instanceof Error ? e.message : String(e),
        });
        setIsRunning(false);
        return;
      }

      // Step 5: 翻訳送信
      updateStep(5, "running", "Translating...");
      try {
        const translated = await translateText(sttText, sourceLang, targetLang);
        updateStep(5, "success", `"${translated}"`);
        setResult({ originalText: sttText, translatedText: translated });
      } catch (e) {
        updateStep(5, "error", e instanceof Error ? e.message : String(e));
        logger.error("Translation error", {
          error: e instanceof Error ? e.message : String(e),
        });
      }

      setIsRunning(false);
    },
    [recorder, t]
  );

  const reset = useCallback(() => {
    setSteps(createInitialSteps());
    setResult(null);
    setIsRunning(false);
  }, [t]);

  return { steps, isRunning, result, startTest, reset };
}
