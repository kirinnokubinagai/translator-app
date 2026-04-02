import { API_BASE_URL } from "@/constants/api";
import { logger } from "@/lib/logger";

/**
 * RunPodエンドポイントのウォームアップをfire-and-forgetで実行する
 *
 * アプリ起動時に1回だけ呼び出し、Whisper/TranslateGemmaのコールドスタートを開始させる。
 * レスポンスは待たない。失敗しても問題ない（ベストエフォート）。
 */
export function fireWarmup(): void {
  fetch(`${API_BASE_URL}/api/warmup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  }).catch((error) => {
    logger.debug("ウォームアップリクエスト失敗（非致命的）", {
      error: error instanceof Error ? error.message : String(error),
    });
  });
}
