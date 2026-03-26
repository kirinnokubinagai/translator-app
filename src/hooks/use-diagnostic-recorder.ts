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

const INITIAL_STEPS: DiagnosticStep[] = [
  { label: "マイク許可", status: "pending", detail: "" },
  { label: "録音開始", status: "pending", detail: "" },
  { label: "録音停止", status: "pending", detail: "" },
  { label: "音声データ取得", status: "pending", detail: "" },
  { label: "Faster Whisper送信", status: "pending", detail: "" },
  { label: "翻訳送信", status: "pending", detail: "" },
];

/**
 * 録音→STT→翻訳パイプラインをステップ別に診断するフック
 *
 * @returns 各ステップのステータス、実行中フラグ、結果、テスト開始/リセット関数
 */
export function useDiagnosticRecorder(): UseDiagnosticReturn {
  const [steps, setSteps] = useState<DiagnosticStep[]>(INITIAL_STEPS);
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
      setSteps(INITIAL_STEPS.map((s) => ({ ...s, status: "pending", detail: "" })));

      // Step 0: マイク許可
      updateStep(0, "running", "許可をリクエスト中...");
      try {
        const { granted } = await requestRecordingPermissionsAsync();
        if (!granted) {
          updateStep(0, "error", "マイク許可が拒否されました");
          setIsRunning(false);
          return;
        }
        updateStep(0, "success", "許可済み");
      } catch (e) {
        updateStep(0, "error", e instanceof Error ? e.message : String(e));
        logger.error("マイク許可エラー", {
          error: e instanceof Error ? e.message : String(e),
        });
        setIsRunning(false);
        return;
      }

      // Step 1: 録音開始
      updateStep(1, "running", "録音を開始中...");
      try {
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });
        await recorder.prepareToRecordAsync();
        recorder.record();
        updateStep(1, "success", "録音中... 3秒間話してください");
      } catch (e) {
        updateStep(1, "error", e instanceof Error ? e.message : String(e));
        logger.error("録音開始エラー", {
          error: e instanceof Error ? e.message : String(e),
        });
        setIsRunning(false);
        return;
      }

      // 3秒間録音
      await new Promise((resolve) => setTimeout(resolve, RECORD_DURATION_MS));

      // Step 2: 録音停止
      updateStep(2, "running", "録音を停止中...");
      try {
        await recorder.stop();
        const uri = recorder.uri;
        if (!uri) {
          updateStep(2, "error", "録音ファイルのURIが空です");
          setIsRunning(false);
          return;
        }
        updateStep(2, "success", `URI: ${uri}`);
      } catch (e) {
        updateStep(2, "error", e instanceof Error ? e.message : String(e));
        logger.error("録音停止エラー", {
          error: e instanceof Error ? e.message : String(e),
        });
        setIsRunning(false);
        return;
      }

      // Step 3: 音声データ取得
      updateStep(3, "running", "音声データをBase64変換中...");
      let base64: string;
      try {
        base64 = await audioToBase64(recorder.uri!);
        updateStep(
          3,
          "success",
          `データサイズ: ${Math.round(base64.length / 1024)}KB`
        );
      } catch (e) {
        updateStep(3, "error", e instanceof Error ? e.message : String(e));
        logger.error("Base64変換エラー", {
          error: e instanceof Error ? e.message : String(e),
        });
        setIsRunning(false);
        return;
      }

      // Step 4: Faster Whisper送信
      updateStep(
        4,
        "running",
        "Faster Whisperに送信中...(初回は60秒以上かかる場合あり)"
      );
      let sttText: string;
      try {
        const sttResult = await transcribeSync(base64, sourceLang);
        sttText = sttResult.text;
        if (!sttText.trim()) {
          updateStep(4, "error", "認識結果が空です（音声が検出されませんでした）");
          setIsRunning(false);
          return;
        }
        updateStep(4, "success", `認識結果: "${sttText}"`);
      } catch (e) {
        updateStep(4, "error", e instanceof Error ? e.message : String(e));
        logger.error("STTエラー", {
          error: e instanceof Error ? e.message : String(e),
        });
        setIsRunning(false);
        return;
      }

      // Step 5: 翻訳送信
      updateStep(5, "running", "翻訳中...(初回は60秒以上かかる場合あり)");
      try {
        const translated = await translateText(sttText, sourceLang, targetLang);
        updateStep(5, "success", `翻訳結果: "${translated}"`);
        setResult({ originalText: sttText, translatedText: translated });
      } catch (e) {
        updateStep(5, "error", e instanceof Error ? e.message : String(e));
        logger.error("翻訳エラー", {
          error: e instanceof Error ? e.message : String(e),
        });
      }

      setIsRunning(false);
    },
    [recorder]
  );

  const reset = useCallback(() => {
    setSteps(INITIAL_STEPS.map((s) => ({ ...s, status: "pending", detail: "" })));
    setResult(null);
    setIsRunning(false);
  }, []);

  return { steps, isRunning, result, startTest, reset };
}
