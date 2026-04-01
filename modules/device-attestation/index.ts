import DeviceAttestationModule from "./src/DeviceAttestationModule";

/**
 * デバイス認証がサポートされているか
 *
 * ネイティブモジュールが利用不可（Expo Go / シミュレータ等）の場合は false
 * iOS: DeviceCheck API が利用可能な場合 true
 * Android: Google Play Services が利用可能な場合 true
 */
export const isSupported: boolean = DeviceAttestationModule?.isSupported ?? false;

/**
 * デバイス認証トークンを生成する
 *
 * iOS: Apple DeviceCheck API でトークンを生成（Base64エンコード済み）
 * Android: Google Play Integrity API でインテグリティトークンを生成
 *
 * @param nonce - サーバー側での検証に使用するnonce文字列
 * @returns デバイストークン
 * @throws デバイス認証が利用不可の場合
 */
export async function generateDeviceToken(nonce: string): Promise<string> {
  if (!DeviceAttestationModule) {
    throw new Error("DeviceAttestation native module is not available");
  }
  return await DeviceAttestationModule.generateDeviceToken(nonce);
}
