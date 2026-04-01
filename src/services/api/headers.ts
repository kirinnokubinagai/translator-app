import { getDeviceId, getHmacKey, isDeviceRegistered } from "@/lib/device-id";
import { getStoredUser, getStoredSessionToken } from "@/services/auth";
import { logger } from "@/lib/logger";

/**
 * HMAC-SHA256署名を生成する
 *
 * Web Crypto APIを使用してHMAC-SHA256署名を計算する。
 * React Native環境ではグローバルcryptoが利用可能。
 *
 * @param hmacKey - hex形式のサーバー発行HMACキー
 * @param message - 署名対象メッセージ
 * @returns hex形式のHMAC署名
 */
async function computeHmacSha256(hmacKey: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyBytes = new Uint8Array(
    (hmacKey.match(/.{2}/g) ?? []).map((b) => parseInt(b, 16))
  );
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Cloudflare Workerプロキシ用の共通認証ヘッダーを生成する
 *
 * デバイスがサーバーに登録済みである必要がある。
 * HMAC署名ベースの認証を使用する。
 *
 * HMAC署名ヘッダー:
 * - X-Device-Id: デバイスID（クォータ識別子として常にデバイスIDを使用）
 * - X-Auth-Device-Id: HMAC署名に使用するデバイスID
 * - X-Request-Timestamp: リクエスト時刻（ISO 8601）
 * - X-Request-Signature: HMAC-SHA256(hmacKey, method:path:timestamp:deviceId)
 *
 * @param method - HTTPメソッド（デフォルト: POST）
 * @param url - リクエストURL（パス抽出用）
 * @returns 認証ヘッダーを含むオブジェクト
 * @throws デバイス未登録またはHMACキー未設定の場合
 */
export async function getAuthHeaders(
  method: string = "POST",
  url?: string
): Promise<Record<string, string>> {
  const deviceId = await getDeviceId();
  const registered = await isDeviceRegistered();

  if (!registered) {
    throw new Error("デバイスが未登録です。registerDevice() を先に呼び出してください");
  }

  const hmacKey = await getHmacKey();

  if (!hmacKey) {
    throw new Error("HMACキーが未設定です。デバイス登録が不完全な可能性があります");
  }

  const timestamp = new Date().toISOString();
  const path = url ? new URL(url).pathname : "/";
  const message = `${method.toUpperCase()}:${path}:${timestamp}:${deviceId}`;
  const signature = await computeHmacSha256(hmacKey, message);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Device-Id": deviceId,
    "X-Auth-Device-Id": deviceId,
    "X-Request-Timestamp": timestamp,
    "X-Request-Signature": signature,
  };

  // 認証済みユーザーの場合、セッショントークンをヘッダーに追加（所有者証明用）
  const user = await getStoredUser();
  if (user) {
    headers["X-User-Id"] = user.id;
    const sessionToken = await getStoredSessionToken();
    if (sessionToken) {
      headers["X-Session-Token"] = sessionToken;
    }
  }

  return headers;
}
