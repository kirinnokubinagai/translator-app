import { useState, useCallback } from "react";
import { transcribeSync } from "@/services/api/runpod";
import { getErrorMessage } from "@/lib/error";
import { logger } from "@/lib/logger";

type UseSpeechToTextReturn = {
  isTranscribing: boolean;
  transcribedText: string;
  detectedLanguage: string;
  error: string | null;
  transcribe: (
    audioBase64: string,
    language?: string
  ) => Promise<{ text: string; language: string } | null>;
  reset: () => void;
};

/**
 * 音声認識フック
 * Cloudflare Worker経由でFaster Whisperを使用して音声をテキストに変換する
 */
export function useSpeechToText(): UseSpeechToTextReturn {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribedText, setTranscribedText] = useState("");
  const [detectedLanguage, setDetectedLanguage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const transcribe = useCallback(
    async (audioBase64: string, language?: string) => {
      setIsTranscribing(true);
      setError(null);
      try {
        const result = await transcribeSync(audioBase64, language);
        setTranscribedText(result.text);
        setDetectedLanguage(result.detectedLanguage);
        return { text: result.text, language: result.detectedLanguage };
      } catch (err) {
        const message = getErrorMessage(err);
        setError(message);
        logger.error("音声認識エラー", { error: message });
        return null;
      } finally {
        setIsTranscribing(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setTranscribedText("");
    setDetectedLanguage("");
    setError(null);
  }, []);

  return {
    isTranscribing,
    transcribedText,
    detectedLanguage,
    error,
    transcribe,
    reset,
  };
}
