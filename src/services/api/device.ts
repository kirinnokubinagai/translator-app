import { API_BASE_URL } from "@/constants/api";
import {
  getDeviceId,
  getDeviceSecret,
  isDeviceRegistered,
  persistHmacKey,
  setDeviceRegistered,
} from "@/lib/device-id";
import { logger } from "@/lib/logger";
import { generateAttestationPayload } from "@/services/attestation";
import { apiRequest } from "./client";

/** デバイス登録レスポンス */
type DeviceRegisterResponse = {
  success: boolean;
  data?: {
    deviceId: string;
    hmacKey: string;
    registered: boolean;
  };
};

/**
 * デバイスをサーバーに登録する
 *
 * 初回起動時にデバイスID・デバイスシークレットをサーバーに送信し、
 * サーバー側でシークレットのPBKDF2ハッシュとHMACキーを保存する。
 * サーバーから返されたHMACキーをSecureStoreに保存し、
 * 以降のAPIリクエストのHMAC署名に使用する。
 *
 * 登録済みの場合はスキップする。
 * タイムスタンプ付きリクエストでリプレイ攻撃を防止する。
 *
 * @returns 登録成功時はtrue、失敗時はfalse
 */
export async function registerDevice(): Promise<boolean> {
  const alreadyRegistered = await isDeviceRegistered();
  if (alreadyRegistered) return true;

  try {
    const deviceId = await getDeviceId();
    const deviceSecret = await getDeviceSecret();
    const timestamp = new Date().toISOString();
    const attestation = await generateAttestationPayload();

    const response = await apiRequest<DeviceRegisterResponse>(
      `${API_BASE_URL}/api/device/register`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Device-Id": deviceId,
        },
        body: JSON.stringify({
          deviceId,
          deviceSecret,
          timestamp,
          attestation,
        }),
        retries: 2,
      },
    );

    if (!response.success || !response.data?.hmacKey) {
      logger.warn("デバイス登録失敗: サーバーがhmacKeyを返しませんでした");
      return false;
    }

    await persistHmacKey(response.data.hmacKey);
    await setDeviceRegistered(true);
    logger.info("デバイス登録成功", { deviceId });
    return true;
  } catch (error) {
    logger.error("デバイス登録エラー", {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
