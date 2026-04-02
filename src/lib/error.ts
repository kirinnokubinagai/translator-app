import type { Locale } from "@/i18n";
import { t } from "@/i18n";

/** アプリケーションエラーの基底クラス */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/** API通信エラー */
export class ApiError extends AppError {
  constructor(
    message: string,
    public readonly statusCode?: number,
    cause?: unknown,
    public readonly errorCode: string = "API_ERROR",
  ) {
    super(message, "API_ERROR", cause);
    this.name = "ApiError";
  }
}

/** 音声認識エラー */
export class SpeechRecognitionError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, "SPEECH_RECOGNITION_ERROR", cause);
    this.name = "SpeechRecognitionError";
  }
}

/** 翻訳エラー */
export class TranslationError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, "TRANSLATION_ERROR", cause);
    this.name = "TranslationError";
  }
}

/** 録音エラー */
export class RecordingError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, "RECORDING_ERROR", cause);
    this.name = "RecordingError";
  }
}

/**
 * 現在のロケールを安全に取得する
 *
 * Reactコンポーネント外でも動作するよう、
 * useSettingsStoreを遅延importして取得を試みる。
 * 失敗した場合は "ja" にフォールバックする。
 */
function resolveLocale(): Locale {
  try {
    // 遅延importでテスト環境でのNativeModule依存を回避
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useSettingsStore } = require("@/store/settings-store") as {
      useSettingsStore: { getState: () => { locale: Locale } };
    };
    return useSettingsStore.getState().locale;
  } catch {
    return "ja";
  }
}

/**
 * エラーからユーザー向けメッセージを取得する
 *
 * エラーの種類に応じて具体的なアクション提案を含むメッセージを返す。
 * i18nリソースから現在のロケールに応じたメッセージを取得する。
 */
export function getErrorMessage(error: unknown): string {
  const locale = resolveLocale();

  if (error instanceof ApiError) {
    if (error.errorCode === "QUOTA_INSUFFICIENT") {
      return t(locale, "errors.quotaInsufficient");
    }
    if (error.statusCode === 401) {
      return t(locale, "errors.auth401");
    }
    if (error.statusCode === 429) {
      return t(locale, "errors.auth429");
    }
    if (error.statusCode === 503 || error.message.includes("サーバー起動中")) {
      return t(locale, "errors.serverPreparing");
    }
    if (!error.statusCode || error.statusCode >= 500) {
      return t(locale, "errors.serverError");
    }
    return error.message;
  }
  if (error instanceof SpeechRecognitionError) {
    return t(locale, "errors.speechRecognition");
  }
  if (error instanceof TranslationError) {
    return t(locale, "errors.translationError");
  }
  if (error instanceof RecordingError) {
    return t(locale, "errors.recordingError");
  }
  if (error instanceof AppError) {
    return error.message;
  }
  if (error instanceof Error) {
    if (error.message.includes("Network") || error.message.includes("fetch")) {
      return t(locale, "errors.networkConnection");
    }
    return error.message;
  }
  return t(locale, "errors.unexpected");
}
