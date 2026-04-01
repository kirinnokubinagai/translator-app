/**
 * Cloudflare Worker 環境変数・バインディング型定義
 */
export type Env = {
  /** RunPod APIキー */
  RUNPOD_API_KEY: string;
  /** RunPod Whisper エンドポイントID */
  RUNPOD_WHISPER_ENDPOINT_ID: string;
  /** RunPod 翻訳エンドポイントID */
  RUNPOD_TRANSLATE_ENDPOINT_ID: string;
  /** アプリ認証シークレット */
  APP_SECRET: string;
  /** CORS許可オリジン */
  ALLOWED_ORIGIN: string;
  /** 開発モードフラグ */
  DEV_MODE: string;
  /** Turso データベースURL */
  TURSO_DB_URL: string;
  /** Turso 認証トークン */
  TURSO_AUTH_TOKEN: string;
  /** Google OAuth クライアントID */
  GOOGLE_CLIENT_ID: string;
  /** Google OAuth クライアントシークレット */
  GOOGLE_CLIENT_SECRET: string;
  /** Apple OAuth クライアントID */
  APPLE_CLIENT_ID: string;
  /** Apple OAuth クライアントシークレット */
  APPLE_CLIENT_SECRET: string;
  /** Better Auth シークレット */
  BETTER_AUTH_SECRET: string;
  /** RevenueCat REST APIキー（購入検証用、Sandbox/本番共通で必須） */
  REVENUECAT_API_KEY: string;
  /** Apple DeviceCheck 用キーID */
  APPLE_DEVICE_CHECK_KEY_ID?: string;
  /** Apple DeviceCheck 用秘密鍵（P8 PEM形式） */
  APPLE_DEVICE_CHECK_PRIVATE_KEY?: string;
  /** Apple Team ID */
  APPLE_TEAM_ID?: string;
  /** Google Cloud プロジェクト番号（Play Integrity 検証用） */
  GOOGLE_CLOUD_PROJECT_NUMBER?: string;
  /** Google サービスアカウントのメールアドレス（Play Integrity 検証用） */
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  /** Google サービスアカウントの秘密鍵（PEM形式、Play Integrity 検証用） */
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?: string;
};
