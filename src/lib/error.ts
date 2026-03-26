/** アプリケーションエラーの基底クラス */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown
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
    cause?: unknown
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
 * エラーからユーザー向けメッセージを取得する
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "予期しないエラーが発生しました";
}
