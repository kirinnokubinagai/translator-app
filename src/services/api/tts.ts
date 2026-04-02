import * as Speech from "expo-speech";
import { logger } from "@/lib/logger";
import type { LanguageCode } from "@/types/language";

/** expo-speechの言語コードマッピング */
const TTS_LANGUAGE_MAP: Record<LanguageCode, string> = {
  ja: "ja-JP",
  en: "en-US",
  zh: "zh-CN",
  ko: "ko-KR",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  pt: "pt-BR",
  th: "th-TH",
  vi: "vi-VN",
  id: "id-ID",
  ar: "ar-SA",
};

/**
 * テキストを音声で読み上げる
 */
export function speak(text: string, language: LanguageCode): void {
  if (!text.trim()) return;

  Speech.stop();

  Speech.speak(text, {
    language: TTS_LANGUAGE_MAP[language],
    rate: 0.9,
    onError: (error) => {
      logger.error("TTS再生エラー", {
        language,
        error: String(error),
      });
    },
  });
}

/**
 * 音声再生を停止する
 */
export function stopSpeaking(): void {
  Speech.stop();
}

/**
 * 音声が再生中かどうかを確認する
 */
export async function isSpeaking(): Promise<boolean> {
  return Speech.isSpeakingAsync();
}
