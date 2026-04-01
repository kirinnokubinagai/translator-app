/**
 * 翻訳アプリ用APIプロキシ（クォータ管理付き・Turso SQL版）
 *
 * 認証方式:
 * 1. HMAC署名（推奨）: デバイス登録後、サーバー発行のhmac_keyでリクエストに署名
 * 2. APP_SECRET（レガシー）: 静的トークンによる認証（移行期間中のフォールバック）
 */

import { createClient, type Client } from "@libsql/client";
import { createAuth } from "./auth";
import type { Env } from "./types";
import { runMigrations } from "./schema-migrations";
import { startMetricTimer, pruneOldMetrics } from "./metrics";

// ==========================================
// 定数
// ==========================================

/** 広告視聴報酬クォータ数 */
const AD_REWARD_QUOTA = 5;
/** 音声認識消費クォータ */
const TRANSCRIBE_COST = 1;
/** 翻訳消費クォータ */
const TRANSLATE_COST = 1;
/** 広告報酬の1日あたり上限回数 */
const AD_REWARD_DAILY_LIMIT = 10;

/** PBKDF2イテレーション回数（デバイスシークレットハッシュ用） */
const DEVICE_SECRET_PBKDF2_ITERATIONS = 100000;

/** HMAC署名のタイムスタンプ許容範囲（ミリ秒）: 5分 */
const HMAC_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;

/** HMACキーのバイト長 */
const HMAC_KEY_BYTE_LENGTH = 32;

type EndpointType = "whisper" | "translate";

type QuotaPack = "starter" | "standard" | "premium";

const QUOTA_PACKS: Record<QuotaPack, number> = {
  starter: 100,
  standard: 500,
  premium: 1500,
};

/** マイグレーション実行済みフラグ */
let migrationsRun = false;

// ==========================================
// レート制限（DBベース — インスタンス分散・再起動に耐性あり）
// ==========================================

/** レート制限: 1分あたりの最大リクエスト数 */
const RATE_LIMIT_MAX_REQUESTS = 60;
/** レート制限: ウィンドウサイズ（秒） */
const RATE_LIMIT_WINDOW_SEC = 60;

/** 登録レート制限: 1時間あたりの最大登録数 */
const REGISTER_RATE_LIMIT_MAX = 5;
/** 登録レート制限: ウィンドウサイズ（秒） */
const REGISTER_RATE_LIMIT_WINDOW_SEC = 3600;

/**
 * マイグレーションシステム経由でスキーマを確保する
 *
 * 旧 ensureQuotaSchema / ensureDevicesSchema / ensureRateLimitSchema の統合。
 * 全テーブルを一度にマイグレーションで作成・更新する。
 */
async function ensureSchema(db: Client): Promise<void> {
  if (migrationsRun) return;
  await runMigrations(db);
  migrationsRun = true;
}

/**
 * DBベースのレート制限チェック
 *
 * @returns 制限超過の場合 true
 */
async function isRateLimited(db: Client, key: string, category: string, maxRequests: number, windowSec: number): Promise<boolean> {
  // 古いエントリを削除
  await db.execute({
    sql: "DELETE FROM rate_limits WHERE key = ? AND category = ? AND created_at < datetime('now', ?)",
    args: [key, category, `-${windowSec} seconds`],
  });

  // 原子的に INSERT + COUNT チェック
  // 先にINSERTしてからCOUNTし、超過していたら削除する（楽観的）
  await db.execute({
    sql: "INSERT INTO rate_limits (key, category) VALUES (?, ?)",
    args: [key, category],
  });

  const result = await db.execute({
    sql: "SELECT COUNT(*) as cnt FROM rate_limits WHERE key = ? AND category = ?",
    args: [key, category],
  });
  const count = (result.rows[0] as unknown as { cnt: number }).cnt;

  if (count > maxRequests) {
    // 超過 → 今挿入した分を取り消し
    await db.execute({
      sql: "DELETE FROM rate_limits WHERE id = (SELECT MAX(id) FROM rate_limits WHERE key = ? AND category = ?)",
      args: [key, category],
    });
    return true;
  }

  return false;
}

/**
 * デバイス登録のIPベースレート制限をチェックする
 */
async function isRegisterRateLimited(db: Client, ip: string): Promise<boolean> {
  return isRateLimited(db, ip, "register", REGISTER_RATE_LIMIT_MAX, REGISTER_RATE_LIMIT_WINDOW_SEC);
}

/**
 * APIリクエストのデバイスベースレート制限をチェックする
 */
async function isApiRateLimited(db: Client, deviceId: string): Promise<boolean> {
  return isRateLimited(db, deviceId, "api", RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_SEC);
}

// ==========================================
// Turso DB ヘルパー
// ==========================================

/**
 * Turso クライアントを生成する
 *
 * @param env - Cloudflare Worker 環境変数
 * @returns libsql クライアント
 */
function getDb(env: Env): Client {
  return createClient({
    url: env.TURSO_DB_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });
}

/**
 * 旧ensureQuotaSchema互換 — ensureSchemaに委譲
 */
async function ensureQuotaSchema(db: Client): Promise<void> {
  await ensureSchema(db);
}

/**
 * 旧ensureDevicesSchema互換 — ensureSchemaに委譲
 */
async function ensureDevicesSchema(db: Client): Promise<void> {
  await ensureSchema(db);
}

// ==========================================
// 暗号ヘルパー
// ==========================================

/**
 * 2つのhex文字列をタイミングセーフに比較する
 */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) {
    diff |= bufA[i] ^ bufB[i];
  }
  return diff === 0;
}

/**
 * デバイスシークレットをPBKDF2でハッシュ化する
 *
 * @param secret - hex形式のデバイスシークレット
 * @returns "pbkdf2:iterations:saltHex:hashHex" 形式のハッシュ文字列
 */
async function hashDeviceSecret(secret: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const hash = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: DEVICE_SECRET_PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256
  );
  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, "0")).join("");
  const hashHex = Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `pbkdf2:${DEVICE_SECRET_PBKDF2_ITERATIONS}:${saltHex}:${hashHex}`;
}

/**
 * デバイスシークレットのハッシュを検証する（タイミングセーフ比較）
 *
 * @param secret - hex形式のデバイスシークレット
 * @param storedHash - 保存済みのハッシュ文字列
 * @returns 一致する場合はtrue
 */
async function verifyDeviceSecret(secret: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(":");
  if (parts[0] !== "pbkdf2" || parts.length !== 4) return false;

  const iterations = parseInt(parts[1], 10);
  const saltMatch = parts[2].match(/.{2}/g);
  if (!saltMatch) return false;

  const salt = new Uint8Array(saltMatch.map((b) => parseInt(b, 16)));
  const expectedHash = parts[3];

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const hash = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    256
  );
  const hashHex = Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");

  return timingSafeEqualHex(hashHex, expectedHash);
}

/**
 * ランダムなHMACキーを生成する
 *
 * @returns hex形式のHMACキー（64文字）
 */
function generateHmacKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(HMAC_KEY_BYTE_LENGTH));
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * HMAC-SHA256署名を計算する
 *
 * @param hmacKey - hex形式のHMACキー
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

// ==========================================
// Apple DeviceCheck 検証
// ==========================================

/** Base64url エンコード */
function base64url(data: string): string {
  return btoa(data).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

/**
 * Apple DeviceCheck API 用の ES256 JWT を生成する
 *
 * Apple Developer ポータルで発行した P8 秘密鍵で署名し、
 * DeviceCheck API の認証に使用する。
 *
 * @param env - 環境変数（APPLE_TEAM_ID, APPLE_DEVICE_CHECK_KEY_ID, APPLE_DEVICE_CHECK_PRIVATE_KEY）
 * @returns 署名済み JWT 文字列
 */
async function generateAppleDeviceCheckJWT(env: Env): Promise<string> {
  const header = base64url(JSON.stringify({
    alg: "ES256",
    kid: env.APPLE_DEVICE_CHECK_KEY_ID,
  }));

  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(JSON.stringify({
    iss: env.APPLE_TEAM_ID,
    iat: now,
    exp: now + 300,
  }));

  const signingInput = `${header}.${payload}`;

  const pemContent = (env.APPLE_DEVICE_CHECK_PRIVATE_KEY ?? "")
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/[\r\n\s]/g, "");
  const keyBytes = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput)
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${signingInput}.${sigB64}`;
}

/**
 * Apple DeviceCheck API でデバイストークンを検証する
 *
 * iOS デバイスから送信された DeviceCheck トークンを Apple のサーバーに送信し、
 * トークンが実際の Apple デバイス上の正規アプリから生成されたものかを確認する。
 *
 * @param deviceToken - Base64エンコードされた DeviceCheck トークン
 * @param env - 環境変数
 * @returns 検証成功時は true
 */
async function verifyAppleDeviceToken(deviceToken: string, env: Env): Promise<boolean> {
  try {
    const jwt = await generateAppleDeviceCheckJWT(env);

    const apiUrl = env.DEV_MODE === "true"
      ? "https://api.development.devicecheck.apple.com/v1/validate_device_token"
      : "https://api.devicecheck.apple.com/v1/validate_device_token";

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        device_token: deviceToken,
        transaction_id: crypto.randomUUID(),
        timestamp: Date.now(),
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
}

/** DeviceCheck 環境変数がすべて設定されているか */
function isDeviceCheckConfigured(env: Env): boolean {
  return !!(
    env.APPLE_DEVICE_CHECK_KEY_ID &&
    env.APPLE_DEVICE_CHECK_PRIVATE_KEY &&
    env.APPLE_TEAM_ID
  );
}

// ==========================================
// Google Play Integrity 検証
// ==========================================

/**
 * Google サービスアカウント用の OAuth2 アクセストークンを取得する
 *
 * サービスアカウントの秘密鍵で JWT を生成し、
 * Google の OAuth2 エンドポイントでアクセストークンに交換する。
 *
 * @param env - 環境変数
 * @returns アクセストークン
 */
async function getGoogleAccessToken(env: Env): Promise<string> {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(JSON.stringify({
    iss: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: "https://www.googleapis.com/auth/playintegrity",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 300,
  }));

  const signingInput = `${header}.${payload}`;

  const pemContent = (env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? "")
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/[\r\n\s]/g, "");
  const keyBytes = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput)
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${signingInput}.${sigB64}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  const tokenData = (await tokenResponse.json()) as { access_token?: string };
  if (!tokenData.access_token) {
    throw new Error("Google OAuth2 アクセストークンの取得に失敗しました");
  }
  return tokenData.access_token;
}

/**
 * Google Play Integrity API でインテグリティトークンを検証する
 *
 * クライアントから送信されたトークンを Google のサーバーに送信し、
 * デバイスの正当性・アプリの正当性を確認する。
 *
 * @param integrityToken - クライアントが生成したインテグリティトークン
 * @param env - 環境変数
 * @returns 検証成功時は true
 */
async function verifyPlayIntegrityToken(integrityToken: string, env: Env, expectedNonce?: string): Promise<boolean> {
  try {
    const accessToken = await getGoogleAccessToken(env);
    const packageName = "com.talkable.app";

    const response = await fetch(
      `https://playintegrity.googleapis.com/v1/${packageName}:decodeIntegrityToken`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ integrity_token: integrityToken }),
      }
    );

    if (!response.ok) return false;

    const data = (await response.json()) as {
      tokenPayloadExternal?: {
        requestDetails?: { requestPackageName?: string };
        appIntegrity?: { appRecognitionVerdict?: string };
        deviceIntegrity?: { deviceRecognitionVerdict?: string[] };
      };
    };

    const payload = data.tokenPayloadExternal;
    if (!payload) return false;

    // パッケージ名の一致確認
    if (payload.requestDetails?.requestPackageName !== packageName) return false;

    // デバイスの正当性チェック（MEETS_DEVICE_INTEGRITY が含まれるか）
    const deviceVerdict = payload.deviceIntegrity?.deviceRecognitionVerdict ?? [];
    if (!deviceVerdict.includes("MEETS_DEVICE_INTEGRITY")) return false;

    // nonce/requestHash の検証（リプレイ攻撃防止）
    if (expectedNonce && payload.requestDetails) {
      const requestHash = (payload.requestDetails as Record<string, unknown>).requestHash as string | undefined;
      if (requestHash && requestHash !== expectedNonce) return false;
    }

    return true;
  } catch {
    return false;
  }
}

/** Play Integrity 環境変数がすべて設定されているか */
function isPlayIntegrityConfigured(env: Env): boolean {
  return !!(
    env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  );
}

// ==========================================
// Attestation 統合検証
// ==========================================

/** クライアントから送信される attestation ペイロードの型 */
type AttestationPayload = {
  platform: string;
  token: string;
  nonce?: string;
};

/**
 * デバイス登録時の attestation を検証する
 *
 * - DEV_MODE: 検証スキップ（開発・テスト用）
 * - iOS + DeviceCheck設定済み: Apple DeviceCheck API で検証
 * - iOS + DeviceCheck未設定: 登録拒否（サーバー設定エラー）
 * - Android + Play Integrity設定済み: Google Play Integrity API で検証
 * - Android + Play Integrity未設定: 登録拒否（サーバー設定エラー）
 * - attestation なし: 拒否
 *
 * @param attestation - クライアントからのペイロード（null の場合あり）
 * @param env - 環境変数
 * @returns 検証成功時は { ok: true }、失敗時は { ok: false, reason }
 */
async function verifyRegistrationAttestation(
  attestation: AttestationPayload | null | undefined,
  env: Env
): Promise<{ ok: true } | { ok: false; reason: string }> {
  // 開発モードでは検証スキップ
  if (env.DEV_MODE === "true") {
    return { ok: true };
  }

  // attestation が送信されていない場合
  if (!attestation || !attestation.platform) {
    return { ok: false, reason: "デバイス認証情報が必要です" };
  }

  // Android: Google Play Integrity で検証
  if (attestation.platform === "android") {
    if (!isPlayIntegrityConfigured(env)) {
      return { ok: false, reason: "サーバーの Play Integrity 設定が不完全です" };
    }
    if (!attestation.token) {
      return { ok: false, reason: "Android インテグリティトークンが必要です" };
    }
    const valid = await verifyPlayIntegrityToken(attestation.token, env, attestation.nonce);
    if (!valid) {
      return { ok: false, reason: "Google Play Integrity の検証に失敗しました" };
    }
    return { ok: true };
  }

  // iOS: Apple DeviceCheck で検証
  if (attestation.platform === "ios") {
    if (!isDeviceCheckConfigured(env)) {
      return { ok: false, reason: "サーバーの DeviceCheck 設定が不完全です" };
    }
    if (!attestation.token) {
      return { ok: false, reason: "iOS デバイストークンが必要です" };
    }
    const valid = await verifyAppleDeviceToken(attestation.token, env);
    if (!valid) {
      return { ok: false, reason: "Apple DeviceCheck の検証に失敗しました" };
    }
    return { ok: true };
  }

  return { ok: false, reason: `未対応のプラットフォーム: ${attestation.platform}` };
}

// ==========================================
// HMAC署名 検証
// ==========================================

/**
 * HMAC-SHA256署名を検証する
 *
 * リクエストヘッダーからデバイスID・タイムスタンプ・署名を取得し、
 * DBに保存されたhmac_keyで署名を再計算して比較する。
 *
 * @param request - リクエスト
 * @param env - 環境変数
 * @returns 検証成功時は { valid: true, deviceId }、失敗時は { valid: false, error }
 */
async function verifyHmacSignature(
  request: Request,
  env: Env
): Promise<{ valid: true; deviceId: string } | { valid: false; error: string }> {
  const authDeviceId = request.headers.get("X-Auth-Device-Id");
  const timestamp = request.headers.get("X-Request-Timestamp");
  const signature = request.headers.get("X-Request-Signature");

  if (!authDeviceId || !timestamp || !signature) {
    return { valid: false, error: "HMAC認証ヘッダーが不足しています" };
  }

  const requestTime = new Date(timestamp).getTime();
  if (isNaN(requestTime)) {
    return { valid: false, error: "タイムスタンプの形式が不正です" };
  }

  const now = Date.now();
  if (Math.abs(now - requestTime) > HMAC_TIMESTAMP_TOLERANCE_MS) {
    return { valid: false, error: "リクエストのタイムスタンプが有効期限外です" };
  }

  const db = getDb(env);
  await ensureDevicesSchema(db);

  const result = await db.execute({
    sql: "SELECT hmac_key FROM devices WHERE device_id = ?",
    args: [authDeviceId],
  });

  if (result.rows.length === 0) {
    return { valid: false, error: "未登録のデバイスです" };
  }

  const hmacKey = result.rows[0].hmac_key as string;

  const url = new URL(request.url);
  const message = `${request.method.toUpperCase()}:${url.pathname}:${timestamp}:${authDeviceId}`;
  const expectedSignature = await computeHmacSha256(hmacKey, message);

  if (!timingSafeEqualHex(signature, expectedSignature)) {
    return { valid: false, error: "署名が一致しません" };
  }

  await db.execute({
    sql: "UPDATE devices SET last_used_at = datetime('now') WHERE device_id = ?",
    args: [authDeviceId],
  }).catch(() => {
    // last_used_atの更新失敗は無視（非クリティカル）
  });

  return { valid: true, deviceId: authDeviceId };
}

// ==========================================
// 認証統合
// ==========================================

/**
 * アプリ認証を検証する（HMAC署名 or レガシーAPP_SECRET）
 *
 * HMAC署名ヘッダーが存在する場合はHMAC認証を試行し、
 * なければレガシーのAPP_SECRET Bearer認証にフォールバックする。
 *
 * @returns 認証成功時は true、失敗時は false
 */
async function validateAuth(
  request: Request,
  env: Env
): Promise<boolean> {
  const hasHmacHeaders = request.headers.has("X-Auth-Device-Id")
    && request.headers.has("X-Request-Timestamp")
    && request.headers.has("X-Request-Signature");

  if (!hasHmacHeaders) {
    return false;
  }

  const result = await verifyHmacSignature(request, env);
  return result.valid;
}

// ==========================================
// クォータ SQL ヘルパー（quota.ts から再エクスポート）
// ==========================================

import {
  type QuotaRow,
  INITIAL_QUOTA,
  getQuotaByUserId,
  initQuota,
  consumeQuota,
  addQuota,
  resolveQuotaUserId as resolveQuotaUserIdCore,
  initializeQuota,
} from "./quota";

/**
 * クォータ残高を確認してから消費する
 *
 * @param env - Cloudflare Worker 環境変数
 * @param db - libsql クライアント
 * @param userId - ユーザーID
 * @param cost - 消費量
 * @param origin - CORS オリジン
 * @returns 成功時は { ok: true }、失敗時は { ok: false, error: Response }
 */
async function checkAndConsumeQuota(
  env: Env,
  db: Client,
  userId: string,
  cost: number,
  origin: string
): Promise<{ ok: true } | { ok: false; error: Response }> {
  const quota = await getQuotaByUserId(db, userId);
  if (!quota) {
    return {
      ok: false,
      error: errorResponse("クォータが初期化されていません", 403, origin, "QUOTA_NOT_INITIALIZED"),
    };
  }
  if (quota.balance < cost) {
    return {
      ok: false,
      error: errorResponse(
        `クォータが不足しています（残り: ${quota.balance}、必要: ${cost}）`,
        402,
        origin,
        "QUOTA_INSUFFICIENT"
      ),
    };
  }

  const consumed = await consumeQuota(db, userId, cost);
  if (!consumed) {
    return {
      ok: false,
      error: errorResponse("クォータ消費に失敗しました", 409, origin, "QUOTA_CONFLICT"),
    };
  }
  return { ok: true };
}

// ==========================================
// レスポンスヘルパー
// ==========================================

function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Device-Id, X-Auth-Device-Id, X-Request-Timestamp, X-Request-Signature",
  };
}

function jsonResponse(body: Record<string, unknown>, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

function errorResponse(message: string, status: number, origin: string, code = "API_ERROR"): Response {
  return jsonResponse({ success: false, error: { code, message } }, status, origin);
}

// ==========================================
// リクエストヘルパー
// ==========================================

/**
 * X-Device-Id ヘッダーを取得する
 *
 * @param request - リクエスト
 * @returns デバイスIDまたは null
 */
function getUserId(request: Request): string | null {
  return request.headers.get("X-Device-Id");
}

function requireDeviceId(request: Request, origin: string): { deviceId: string } | { error: Response } {
  const deviceId = getUserId(request);
  if (!deviceId) {
    return { error: errorResponse("X-Device-Id ヘッダーが必要です", 400, origin, "DEVICE_ID_REQUIRED") };
  }
  return { deviceId };
}

/**
 * X-User-Id ヘッダーを含むリクエストから実効クォータユーザーIDを解決する
 *
 * X-User-Id が指定されている場合、sessions テーブルでセッション検証を行い、
 * 改変クライアントによる他人の口座参照を防ぐ。
 */
async function resolveQuotaUserId(
  db: Client,
  deviceId: string,
  request: Request
): Promise<string> {
  const headerUserId = request.headers.get("X-User-Id");

  if (headerUserId) {
    // セッショントークンでユーザーの所有権を証明する
    const sessionToken = request.headers.get("X-Session-Token");
    if (!sessionToken) {
      return resolveQuotaUserIdCore(db, deviceId, null);
    }
    const session = await db.execute({
      sql: "SELECT user_id FROM sessions WHERE token = ? AND user_id = ? AND expires_at > datetime('now') LIMIT 1",
      args: [sessionToken, headerUserId],
    });
    if (session.rows.length === 0) {
      return resolveQuotaUserIdCore(db, deviceId, null);
    }
  }

  return resolveQuotaUserIdCore(db, deviceId, headerUserId);
}

function getEndpointId(env: Env, type: EndpointType): string {
  if (type === "whisper") return env.RUNPOD_WHISPER_ENDPOINT_ID;
  return env.RUNPOD_TRANSLATE_ENDPOINT_ID;
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

// ==========================================
// メインフェッチハンドラー
// ==========================================

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = env.ALLOWED_ORIGIN;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const url = new URL(request.url);

    // Better Auth ルート（アプリ認証不要）
    if (url.pathname.startsWith("/api/auth")) {
      const auth = createAuth(env, request.url);
      return auth.handler(request);
    }

    // デバイス登録エンドポイント（タイムスタンプ検証 + IPレート制限）
    if (url.pathname === "/api/device/register" && request.method === "POST") {
      const regDb = getDb(env);
      await ensureSchema(regDb);
      const clientIp = request.headers.get("CF-Connecting-IP") ?? "unknown";
      if (await isRegisterRateLimited(regDb, clientIp)) {
        return errorResponse(
          "登録リクエストが多すぎます。しばらく待ってから再度お試しください",
          429,
          origin,
          "REGISTER_RATE_LIMITED"
        );
      }
      try {
        return await handleDeviceRegister(request, env, origin);
      } catch (error) {
        const message = error instanceof Error ? error.message : "サーバーエラーが発生しました";
        return errorResponse(message, 500, origin, "INTERNAL_ERROR");
      }
    }

    const authenticated = await validateAuth(request, env);
    if (!authenticated) {
      return errorResponse("認証が必要です", 401, origin, "AUTH_REQUIRED");
    }

    // レート制限チェック（デバイスIDベース、DBベース）
    const rateLimitDeviceId = getUserId(request);
    if (rateLimitDeviceId) {
      const rlDb = getDb(env);
      await ensureRateLimitSchema(rlDb);
      if (await isApiRateLimited(rlDb, rateLimitDeviceId)) {
        return errorResponse(
          "リクエストが多すぎます。しばらく待ってから再度お試しください",
          429,
          origin,
          "RATE_LIMIT_EXCEEDED"
        );
      }
    }

    const path = url.pathname;

    // メトリクス記録用タイマー
    const metricsDb = getDb(env);
    await ensureSchema(metricsDb);
    const endMetric = startMetricTimer(metricsDb, path, request.method);

    // 定期的に古いメトリクスを削除（1%の確率で実行）
    if (Math.random() < 0.01) {
      pruneOldMetrics(metricsDb);
    }

    try {
      // --- クォータ管理API ---
      if (path === "/api/quota/init" && request.method === "POST") {
        const resp = await handleQuotaInit(request, env, origin);
        endMetric(resp.status);
        return resp;
      }
      if (path === "/api/quota" && request.method === "GET") {
        const resp = await handleQuotaGet(request, env, origin);
        endMetric(resp.status);
        return resp;
      }
      if (path === "/api/quota/ad-nonce" && request.method === "POST") {
        const resp = await handleQuotaAdNonce(request, env, origin);
        endMetric(resp.status);
        return resp;
      }
      if (path === "/api/quota/add" && request.method === "POST") {
        const resp = await handleQuotaAdd(request, env, origin);
        endMetric(resp.status);
        return resp;
      }
      if (path === "/api/quota/purchase" && request.method === "POST") {
        const resp = await handleQuotaPurchase(request, env, origin);
        endMetric(resp.status);
        return resp;
      }

      // --- デバイスID必須のAPI ---
      const result = requireDeviceId(request, origin);
      if ("error" in result) {
        endMetric(400, "DEVICE_ID_REQUIRED");
        return result.error;
      }
      const { deviceId } = result;

      if (path === "/api/transcribe" && request.method === "POST") {
        const resp = await handleTranscribe(request, env, origin, deviceId);
        endMetric(resp.status, undefined, resp.status < 400 ? 1 : 0);
        return resp;
      }
      if (path === "/api/translate" && request.method === "POST") {
        const resp = await handleTranslate(request, env, origin, deviceId);
        endMetric(resp.status, undefined, resp.status < 400 ? 1 : 0);
        return resp;
      }
      if (path.startsWith("/api/job/") && request.method === "GET") {
        const resp = await handleJobStatus(request, env, origin);
        endMetric(resp.status);
        return resp;
      }

      endMetric(404, "NOT_FOUND");
      return errorResponse("エンドポイントが見つかりません", 404, origin, "NOT_FOUND");
    } catch (error) {
      const message = error instanceof Error ? error.message : "サーバーエラーが発生しました";
      endMetric(500, "INTERNAL_ERROR");
      return errorResponse(message, 500, origin, "INTERNAL_ERROR");
    }
  },
};

// ==========================================
// デバイス登録エンドポイント
// ==========================================

/**
 * デバイスをサーバーに登録する
 *
 * クライアントからdeviceIdとdeviceSecretを受け取り、
 * secretのPBKDF2ハッシュとサーバー生成のhmac_keyを保存する。
 * hmac_keyをクライアントに返し、以降のHMAC署名に使用させる。
 *
 * 既に登録済みのデバイスの場合はdeviceSecretを検証し、
 * 一致すれば既存のhmac_keyを返す。
 */
async function handleDeviceRegister(
  request: Request,
  env: Env,
  origin: string
): Promise<Response> {
  const body = (await request.json()) as {
    deviceId?: string;
    deviceSecret?: string;
    timestamp?: string;
    attestation?: AttestationPayload | null;
  };

  if (!body.deviceId || !body.deviceSecret) {
    return errorResponse(
      "deviceId と deviceSecret は必須です",
      400,
      origin,
      "INVALID_REQUEST"
    );
  }

  if (body.deviceSecret.length < 32) {
    return errorResponse(
      "deviceSecret は32文字以上（16バイト以上のhex）である必要があります",
      400,
      origin,
      "INVALID_REQUEST"
    );
  }

  // タイムスタンプ検証（リプレイ攻撃防止）
  if (!body.timestamp) {
    return errorResponse(
      "timestamp は必須です",
      400,
      origin,
      "INVALID_REQUEST"
    );
  }
  const requestTime = new Date(body.timestamp).getTime();
  if (isNaN(requestTime) || Math.abs(Date.now() - requestTime) > HMAC_TIMESTAMP_TOLERANCE_MS) {
    return errorResponse(
      "タイムスタンプが無効または有効期限外です",
      400,
      origin,
      "TIMESTAMP_INVALID"
    );
  }

  // デバイス認証（Apple DeviceCheck / Play Integrity）
  const attestResult = await verifyRegistrationAttestation(body.attestation, env);
  if (!attestResult.ok) {
    return errorResponse(attestResult.reason, 403, origin, "ATTESTATION_FAILED");
  }

  const db = getDb(env);
  await ensureDevicesSchema(db);

  // 既存デバイスチェック
  const existing = await db.execute({
    sql: "SELECT secret_hash, hmac_key FROM devices WHERE device_id = ?",
    args: [body.deviceId],
  });

  if (existing.rows.length > 0) {
    const storedHash = existing.rows[0].secret_hash as string;
    const isValid = await verifyDeviceSecret(body.deviceSecret, storedHash);
    if (!isValid) {
      return errorResponse(
        "デバイスシークレットが一致しません",
        403,
        origin,
        "DEVICE_SECRET_MISMATCH"
      );
    }

    const hmacKey = existing.rows[0].hmac_key as string;
    return jsonResponse(
      {
        success: true,
        data: {
          deviceId: body.deviceId,
          hmacKey,
          registered: true,
        },
      },
      200,
      origin
    );
  }

  // 新規登録
  const secretHash = await hashDeviceSecret(body.deviceSecret);
  const hmacKey = generateHmacKey();

  await db.execute({
    sql: "INSERT INTO devices (device_id, secret_hash, hmac_key) VALUES (?, ?, ?)",
    args: [body.deviceId, secretHash, hmacKey],
  });

  return jsonResponse(
    {
      success: true,
      data: {
        deviceId: body.deviceId,
        hmacKey,
        registered: true,
      },
    },
    201,
    origin
  );
}

// ==========================================
// クォータ管理エンドポイント
// ==========================================

/**
 * クォータ初期化（初回起動時）
 */
async function handleQuotaInit(
  request: Request,
  env: Env,
  origin: string
): Promise<Response> {
  const result = requireDeviceId(request, origin);
  if ("error" in result) return result.error;
  const { deviceId } = result;
  const headerUserId = request.headers.get("X-User-Id");

  const db = getDb(env);
  await ensureQuotaSchema(db);

  // セッショントークンでユーザー所有権を検証（改変クライアント対策）
  let authUserId: string | null = null;
  if (headerUserId) {
    const sessionToken = request.headers.get("X-Session-Token");
    if (sessionToken) {
      const session = await db.execute({
        sql: "SELECT user_id FROM sessions WHERE token = ? AND user_id = ? AND expires_at > datetime('now') LIMIT 1",
        args: [sessionToken, headerUserId],
      });
      if (session.rows.length > 0) {
        authUserId = headerUserId;
      }
    }
  }

  const { balance, isNew } = await initializeQuota(db, deviceId, authUserId);
  return jsonResponse(
    { success: true, data: { balance, isNew } },
    isNew ? 201 : 200,
    origin
  );
}

/**
 * クォータ残高取得
 */
async function handleQuotaGet(
  request: Request,
  env: Env,
  origin: string
): Promise<Response> {
  const result = requireDeviceId(request, origin);
  if ("error" in result) return result.error;
  const { deviceId } = result;

  const db = getDb(env);
  await ensureQuotaSchema(db);
  const quotaUserId = await resolveQuotaUserId(db, deviceId, request);
  const quota = await getQuotaByUserId(db, quotaUserId);
  if (!quota) {
    return errorResponse("クォータが初期化されていません", 404, origin, "QUOTA_NOT_FOUND");
  }

  return jsonResponse({
    success: true,
    data: {
      balance: quota.balance,
      totalPurchased: quota.total_purchased,
      totalEarnedByAd: quota.total_earned_by_ad,
      totalConsumed: quota.total_consumed,
    },
  }, 200, origin);
}

/** 広告nonceの有効期限（ミリ秒）: 5分 */
const AD_NONCE_TTL_MS = 5 * 60 * 1000;

/**
 * 広告視聴用nonceをサーバーで発行する
 *
 * クライアントは広告表示前にこのエンドポイントでnonceを取得し、
 * 広告視聴後にそのnonceを使って報酬を申請する。
 * サーバー発行のnonceのみ受け付けることで、
 * クライアント側での自己申告を防止する。
 */
async function handleQuotaAdNonce(
  request: Request,
  env: Env,
  origin: string
): Promise<Response> {
  const result = requireDeviceId(request, origin);
  if ("error" in result) return result.error;
  const { deviceId } = result;

  const db = getDb(env);
  await ensureQuotaSchema(db);
  const quotaUserId = await resolveQuotaUserId(db, deviceId, request);

  const quota = await getQuotaByUserId(db, quotaUserId);
  if (!quota) {
    return errorResponse("クォータが初期化されていません", 404, origin, "QUOTA_NOT_FOUND");
  }

  // 日次レート制限の事前チェック
  const today = todayString();
  if (quota.ad_reward_date === today && quota.ad_reward_count >= AD_REWARD_DAILY_LIMIT) {
    return errorResponse(
      `本日の広告報酬上限（${AD_REWARD_DAILY_LIMIT}回）に達しました`,
      429,
      origin,
      "AD_REWARD_LIMIT_REACHED"
    );
  }

  const nonce = crypto.randomUUID();
  await db.execute({
    sql: "INSERT INTO ad_nonces (nonce, user_id) VALUES (?, ?)",
    args: [nonce, quotaUserId],
  });

  return jsonResponse({
    success: true,
    data: { nonce },
  }, 200, origin);
}

/**
 * 広告視聴によるクォータ追加（1日10回まで）
 *
 * サーバー発行のnonceのみ受け付ける。
 * nonceは発行から5分以内に使用する必要がある。
 */
async function handleQuotaAdd(
  request: Request,
  env: Env,
  origin: string
): Promise<Response> {
  const result = requireDeviceId(request, origin);
  if ("error" in result) return result.error;
  const { deviceId } = result;

  const body = (await request.json()) as { type?: string; nonce?: string };
  if (body.type !== "ad_reward") {
    return errorResponse("type は 'ad_reward' を指定してください", 400, origin, "INVALID_REQUEST");
  }

  if (!body.nonce || body.nonce.length < 16) {
    return errorResponse("nonce は必須です（16文字以上）", 400, origin, "INVALID_REQUEST");
  }

  const db = getDb(env);
  await ensureQuotaSchema(db);
  const quotaUserId = await resolveQuotaUserId(db, deviceId, request);

  // サーバー発行nonceの検証 + 原子的消費（CAS方式）
  // consumed_at IS NULL 条件付き UPDATE で二重付与を防ぐ
  const nonceConsume = await db.execute({
    sql: `UPDATE ad_nonces SET consumed_at = datetime('now')
          WHERE nonce = ? AND consumed_at IS NULL AND user_id = ?
          AND issued_at > datetime('now', '-${Math.floor(AD_NONCE_TTL_MS / 1000)} seconds')`,
    args: [body.nonce, quotaUserId],
  });

  if (nonceConsume.rowsAffected === 0) {
    // 失敗理由を特定するために SELECT
    const nonceRow = await db.execute({
      sql: "SELECT user_id, issued_at, consumed_at FROM ad_nonces WHERE nonce = ?",
      args: [body.nonce],
    });
    if (nonceRow.rows.length === 0) {
      return errorResponse("無効なnonceです（サーバー発行のnonceを使用してください）", 403, origin, "NONCE_INVALID");
    }
    const nonceData = nonceRow.rows[0] as unknown as { user_id: string; consumed_at: string | null };
    if (nonceData.consumed_at !== null) {
      return errorResponse("このnonceは既に使用されています", 409, origin, "NONCE_ALREADY_USED");
    }
    if (nonceData.user_id !== quotaUserId) {
      return errorResponse("このnonceは別のユーザーに発行されました", 403, origin, "NONCE_DEVICE_MISMATCH");
    }
    return errorResponse("nonceの有効期限が切れています", 410, origin, "NONCE_EXPIRED");
  }

  // 日次レート制限 + 残高加算を原子的に実行（ad_reward_count を条件付き UPDATE）
  const today = todayString();
  const adUpdate = await db.execute({
    sql: `UPDATE quotas SET
            balance = balance + ?,
            total_earned_by_ad = total_earned_by_ad + ?,
            ad_reward_count = CASE WHEN ad_reward_date = ? THEN ad_reward_count + 1 ELSE 1 END,
            ad_reward_date = ?,
            updated_at = datetime('now')
          WHERE user_id = ?
          AND (ad_reward_date != ? OR ad_reward_count < ?)`,
    args: [AD_REWARD_QUOTA, AD_REWARD_QUOTA, today, today, quotaUserId, today, AD_REWARD_DAILY_LIMIT],
  });

  if (adUpdate.rowsAffected === 0) {
    return errorResponse(
      `本日の広告報酬上限（${AD_REWARD_DAILY_LIMIT}回）に達しました`,
      429,
      origin,
      "AD_REWARD_LIMIT_REACHED"
    );
  }

  const quota = await getQuotaByUserId(db, quotaUserId);
  if (!quota) {
    return errorResponse("クォータが初期化されていません", 404, origin, "QUOTA_NOT_FOUND");
  }

  // 購入履歴に記録
  await db.execute({
    sql: "INSERT INTO purchase_history (user_id, amount, type) VALUES (?, ?, 'ad_reward')",
    args: [quotaUserId, AD_REWARD_QUOTA],
  });

  return jsonResponse({
    success: true,
    data: {
      balance: quota.balance,
      added: AD_REWARD_QUOTA,
      dailyRemaining: AD_REWARD_DAILY_LIMIT - quota.ad_reward_count,
    },
  }, 200, origin);
}

/**
 * RevenueCat REST API でトランザクションの存在を検証する
 *
 * @param env - 環境変数
 * @param appUserId - RevenueCatのアプリユーザーID（デバイスID）
 * @param transactionId - 検証するトランザクションID
 * @param productId - 期待するプロダクトID
 * @returns 検証成功時はtrue
 */
async function verifyWithRevenueCat(
  env: Env,
  appUserId: string,
  transactionId: string,
  productId: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
      {
        headers: {
          Authorization: `Bearer ${env.REVENUECAT_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) return false;

    const data = (await response.json()) as {
      subscriber?: {
        non_subscriptions?: Record<string, Array<{ id: string; store_transaction_id: string }>>;
      };
    };

    const nonSubs = data.subscriber?.non_subscriptions;
    if (!nonSubs) return false;

    // プロダクトIDに該当するトランザクションを検索
    const transactions = nonSubs[productId] ?? [];
    return transactions.some(
      (tx) => tx.id === transactionId || tx.store_transaction_id === transactionId
    );
  } catch {
    return false;
  }
}

/**
 * 課金によるクォータ購入
 *
 * トランザクションIDの重複チェックを実施し、
 * RevenueCat REST APIで購入を検証する（Sandbox/本番共通）。
 * REVENUECAT_API_KEYは必須。未設定時は503を返す。
 */
async function handleQuotaPurchase(
  request: Request,
  env: Env,
  origin: string
): Promise<Response> {
  const result = requireDeviceId(request, origin);
  if ("error" in result) return result.error;
  const { deviceId } = result;

  const body = (await request.json()) as {
    packId?: string;
    receiptToken?: string;
    productId?: string;
    appUserId?: string;
  };
  const packId = body.packId as QuotaPack | undefined;
  if (!packId || !QUOTA_PACKS[packId]) {
    return errorResponse("無効なパックIDです", 400, origin, "INVALID_PACK");
  }

  if (!body.receiptToken || body.receiptToken.trim().length === 0) {
    return errorResponse(
      "トランザクションIDが必要です",
      400,
      origin,
      "RECEIPT_REQUIRED"
    );
  }

  const db = getDb(env);
  await ensureQuotaSchema(db);

  // 一意制約を事前確保（冪等）
  await db.execute(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_receipt_unique ON purchase_history (receipt_token) WHERE type = 'purchase'"
  ).catch(() => { /* 既存時は無視 */ });

  // RevenueCat API キーは必須（Sandbox/本番共通で検証する）
  if (!env.REVENUECAT_API_KEY) {
    return errorResponse(
      "購入検証が利用できません（REVENUECAT_API_KEY未設定）",
      503,
      origin,
      "PURCHASE_VERIFICATION_UNAVAILABLE"
    );
  }

  // RevenueCat REST API でトランザクションを検証
  // appUserId: ログイン済みならuser.id、未ログインならdeviceIdにフォールバック
  {
    const subscriberId = body.appUserId ?? deviceId;
    const productId = body.productId ?? packId;
    const verified = await verifyWithRevenueCat(
      env,
      subscriberId,
      body.receiptToken,
      productId
    );
    if (!verified) {
      return errorResponse(
        "購入の検証に失敗しました",
        403,
        origin,
        "RECEIPT_INVALID"
      );
    }
  }

  const amount = QUOTA_PACKS[packId];
  const quotaUserId = await resolveQuotaUserId(db, deviceId, request);

  // 購入履歴を原子的にINSERT（一意制約で二重加算を防止）
  try {
    await db.execute({
      sql: "INSERT INTO purchase_history (user_id, receipt_token, pack_id, amount, type, auth_user_id) VALUES (?, ?, ?, ?, 'purchase', ?)",
      args: [quotaUserId, body.receiptToken, packId, amount, body.appUserId ?? null],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("UNIQUE") || msg.includes("unique") || msg.includes("constraint")) {
      return errorResponse("この購入は既に処理済みです", 409, origin, "DUPLICATE_PURCHASE");
    }
    throw err;
  }

  // INSERT成功後にクォータを付与
  const newBalance = await addQuota(db, quotaUserId, amount, "purchase");

  return jsonResponse(
    { success: true, data: { balance: newBalance, added: amount, pack: packId } },
    200,
    origin
  );
}

// ==========================================
// 既存API（クォータチェック付き）
// ==========================================

/**
 * 音声認識（runsync同期方式）
 */
async function handleTranscribe(
  request: Request,
  env: Env,
  origin: string,
  deviceId: string
): Promise<Response> {
  const db = getDb(env);
  await ensureQuotaSchema(db);
  const quotaUserId = await resolveQuotaUserId(db, deviceId, request);

  // 残高チェック（まだ消費しない）
  const quota = await getQuotaByUserId(db, quotaUserId);
  if (!quota) {
    return errorResponse("クォータが初期化されていません", 403, origin, "QUOTA_NOT_INITIALIZED");
  }
  if (quota.balance < TRANSCRIBE_COST) {
    return errorResponse(
      `クォータが不足しています（残り: ${quota.balance}、必要: ${TRANSCRIBE_COST}）`,
      402, origin, "QUOTA_INSUFFICIENT"
    );
  }

  // バリデーション
  const body = (await request.json()) as {
    audio_base64?: string;
    language?: string;
    model?: string;
  };

  if (!body.audio_base64) {
    return errorResponse("audio_base64は必須です", 400, origin, "INVALID_REQUEST");
  }

  // 外部API呼び出し
  const runpodUrl = `https://api.runpod.ai/v2/${env.RUNPOD_WHISPER_ENDPOINT_ID}/runsync`;

  const response = await fetch(runpodUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.RUNPOD_API_KEY}`,
    },
    body: JSON.stringify({
      input: {
        audio_base64: body.audio_base64,
        model: body.model ?? "medium",
        language: body.language ?? null,
        transcription: "plain_text",
        translate: false,
        temperature: 0,
        best_of: 5,
        beam_size: 5,
        suppress_tokens: "-1",
        condition_on_previous_text: false,
        temperature_increment_on_fallback: 0.2,
        compression_ratio_threshold: 2.4,
        logprob_threshold: -1,
        no_speech_threshold: 0.6,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    return errorResponse(`Faster Whisper失敗: ${response.status} ${errorText}`, 502, origin);
  }

  // API成功後にクォータを消費（並行リクエストで残高不足なら失敗）
  const consumed = await consumeQuota(db, quotaUserId, TRANSCRIBE_COST);
  if (!consumed) {
    return errorResponse("クォータ消費に失敗しました（残高不足の可能性）", 402, origin, "QUOTA_INSUFFICIENT");
  }

  const data = await response.text();
  return new Response(data, {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

/**
 * 翻訳ジョブ投入（runsync同期方式）
 */
async function handleTranslate(
  request: Request,
  env: Env,
  origin: string,
  deviceId: string
): Promise<Response> {
  const db = getDb(env);
  await ensureQuotaSchema(db);
  const quotaUserId = await resolveQuotaUserId(db, deviceId, request);

  // 残高チェック（まだ消費しない）
  const quota = await getQuotaByUserId(db, quotaUserId);
  if (!quota) {
    return errorResponse("クォータが初期化されていません", 403, origin, "QUOTA_NOT_INITIALIZED");
  }
  if (quota.balance < TRANSLATE_COST) {
    return errorResponse(
      `クォータが不足しています（残り: ${quota.balance}、必要: ${TRANSLATE_COST}）`,
      402, origin, "QUOTA_INSUFFICIENT"
    );
  }

  // バリデーション
  const body = (await request.json()) as {
    text?: string;
    sourceLanguage?: string;
    targetLanguage?: string;
  };

  if (!body.text || !body.sourceLanguage || !body.targetLanguage) {
    return errorResponse("text, sourceLanguage, targetLanguageは必須です", 400, origin, "INVALID_REQUEST");
  }

  // 外部API呼び出し
  const runpodUrl = `https://api.runpod.ai/v2/${env.RUNPOD_TRANSLATE_ENDPOINT_ID}/runsync`;

  const response = await fetch(runpodUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.RUNPOD_API_KEY}`,
    },
    body: JSON.stringify({
      input: {
        text: body.text,
        source_language: body.sourceLanguage,
        target_language: body.targetLanguage,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    return errorResponse(`翻訳失敗: ${response.status} ${errorText}`, 502, origin);
  }

  // API成功後にクォータを消費（並行リクエストで残高不足なら失敗）
  const consumed = await consumeQuota(db, quotaUserId, TRANSLATE_COST);
  if (!consumed) {
    return errorResponse("クォータ消費に失敗しました（残高不足の可能性）", 402, origin, "QUOTA_INSUFFICIENT");
  }

  const data = await response.text();
  return new Response(data, {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

/**
 * ジョブステータス問い合わせ（クォータ不要）
 */
async function handleJobStatus(
  request: Request,
  env: Env,
  origin: string
): Promise<Response> {
  const url = new URL(request.url);
  const jobId = url.pathname.replace("/api/job/", "");
  const endpointParam = url.searchParams.get("endpoint");

  if (!jobId) return errorResponse("ジョブIDが指定されていません", 400, origin);
  if (endpointParam !== "whisper" && endpointParam !== "translate") {
    return errorResponse("endpointパラメータにwhisperまたはtranslateを指定してください", 400, origin);
  }

  const endpointId = getEndpointId(env, endpointParam);
  const statusUrl = `https://api.runpod.ai/v2/${endpointId}/status/${jobId}`;

  const response = await fetch(statusUrl, {
    method: "GET",
    headers: { Authorization: `Bearer ${env.RUNPOD_API_KEY}` },
  });

  if (!response.ok) {
    return errorResponse(`ステータス取得失敗: ${response.status}`, 502, origin);
  }

  const data = await response.text();
  return new Response(data, {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}
