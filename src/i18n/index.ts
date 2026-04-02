import { en } from "./en";
import { ja } from "./ja";

/** 対応UIロケール */
export type Locale = "ja" | "en";

/** デフォルトロケール */
export const DEFAULT_LOCALE: Locale = "ja";

/** 翻訳リソース */
const resources = { ja, en } as const;

/**
 * 翻訳テキストを取得する
 *
 * @param locale - ロケール
 * @param key - ドット区切りのキー（例: "common.cancel"）
 * @param params - テンプレート変数（例: { amount: "5" }）
 */
export function t(locale: Locale, key: string, params?: Record<string, string | number>): string {
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

  if (!params) {
    return current;
  }

  return current.replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
    String(params[name] ?? `{{${name}}}`),
  );
}

/**
 * i18nフック
 *
 * settingsストアのlocaleに連動した翻訳関数を返す。
 * Reactコンポーネント内で使用する。
 *
 * useSettingsStoreへの依存を遅延importにすることで、
 * t() のみを使用するモジュール（error.ts等）が
 * AsyncStorageのNativeModule依存を引き込まないようにする。
 */
export function useT() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useCallback } = require("react") as typeof import("react");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useSettingsStore } = require("@/store/settings-store") as {
    useSettingsStore: (selector: (s: { locale: Locale }) => Locale) => Locale;
  };

  const locale = useSettingsStore((s: { locale: Locale }) => s.locale);
  return useCallback(
    (key: string, params?: Record<string, string | number>) => t(locale, key, params),
    [locale],
  );
}

export { en, ja };
