/**
 * エラーユーティリティのユニットテスト
 */
import {
  ApiError,
  AppError,
  getErrorMessage,
  RecordingError,
  SpeechRecognitionError,
  TranslationError,
} from "./error";

describe("AppError", () => {
  it("messageとcodeを正しく設定できること", () => {
    const error = new AppError("テストエラー", "TEST_CODE");
    expect(error.message).toBe("テストエラー");
    expect(error.code).toBe("TEST_CODE");
    expect(error.name).toBe("AppError");
  });

  it("causeを設定できること", () => {
    const cause = new Error("原因エラー");
    const error = new AppError("テストエラー", "TEST_CODE", cause);
    expect(error.cause).toBe(cause);
  });

  it("Errorのインスタンスであること", () => {
    const error = new AppError("テスト", "CODE");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
  });
});

describe("ApiError", () => {
  it("statusCodeを正しく設定できること", () => {
    const error = new ApiError("APIエラー", 404);
    expect(error.message).toBe("APIエラー");
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe("ApiError");
  });

  it("statusCodeなしで生成できること", () => {
    const error = new ApiError("APIエラー");
    expect(error.statusCode).toBeUndefined();
  });

  it("errorCodeのデフォルトがAPI_ERRORであること", () => {
    const error = new ApiError("エラー");
    expect(error.errorCode).toBe("API_ERROR");
  });

  it("AppErrorのインスタンスであること", () => {
    const error = new ApiError("エラー", 500);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(ApiError);
  });
});

describe("SpeechRecognitionError", () => {
  it("nameがSpeechRecognitionErrorであること", () => {
    const error = new SpeechRecognitionError("音声認識失敗");
    expect(error.name).toBe("SpeechRecognitionError");
    expect(error.message).toBe("音声認識失敗");
    expect(error.code).toBe("SPEECH_RECOGNITION_ERROR");
  });

  it("AppErrorのインスタンスであること", () => {
    expect(new SpeechRecognitionError("エラー")).toBeInstanceOf(AppError);
  });
});

describe("TranslationError", () => {
  it("nameがTranslationErrorであること", () => {
    const error = new TranslationError("翻訳失敗");
    expect(error.name).toBe("TranslationError");
    expect(error.message).toBe("翻訳失敗");
    expect(error.code).toBe("TRANSLATION_ERROR");
  });

  it("AppErrorのインスタンスであること", () => {
    expect(new TranslationError("エラー")).toBeInstanceOf(AppError);
  });
});

describe("RecordingError", () => {
  it("nameがRecordingErrorであること", () => {
    const error = new RecordingError("録音失敗");
    expect(error.name).toBe("RecordingError");
    expect(error.message).toBe("録音失敗");
    expect(error.code).toBe("RECORDING_ERROR");
  });

  it("AppErrorのインスタンスであること", () => {
    expect(new RecordingError("エラー")).toBeInstanceOf(AppError);
  });
});

describe("getErrorMessage", () => {
  it("AppErrorのmessageを返すこと", () => {
    const error = new AppError("アプリエラーメッセージ", "CODE");
    expect(getErrorMessage(error)).toBe("アプリエラーメッセージ");
  });

  it("ApiError 500系はサーバーエラーメッセージを返すこと", () => {
    const error = new ApiError("APIエラーメッセージ", 500);
    expect(getErrorMessage(error)).toBe(
      "サーバーエラーが発生しました。しばらく待ってから再度お試しください。",
    );
  });

  it("ApiError QUOTA_INSUFFICIENTはクォータ不足メッセージを返すこと", () => {
    const error = new ApiError("クォータ不足", 403, undefined, "QUOTA_INSUFFICIENT");
    expect(getErrorMessage(error)).toBe(
      "クォータが不足しています。広告を視聴するかクォータを購入してください。",
    );
  });

  it("SpeechRecognitionErrorは音声認識メッセージを返すこと", () => {
    const error = new SpeechRecognitionError("音声認識失敗");
    expect(getErrorMessage(error)).toBe(
      "音声を認識できませんでした。もう一度はっきりと話してください。",
    );
  });

  it("TranslationErrorは翻訳メッセージを返すこと", () => {
    const error = new TranslationError("翻訳失敗");
    expect(getErrorMessage(error)).toBe("翻訳に失敗しました。ネットワーク接続を確認してください。");
  });

  it("RecordingErrorは録音メッセージを返すこと", () => {
    const error = new RecordingError("録音失敗");
    expect(getErrorMessage(error)).toBe("録音に失敗しました。マイクの使用許可を確認してください。");
  });

  it("通常のErrorのmessageを返すこと", () => {
    const error = new Error("通常のエラー");
    expect(getErrorMessage(error)).toBe("通常のエラー");
  });

  it("ネットワークエラーは接続メッセージを返すこと", () => {
    const error = new Error("Network request failed");
    expect(getErrorMessage(error)).toBe(
      "ネットワークに接続できません。通信環境を確認してください。",
    );
  });

  it("文字列を渡した場合デフォルトメッセージを返すこと", () => {
    expect(getErrorMessage("文字列エラー")).toBe(
      "予期しないエラーが発生しました。アプリを再起動してください。",
    );
  });

  it("nullを渡した場合デフォルトメッセージを返すこと", () => {
    expect(getErrorMessage(null)).toBe(
      "予期しないエラーが発生しました。アプリを再起動してください。",
    );
  });

  it("undefinedを渡した場合デフォルトメッセージを返すこと", () => {
    expect(getErrorMessage(undefined)).toBe(
      "予期しないエラーが発生しました。アプリを再起動してください。",
    );
  });

  it("数値を渡した場合デフォルトメッセージを返すこと", () => {
    expect(getErrorMessage(42)).toBe(
      "予期しないエラーが発生しました。アプリを再起動してください。",
    );
  });
});
