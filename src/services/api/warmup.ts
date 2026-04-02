import { API_BASE_URL } from "@/constants/api";
import { logger } from "@/lib/logger";

/** ウォームアップレスポンスのワーカー状態 */
type WorkerStatus = {
  name: string;
  status: number;
  workers: {
    ready?: number;
    running?: number;
    idle?: number;
    initializing?: number;
  } | null;
};

/** ウォームアップAPIレスポンス */
type WarmupResponse = {
  success: boolean;
  data: WorkerStatus[];
};

/**
 * RunPodエンドポイントのウォームアップを実行する
 *
 * アプリ起動時に呼び出し、Whisper/TranslateGemmaのコールドスタートを開始させる。
 * ワーカーが準備完了になるまでポーリングする。
 *
 * @param maxWaitMs - 最大待機時間（ミリ秒）
 * @param pollIntervalMs - ポーリング間隔（ミリ秒）
 * @returns 両ワーカーが準備完了ならtrue
 */
export async function warmupEndpoints(maxWaitMs = 60000, pollIntervalMs = 3000): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/warmup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        logger.warn("ウォームアップAPI失敗", { status: String(response.status) });
        await sleep(pollIntervalMs);
        continue;
      }

      const result = (await response.json()) as WarmupResponse;

      if (!result.success || !result.data) {
        await sleep(pollIntervalMs);
        continue;
      }

      const allReady = result.data.every((ep) => {
        const w = ep.workers;
        if (!w) return false;
        const readyCount = (w.ready ?? 0) + (w.idle ?? 0) + (w.running ?? 0);
        return readyCount > 0;
      });

      if (allReady) {
        logger.info("ウォームアップ完了", {
          elapsed: String(Date.now() - startTime),
        });
        return true;
      }

      logger.debug("ウォームアップ中...", {
        statuses: JSON.stringify(result.data.map((d) => ({ name: d.name, workers: d.workers }))),
      });
    } catch (error) {
      logger.warn("ウォームアップリクエストエラー", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    await sleep(pollIntervalMs);
  }

  logger.warn("ウォームアップタイムアウト", { maxWaitMs: String(maxWaitMs) });
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
