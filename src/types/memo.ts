import type { LanguageCode } from "./language";

export type Memo = {
  id: string;
  originalText: string;
  translatedText: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  audioUri: string | null;
  duration: number;
  createdAt: number;
};
