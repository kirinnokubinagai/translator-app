import { apiRequest } from "./client";
import {
  sleep,
  isJobTerminal,
  type RunPodStatusResponse,
  type SubmitResponse,
} from "./polling";
import { TranslationError } from "@/lib/error";
import { logger } from "@/lib/logger";
import {
  API_BASE_URL,
  APP_TOKEN,
  JOB_POLL_INTERVAL_MS,
  JOB_MAX_WAIT_MS,
} from "@/constants/api";
import { LANGUAGES } from "@/constants/languages";
import type { LanguageCode } from "@/types/language";

/** vLLMレスポンスの型 */
type VllmOutput = {
  choices?: Array<{ message: { content: string } }>;
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
 * vLLMレスポンスから翻訳テキストを抽出する
 */
function extractTranslatedText(output: unknown): string {
  const vllmOutput = output as VllmOutput;
  const content = vllmOutput?.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new TranslationError("翻訳結果が空です");
  }
  return content;
}

/**
 * Cloudflare Worker経由でテキストを翻訳する（非同期ジョブ + ポーリング）
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

  const sourceName = LANGUAGES[sourceLanguage].nativeName;
  const targetName = LANGUAGES[targetLanguage].nativeName;

  try {
    const submitResult = await apiRequest<SubmitResponse>(
      `${API_BASE_URL}/api/translate`,
      {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          text,
          sourceLanguage: sourceName,
          targetLanguage: targetName,
        }),
        retries: 0,
      }
    );

    const { jobId } = submitResult;
    const statusUrl = `${API_BASE_URL}/api/job/${jobId}?endpoint=vllm`;
    const startTime = Date.now();

    logger.info("翻訳ジョブ投入完了", { jobId });

    while (Date.now() - startTime < JOB_MAX_WAIT_MS) {
      await sleep(JOB_POLL_INTERVAL_MS);

      let statusResult: RunPodStatusResponse;
      try {
        statusResult = await apiRequest<RunPodStatusResponse>(statusUrl, {
          method: "GET",
          headers: getHeaders(),
          retries: 0,
        });
      } catch (pollError) {
        logger.warn("ポーリングリクエスト失敗（リトライ）", {
          jobId,
          error:
            pollError instanceof Error
              ? pollError.message
              : String(pollError),
        });
        continue;
      }

      logger.debug("翻訳ジョブステータス確認", {
        jobId,
        status: statusResult.status,
      });

      if (!isJobTerminal(statusResult.status)) {
        continue;
      }

      if (statusResult.status === "FAILED") {
        throw new TranslationError(
          statusResult.error ?? "翻訳ジョブが失敗しました"
        );
      }

      if (statusResult.status === "CANCELLED") {
        throw new TranslationError("翻訳ジョブがキャンセルされました");
      }

      return extractTranslatedText(statusResult.output);
    }

    throw new TranslationError(
      `翻訳がタイムアウトしました（${Math.round(JOB_MAX_WAIT_MS / 1000)}秒）`
    );
  } catch (error) {
    if (error instanceof TranslationError) throw error;
    throw new TranslationError("翻訳に失敗しました", error);
  }
}
