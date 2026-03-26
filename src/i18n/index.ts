import { ja } from "./ja";
import { en } from "./en";

/** 対応UIロケール */
export type Locale = "ja" | "en";

/** デフォルトロケール */
export const DEFAULT_LOCALE: Locale = "ja";

/** 翻訳リソース */
const resources = { ja, en } as const;

/**
 * 翻訳テキストを取得する
 */
export function t(locale: Locale, key: string): string {
  const keys = key.split(".");
  let current: unknown = resources[locale];

  for (const k of keys) {
    if (typeof current !== "object" || current === null) {
      return key;
    }
    current = (current as Record<string, unknown>)[k];
  }

  if (typeof current !== "string") {
    return key;
  }

  return current;
}

export { ja, en };
