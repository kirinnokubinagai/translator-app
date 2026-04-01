import { Platform } from "react-native";
import * as Crypto from "expo-crypto";
import { logger } from "@/lib/logger";

/** デバイス認証トークンの型 */
export type AttestationPayload = {
  platform: string;
  token: string;
  nonce?: string;
};

/** ネイティブモジュールの型 */
type DeviceAttestationModule = {
  isSupported: boolean;
  generateDeviceToken: (nonce: string) => Promise<string>;
};

/** キャッシュ済みモジュール参照 */
let cachedModule: DeviceAttestationModule | null = null;
/** モジュール読み込み試行済みフラグ */
let moduleChecked = false;

/**
 * デバイス認証ネイティブモジュールを動的にロードする
 *
 * Development Buildでのみ利用可能。
 * Expo Goやシミュレータでは利用不可のためnullを返す。
 */
function loadModule(): DeviceAttestationModule | null {
  if (moduleChecked) return cachedModule;
  moduleChecked = true;

  try {
    // Metro は import() を静的解析するため、ネイティブモジュール未ビルド時にクラッシュする。
    // require() + try-catch でランタイムフォールバックを実現する。
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("../../../modules/device-attestation") as DeviceAttestationModule;
    if (!mod || typeof mod.generateDeviceToken !== "function") {
      logger.debug("device-attestation モジュールのインターフェースが不正");
      return null;
    }
    cachedModule = mod;
    return cachedModule;
  } catch {
    logger.debug("device-attestation モジュールが利用不可");
    return null;
  }
}

/**
 * デバイス認証トークンを生成する
 *
 * iOS: Apple DeviceCheck API でハードウェアレベルのトークンを取得。
 *      サーバー側で Apple の API に送信して正規デバイスであることを検証する。
 * Android: Google Play Integrity API でインテグリティトークンを取得。
 *          サーバー側で Google の API に送信して正規デバイス・正規アプリを検証する。
 *
 * ネイティブモジュールが利用不可（Expo Go/シミュレータ）の場合はnullを返す。
 *
 * @returns 認証ペイロード、または利用不可時はnull
 */
export async function generateAttestationPayload(): Promise<AttestationPayload | null> {
  const mod = await loadModule();
  if (!mod || !mod.isSupported) {
    logger.debug("デバイス認証がサポートされていません", {
      platform: Platform.OS,
      moduleLoaded: String(!!mod),
      isSupported: String(mod?.isSupported ?? false),
    });
    return null;
  }

  try {
    const nonce = Crypto.randomUUID();
    const token = await mod.generateDeviceToken(nonce);
    return { platform: Platform.OS, token, nonce };
  } catch (error) {
    logger.warn("デバイス認証トークンの生成に失敗", {
      platform: Platform.OS,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
