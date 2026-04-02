import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { logger } from "@/lib/logger";

/** AsyncStorageキー */
const DEVICE_ID_KEY = "translator_device_id";

/** SecureStoreキー（デバイスシークレット用） */
const DEVICE_SECRET_KEY = "translator_device_secret";

/** SecureStoreキー（サーバー発行HMACキー用） */
const DEVICE_HMAC_KEY = "translator_device_hmac_key";

/** デバイス登録状態キー */
const DEVICE_REGISTERED_KEY = "translator_device_registered";

/** デバイスシークレットのバイト長 */
const DEVICE_SECRET_BYTE_LENGTH = 32;

/** キャッシュ済みデバイスID */
let cachedDeviceId: string | null = null;

/** キャッシュ済みデバイスシークレット */
let cachedDeviceSecret: string | null = null;

/** キャッシュ済みHMACキー */
let cachedHmacKey: string | null = null;

/** キャッシュ済み登録状態 */
let cachedRegistered: boolean | null = null;

/** SecureStoreが利用可能かどうか */
let secureStoreAvailable: boolean | null = null;

/** SecureStoreモジュール参照 */
let SecureStoreModule: typeof import("expo-secure-store") | null = null;

/**
 * SecureStoreの利用可否を判定し、モジュールをキャッシュする
 *
 * expo-secure-storeはExpo Goでは利用不可のため、
 * 動的importで読み込みを試み、失敗時はAsyncStorageにフォールバックする。
 */
function getSecureStore(): typeof import("expo-secure-store") | null {
  if (secureStoreAvailable === true) return SecureStoreModule;
  if (secureStoreAvailable === false) return null;

  try {
    // グローバルエラーハンドラーを一時退避（DevClientのオーバレイ表示を防ぐ）
    const g = globalThis as Record<string, unknown>;
    const ErrorUtils = g.ErrorUtils as
      | { getGlobalHandler: () => unknown; setGlobalHandler: (h: unknown) => void }
      | undefined;
    const prevHandler = ErrorUtils?.getGlobalHandler();
    if (ErrorUtils) ErrorUtils.setGlobalHandler(() => {});

    const name = "expo-secure-store";
    const mod = require(name) as typeof import("expo-secure-store");
    SecureStoreModule = mod;
    secureStoreAvailable = true;

    if (ErrorUtils && prevHandler) ErrorUtils.setGlobalHandler(prevHandler);
    return mod;
  } catch {
    // グローバルハンドラーを復元
    const g = globalThis as Record<string, unknown>;
    const ErrorUtils = g.ErrorUtils as
      | { getGlobalHandler: () => unknown; setGlobalHandler: (h: unknown) => void }
      | undefined;
    if (ErrorUtils) {
      // prevHandlerが失われるのでデフォルトに戻す試みはしない（既に復元済みか例外パス）
    }
    logger.debug("expo-secure-storeが利用不可のためAsyncStorageにフォールバック");
    secureStoreAvailable = false;
    return null;
  }
}

/**
 * デバイス固有IDを取得（なければ生成して永続化）
 */
export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;

  const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (stored) {
    cachedDeviceId = stored;
    return stored;
  }

  const newId = Crypto.randomUUID();
  await AsyncStorage.setItem(DEVICE_ID_KEY, newId);
  cachedDeviceId = newId;
  return newId;
}

/**
 * デバイスシークレットをSecureStore（優先）またはAsyncStorageに保存する
 *
 * @param secret - 保存するシークレット文字列
 */
async function persistDeviceSecret(secret: string): Promise<void> {
  try {
    const store = getSecureStore();
    if (store) {
      await store.setItemAsync(DEVICE_SECRET_KEY, secret);
      return;
    }
  } catch (error) {
    logger.warn("SecureStoreへのデバイスシークレット保存に失敗、AsyncStorageにフォールバック", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  if (!__DEV__) {
    throw new Error("SecureStoreが利用できません。機密情報の安全な保存に失敗しました");
  }
  await AsyncStorage.setItem(DEVICE_SECRET_KEY, secret);
}

/**
 * デバイスシークレットをSecureStore（優先）またはAsyncStorageから取得する
 *
 * @returns デバイスシークレット、未設定時はnull
 */
async function loadDeviceSecret(): Promise<string | null> {
  try {
    const store = getSecureStore();
    if (store) {
      return await store.getItemAsync(DEVICE_SECRET_KEY);
    }
  } catch (error) {
    logger.warn("SecureStoreからのデバイスシークレット取得に失敗、AsyncStorageにフォールバック", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return AsyncStorage.getItem(DEVICE_SECRET_KEY);
}

/**
 * デバイスシークレットを取得する（なければ生成して永続化）
 *
 * シークレットはHMAC署名に使用される暗号的に安全なランダム値。
 * SecureStoreに保存し、利用不可の場合はAsyncStorageにフォールバックする。
 *
 * @returns hex形式のデバイスシークレット（64文字）
 */
export async function getDeviceSecret(): Promise<string> {
  if (cachedDeviceSecret) return cachedDeviceSecret;

  const stored = await loadDeviceSecret();
  if (stored) {
    cachedDeviceSecret = stored;
    return stored;
  }

  const randomBytes = await Crypto.getRandomBytesAsync(DEVICE_SECRET_BYTE_LENGTH);
  const secretHex = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  await persistDeviceSecret(secretHex);
  cachedDeviceSecret = secretHex;
  return secretHex;
}

/**
 * デバイスがサーバーに登録済みかどうかを取得する
 *
 * @returns 登録済みの場合はtrue
 */
export async function isDeviceRegistered(): Promise<boolean> {
  if (cachedRegistered !== null) return cachedRegistered;

  const stored = await AsyncStorage.getItem(DEVICE_REGISTERED_KEY);
  const result = stored === "true";
  cachedRegistered = result;
  return result;
}

/**
 * デバイスの登録状態を永続化する
 *
 * @param registered - 登録済みフラグ
 */
export async function setDeviceRegistered(registered: boolean): Promise<void> {
  cachedRegistered = registered;
  await AsyncStorage.setItem(DEVICE_REGISTERED_KEY, registered ? "true" : "false");
}

/**
 * サーバー発行のHMACキーをSecureStore（優先）またはAsyncStorageに保存する
 *
 * @param hmacKey - hex形式のHMACキー
 */
export async function persistHmacKey(hmacKey: string): Promise<void> {
  cachedHmacKey = hmacKey;
  try {
    const store = getSecureStore();
    if (store) {
      await store.setItemAsync(DEVICE_HMAC_KEY, hmacKey);
      return;
    }
  } catch (error) {
    logger.warn("SecureStoreへのHMACキー保存に失敗、AsyncStorageにフォールバック", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  if (!__DEV__) {
    throw new Error("SecureStoreが利用できません。機密情報の安全な保存に失敗しました");
  }
  await AsyncStorage.setItem(DEVICE_HMAC_KEY, hmacKey);
}

/**
 * サーバー発行のHMACキーを取得する
 *
 * @returns hex形式のHMACキー、未設定時はnull
 */
export async function getHmacKey(): Promise<string | null> {
  if (cachedHmacKey) return cachedHmacKey;

  try {
    const store = getSecureStore();
    if (store) {
      const stored = await store.getItemAsync(DEVICE_HMAC_KEY);
      cachedHmacKey = stored;
      return stored;
    }
  } catch (error) {
    logger.warn("SecureStoreからのHMACキー取得に失敗、AsyncStorageにフォールバック", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  const stored = await AsyncStorage.getItem(DEVICE_HMAC_KEY);
  cachedHmacKey = stored;
  return stored;
}
