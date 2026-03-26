import { apiRequest } from "./client";
import { SpeechRecognitionError } from "@/lib/error";
import { logger } from "@/lib/logger";
import { API_BASE_URL, APP_TOKEN } from "@/constants/api";

/** Faster Whisperのrunsyncレスポンス */
type WhisperSyncResponse = {
  status: string;
  output?: {
    transcription?: string;
    detected_language?: string;
    segments?: unknown[];
  };
  error?: string;
};

/**
 * Cloudflare Workerプロキシ用のリクエストヘッダーを生成する
 */
function getHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${APP_TOKEN}`,
  };
}

/**
 * Cloudflare Worker経由で音声認識を実行する（runsync同期方式）
 *
 * @param audioBase64 - Base64エンコードされた音声データ
 * @param language - 音声の言語コード（省略時は自動検出）
 * @returns 認識テキストと検出言語
 */
export async function transcribeSync(
  audioBase64: string,
  language?: string
): Promise<{ text: string; detectedLanguage: string }> {
  try {
    const response = await apiRequest<WhisperSyncResponse>(
      `${API_BASE_URL}/api/transcribe`,
      {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          audio_base64: audioBase64,
          language: language ?? undefined,
          model: "medium",
        }),
        timeout: 30000,
        retries: 0,
      }
    );

    logger.debug("Faster Whisperレスポンス", {
      status: response.status,
      hasOutput: String(!!response.output),
      transcription: response.output?.transcription ?? "(空)",
    });

    if (response.status === "FAILED") {
      throw new SpeechRecognitionError(
        response.error ?? "音声認識に失敗しました"
      );
    }

    if (!response.output?.transcription) {
      throw new SpeechRecognitionError("音声認識結果が空です");
    }

    return {
      text: response.output.transcription,
      detectedLanguage: response.output.detected_language ?? "",
    };
  } catch (error) {
    if (error instanceof SpeechRecognitionError) throw error;
    throw new SpeechRecognitionError("音声認識に失敗しました", error);
  }
}
