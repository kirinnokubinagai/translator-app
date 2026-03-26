/** APIプロキシURL */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

/** アプリ認証トークン */
export const APP_TOKEN = process.env.EXPO_PUBLIC_APP_TOKEN ?? "";

/** API リトライ回数 */
export const MAX_RETRY_COUNT = 3;

/** API タイムアウト（ミリ秒） - 個別リクエスト用 */
export const API_TIMEOUT_MS = 15000;

/** ジョブポーリング間隔（ミリ秒） */
export const JOB_POLL_INTERVAL_MS = 2000;

/** ジョブ最大待機時間（ミリ秒） */
export const JOB_MAX_WAIT_MS = 120000;
