export type LanguageCode =
  | "ja"
  | "en"
  | "zh"
  | "ko"
  | "es"
  | "fr"
  | "de"
  | "pt"
  | "th"
  | "vi"
  | "id"
  | "ar";

export type Language = {
  code: LanguageCode;
  name: string;
  nativeName: string;
  jaName: string;
  whisperCode: string;
};
