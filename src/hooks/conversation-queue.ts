import type { Speaker } from "@/types/conversation";
import type { LanguageCode } from "@/types/language";

/** キューアイテム（録音時点の話者・言語をスナップショット） */
export type QueueItem = {
  base64: string;
  speaker: Speaker;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
};

/**
 * チャンクをキューに追加する（話者・言語をスナップショット）
 *
 * @param queue - 追加先のキュー配列
 * @param base64 - 音声データ（base64エンコード）
 * @param speaker - 話者
 * @param speaker1Language - 話者1の言語
 * @param speaker2Language - 話者2の言語
 */
export function enqueueChunk(
  queue: QueueItem[],
  base64: string,
  speaker: Speaker,
  speaker1Language: LanguageCode,
  speaker2Language: LanguageCode,
): void {
  const sourceLanguage = speaker === "speaker1" ? speaker1Language : speaker2Language;
  const targetLanguage = speaker === "speaker1" ? speaker2Language : speaker1Language;
  queue.push({ base64, speaker, sourceLanguage, targetLanguage });
}
