import { apiRequest } from "./client";
import { getAuthHeaders } from "./headers";
import { TranslationError } from "@/lib/error";
import { logger } from "@/lib/logger";
import { API_BASE_URL } from "@/constants/api";
import type { LanguageCode } from "@/types/language";

/** TranslateGemma runsyncレスポンスの型 */
type TranslateSyncResponse = {
  status: string;
  output?: {
    translated_text?: string;
    source_language?: string;
    target_language?: string;
  };
  error?: string;
};

/**
 * Cloudflare Worker経由でテキストを翻訳する（runsync同期方式）
 *
 * @param text - 翻訳対象テキスト
 * @param sourceLanguage - 翻訳元言語コード
 * @param targetLanguage - 翻訳先言語コード
 * @returns 翻訳済みテキスト
 */
export async function translateText(
  text: string,
  sourceLanguage: LanguageCode,
  targetLanguage: LanguageCode
): Promise<string> {
  if (!text.trim()) return "";

  try {
    const requestUrl = `${API_BASE_URL}/api/translate`;
    const headers = await getAuthHeaders("POST", requestUrl);
    const response = await apiRequest<TranslateSyncResponse>(
      requestUrl,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          text,
          sourceLanguage,
          targetLanguage,
        }),
        timeout: 30000,
        retries: 0,
      }
    );

    logger.debug("翻訳レスポンス", {
      status: response.status,
      hasOutput: String(!!response.output),
    });

    if (response.status === "FAILED") {
      throw new TranslationError(response.error ?? "翻訳に失敗しました");
    }

    if (!response.output?.translated_text) {
      throw new TranslationError("翻訳結果が空です");
    }

    return response.output.translated_text.trim();
  } catch (error) {
    if (error instanceof TranslationError) throw error;
    throw new TranslationError("翻訳に失敗しました", error);
  }
}
