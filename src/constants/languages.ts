import type { Language, LanguageCode } from "@/types/language";

/** 対応言語一覧 */
export const LANGUAGES: Record<LanguageCode, Language> = {
  ja: { code: "ja", name: "Japanese", nativeName: "日本語", jaName: "日本語", whisperCode: "ja" },
  en: { code: "en", name: "English", nativeName: "English", jaName: "英語", whisperCode: "en" },
  zh: { code: "zh", name: "Chinese", nativeName: "中文", jaName: "中国語", whisperCode: "zh" },
  ko: { code: "ko", name: "Korean", nativeName: "한국어", jaName: "韓国語", whisperCode: "ko" },
  es: { code: "es", name: "Spanish", nativeName: "Español", jaName: "スペイン語", whisperCode: "es" },
  fr: { code: "fr", name: "French", nativeName: "Français", jaName: "フランス語", whisperCode: "fr" },
  de: { code: "de", name: "German", nativeName: "Deutsch", jaName: "ドイツ語", whisperCode: "de" },
  pt: { code: "pt", name: "Portuguese", nativeName: "Português", jaName: "ポルトガル語", whisperCode: "pt" },
  th: { code: "th", name: "Thai", nativeName: "ไทย", jaName: "タイ語", whisperCode: "th" },
  vi: { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt", jaName: "ベトナム語", whisperCode: "vi" },
  id: { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia", jaName: "インドネシア語", whisperCode: "id" },
  ar: { code: "ar", name: "Arabic", nativeName: "العربية", jaName: "アラビア語", whisperCode: "ar" },
};

/**
 * 閲覧者のロケールに応じた言語表示名を取得する
 *
 * @param langCode - 表示対象の言語コード
 * @param viewerLocale - 閲覧者のロケール（"ja" または "en"）
 * @returns ローカライズされた言語名
 */
export function getLanguageDisplayName(langCode: LanguageCode, viewerLocale: "ja" | "en"): string {
  const lang = LANGUAGES[langCode];
  if (viewerLocale === "ja") return lang.jaName;
  return lang.name;
}

/** デフォルトのソース言語 */
export const DEFAULT_SOURCE_LANGUAGE: LanguageCode = "ja";

/** デフォルトのターゲット言語 */
export const DEFAULT_TARGET_LANGUAGE: LanguageCode = "en";

/** 言語コード一覧 */
export const LANGUAGE_CODES = Object.keys(LANGUAGES) as LanguageCode[];
