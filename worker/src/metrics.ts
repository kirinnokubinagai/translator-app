/**
 * 簡易メトリクス記録
 *
 * 各リクエストのエンドポイント・レスポンスタイム・ステータスコードを
 * metricsテーブルに記録する。
 */
import type { Client } from "@libsql/client";

/** メトリクス記録のパラメータ */
type MetricEntry = {
  endpoint: string;
  method: string;
  statusCode: number;
  responseTimeMs: number;
  errorCode?: string;
  quotaConsumed?: number;
};

/**
 * メトリクスを1件記録する
 */
export async function recordMetric(db: Client, entry: MetricEntry): Promise<void> {
  await db.execute({
    sql: `INSERT INTO metrics (endpoint, method, status_code, response_time_ms, error_code, quota_consumed)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      entry.endpoint,
      entry.method,
      entry.statusCode,
      entry.responseTimeMs,
      entry.errorCode ?? null,
      entry.quotaConsumed ?? 0,
    ],
  }).catch(() => {
    // メトリクス記録失敗はリクエスト処理に影響させない
  });
}

/** 集計結果の型 */
type MetricsSummary = {
  endpoint: string;
  totalRequests: number;
  avgResponseTimeMs: number;
  errorCount: number;
  totalQuotaConsumed: number;
};

/**
 * 指定期間のメトリクスを集計する
 *
 * @param db - libsql クライアント
 * @param sinceMinutes - 現在から何分前までの集計を行うか
 * @returns エンドポイント別の集計結果
 */
export async function getMetricsSummary(
  db: Client,
  sinceMinutes: number
): Promise<MetricsSummary[]> {
  const result = await db.execute({
    sql: `SELECT
            endpoint,
            COUNT(*) as total_requests,
            AVG(response_time_ms) as avg_response_time_ms,
            SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as error_count,
            SUM(quota_consumed) as total_quota_consumed
          FROM metrics
          WHERE created_at >= datetime('now', ?)
          GROUP BY endpoint
          ORDER BY total_requests DESC`,
    args: [`-${sinceMinutes} minutes`],
  });

  return result.rows.map((row) => {
    const r = row as unknown as Record<string, unknown>;
    return {
      endpoint: r.endpoint as string,
      totalRequests: r.total_requests as number,
      avgResponseTimeMs: Math.round(r.avg_response_time_ms as number),
      errorCount: r.error_count as number,
      totalQuotaConsumed: r.total_quota_consumed as number,
    };
  });
}

/**
 * 古いメトリクスを削除する（24時間より前のデータ）
 */
export async function pruneOldMetrics(db: Client): Promise<void> {
  await db.execute(
    "DELETE FROM metrics WHERE created_at < datetime('now', '-24 hours')"
  ).catch(() => {
    // 削除失敗は無視
  });
}

/**
 * リクエスト計測を開始し、終了時にメトリクスを記録するヘルパー
 *
 * @param db - libsql クライアント
 * @param endpoint - エンドポイントパス
 * @param method - HTTPメソッド
 * @returns 計測終了用の関数
 */
export function startMetricTimer(
  db: Client,
  endpoint: string,
  method: string
): (statusCode: number, errorCode?: string, quotaConsumed?: number) => void {
  const startTime = Date.now();

  return (statusCode: number, errorCode?: string, quotaConsumed?: number) => {
    const responseTimeMs = Date.now() - startTime;
    recordMetric(db, {
      endpoint,
      method,
      statusCode,
      responseTimeMs,
      errorCode,
      quotaConsumed,
    });
  };
}
