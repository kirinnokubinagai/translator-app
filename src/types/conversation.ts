import type { LanguageCode } from "./language";

export type Speaker = "speaker1" | "speaker2";

export type ConversationMessage = {
  id: string;
  speaker: Speaker;
  originalText: string;
  translatedText: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  timestamp: number;
};
