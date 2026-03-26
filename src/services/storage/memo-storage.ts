import AsyncStorage from "@react-native-async-storage/async-storage";
import { logger } from "@/lib/logger";
import type { Memo } from "@/types/memo";

/** メモ保存キー */
const MEMO_STORAGE_KEY = "translator_memos";

/**
 * すべてのメモを取得する
 */
export async function getAllMemos(): Promise<Memo[]> {
  try {
    const json = await AsyncStorage.getItem(MEMO_STORAGE_KEY);
    if (!json) return [];

    const memos = JSON.parse(json) as Memo[];
    return memos.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    logger.error("メモ読み込みエラー", {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * メモを保存する
 */
export async function saveMemo(memo: Memo): Promise<void> {
  try {
    const memos = await getAllMemos();
    memos.unshift(memo);
    await AsyncStorage.setItem(MEMO_STORAGE_KEY, JSON.stringify(memos));
    logger.debug("メモを保存しました", { id: memo.id });
  } catch (error) {
    logger.error("メモ保存エラー", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * メモを削除する
 */
export async function deleteMemo(id: string): Promise<void> {
  try {
    const memos = await getAllMemos();
    const filtered = memos.filter((m) => m.id !== id);
    await AsyncStorage.setItem(MEMO_STORAGE_KEY, JSON.stringify(filtered));
    logger.debug("メモを削除しました", { id });
  } catch (error) {
    logger.error("メモ削除エラー", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * IDでメモを取得する
 */
export async function getMemoById(id: string): Promise<Memo | null> {
  const memos = await getAllMemos();
  return memos.find((m) => m.id === id) ?? null;
}

/**
 * すべてのメモを削除する
 */
export async function clearAllMemos(): Promise<void> {
  try {
    await AsyncStorage.removeItem(MEMO_STORAGE_KEY);
    logger.debug("すべてのメモを削除しました");
  } catch (error) {
    logger.error("メモ全削除エラー", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
