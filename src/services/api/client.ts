import { API_TIMEOUT_MS, MAX_RETRY_COUNT } from "@/constants/api";
import { ApiError } from "@/lib/error";
import { logger } from "@/lib/logger";

type FetchOptions = {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
};

/**
 * タイムアウト付きfetch
 */
async function fetchWithTimeout(url: string, options: FetchOptions): Promise<Response> {
  const timeout = options.timeout ?? API_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 指定ミリ秒待機する
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 指数バックオフでリトライを行うHTTPクライアント
 *
 * @param url - リクエスト先URL
 * @param options - fetchオプション（retries: 0でリトライ無効）
 * @returns パースされたレスポンスデータ
 */
export async function apiRequest<T>(
  url: string,
  options: FetchOptions & { retries?: number } = {},
): Promise<T> {
  const maxRetries = options.retries ?? MAX_RETRY_COUNT;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        let errorMessage = `APIリクエストが失敗しました: ${response.status}`;
        let errorCode = "API_ERROR";
        try {
          const parsed = JSON.parse(errorBody) as {
            error?: { code?: string; message?: string };
            message?: string;
          };
          if (parsed?.error?.code) errorCode = parsed.error.code;
          if (parsed?.error?.message) {
            errorMessage = parsed.error.message;
          } else if (parsed?.message) {
            errorMessage = parsed.message;
          }
        } catch {
          // JSONパース失敗時はデフォルトコードを使用
        }
        throw new ApiError(errorMessage, response.status, errorBody, errorCode);
      }

      const data = (await response.json()) as T;
      return data;
    } catch (error) {
      if (error instanceof ApiError && error.statusCode && error.statusCode < 500) {
        throw error;
      }

      if (attempt === maxRetries) {
        logger.error("APIリクエスト失敗（リトライ上限）", {
          url,
          attempt: attempt.toString(),
          error: error instanceof Error ? error.message : String(error),
        });
        throw error instanceof ApiError
          ? error
          : new ApiError("ネットワークエラーが発生しました", undefined, error);
      }

      const backoffMs = Math.min(1000 * 2 ** attempt, 10000);
      logger.warn("APIリトライ", {
        url,
        attempt: attempt.toString(),
        backoffMs: backoffMs.toString(),
      });
      await sleep(backoffMs);
    }
  }

  throw new ApiError("予期しないエラーが発生しました");
}
