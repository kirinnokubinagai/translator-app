/** APIプロキシURL */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

/** API リトライ回数 */
export const MAX_RETRY_COUNT = 3;

/** API タイムアウト（ミリ秒） - 個別リクエスト用 */
export const API_TIMEOUT_MS = 15000;
