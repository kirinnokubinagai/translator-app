/** 認証済みユーザー情報 */
export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
};

/** 認証セッション情報 */
export type AuthSession = {
  user: AuthUser;
  token: string;
  expiresAt: string;
};

/** 認証状態 */
export type AuthState = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
};

/** メールログインパラメータ */
export type EmailLoginParams = {
  email: string;
  password: string;
};

/** メール登録パラメータ */
export type EmailSignUpParams = {
  email: string;
  password: string;
  name: string;
};

/** ソーシャルログインプロバイダー */
export type SocialProvider = "google" | "apple";
