import { useCallback, useState } from "react";
import { getErrorMessage } from "@/lib/error";
import { logger } from "@/lib/logger";
import { translateText } from "@/services/api/translator";
import type { LanguageCode } from "@/types/language";

type UseTranslationReturn = {
  isTranslating: boolean;
  translatedText: string;
  error: string | null;
  translate: (text: string, source: LanguageCode, target: LanguageCode) => Promise<string | null>;
  reset: () => void;
};

/**
 * 翻訳フック
 */
export function useTranslation(): UseTranslationReturn {
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedText, setTranslatedText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const translate = useCallback(
    async (text: string, source: LanguageCode, target: LanguageCode) => {
      if (!text.trim()) return null;

      setIsTranslating(true);
      setError(null);

      try {
        const result = await translateText(text, source, target);
        setTranslatedText(result);
        return result;
      } catch (err) {
        const message = getErrorMessage(err);
        setError(message);
        logger.error("翻訳エラー", { error: message });
        return null;
      } finally {
        setIsTranslating(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setTranslatedText("");
    setError(null);
  }, []);

  return { isTranslating, translatedText, error, translate, reset };
}
