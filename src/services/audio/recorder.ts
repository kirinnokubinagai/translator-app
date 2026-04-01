import { requestRecordingPermissionsAsync } from "expo-audio";
import * as FileSystem from "expo-file-system";
import { RecordingError } from "@/lib/error";
import { logger } from "@/lib/logger";

/**
 * マイクのパーミッションをリクエストする
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  const { granted } = await requestRecordingPermissionsAsync();
  return granted;
}

/**
 * 音声ファイルをBase64エンコードする
 *
 * 複数の読み取り方法を試行する:
 * 1. expo-file-system の readAsStringAsync
 * 2. fetch + blob → FileReader
 */
export async function audioToBase64(uri: string): Promise<string> {
  logger.debug("audioToBase64開始", { uri });

  let base64: string | null = null;

  // 方法1: expo-file-system
  try {
    const result = await FileSystem.readAsStringAsync(uri, {
      encoding: "base64",
    });
    if (result.length > 0) {
      base64 = result;
    }
  } catch (err1) {
    logger.warn("audioToBase64: FileSystem方式失敗", {
      error: err1 instanceof Error ? err1.message : String(err1),
    });
  }

  // 方法2: fetch（方法1が失敗した場合）
  if (!base64) {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      base64 = await blobToBase64(blob);
    } catch (err2) {
      logger.warn("audioToBase64: fetch方式も失敗", {
        error: err2 instanceof Error ? err2.message : String(err2),
      });
    }
  }

  // 読み取り後、一時ファイルを削除（ストレージ節約）
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    /* 削除失敗は無視 */
  }

  if (!base64) {
    throw new RecordingError(`音声ファイルの読み込みに失敗 (URI: ${uri})`);
  }

  logger.debug("audioToBase64成功", { size: String(base64.length) });
  return base64;
}

/**
 * BlobをBase64文字列に変換する
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64Data = dataUrl.split(",")[1];
      if (!base64Data) {
        reject(new Error("Base64変換結果が空"));
        return;
      }
      resolve(base64Data);
    };
    reader.onerror = () => reject(new Error("FileReader失敗"));
    reader.readAsDataURL(blob);
  });
}
