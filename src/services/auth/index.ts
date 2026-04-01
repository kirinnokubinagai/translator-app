import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAuthClient, getAuthUrl } from "./client";
import { getDeviceId } from "@/lib/device-id";
import { logger } from "@/lib/logger";
import type { AuthUser, EmailLoginParams, EmailSignUpParams, SocialProvider } from "@/types/auth";

/** AsyncStorageキー */
const AUTH_USER_KEY = "translator_auth_user";
const AUTH_SESSION_TOKEN_KEY = "translator_auth_session_token";

/** OAuthコールバック用URLスキーム */
const APP_SCHEME = "translator-app";
const CALLBACK_URL = `${APP_SCHEME}://auth/callback`;

/** キャッシュ済みユーザー */
let cachedUser: AuthUser | null = null;
/** キャッシュ済みセッショントークン */
let cachedSessionToken: string | null = null;
/** SecureStoreが利用可能かどうか */
let secureStoreAvailable: boolean | null = null;
/** SecureStoreモジュール参照 */
let SecureStoreModule: typeof import("expo-secure-store") | null = null;

/**
 * SecureStoreの利用可否を判定し、モジュールをキャッシュする
 *
 * expo-secure-storeはExpo Goでは利用不可のため、
 * 動的importで読み込みを試み、失敗時はAsyncStorageにフォールバックする。
 */
function getSecureStore(): typeof import("expo-secure-store") | null {
  if (secureStoreAvailable === true) return SecureStoreModule;
  if (secureStoreAvailable === false) return null;

  try {
    // グローバルエラーハンドラーを一時退避（DevClientのオーバレイ表示を防ぐ）
    const g = globalThis as Record<string, unknown>;
    const ErrorUtils = g.ErrorUtils as { getGlobalHandler: () => unknown; setGlobalHandler: (h: unknown) => void } | undefined;
    const prevHandler = ErrorUtils?.getGlobalHandler();
    if (ErrorUtils) ErrorUtils.setGlobalHandler(() => {});

    const name = "expo-secure-store";
    const mod = require(name) as typeof import("expo-secure-store");
    SecureStoreModule = mod;
    secureStoreAvailable = true;

    if (ErrorUtils && prevHandler) ErrorUtils.setGlobalHandler(prevHandler);
    return mod;
  } catch {
    logger.debug("expo-secure-storeが利用不可のためAsyncStorageにフォールバック");
    secureStoreAvailable = false;
    return null;
  }
}

/**
 * 認証済みユーザーIDを取得する
 *
 * Better Auth認証済みの場合はユーザーID、未認証の場合はデバイスIDを返す。
 * クォータシステムなどでユーザー識別に使用する。
 *
 * @returns ユーザーIDまたはデバイスID
 */
export async function getAuthUserId(): Promise<string> {
  const user = await getStoredUser();
  if (user) return user.id;
  return getDeviceId();
}

/**
 * 永続化されたユーザー情報を取得する
 */
export async function getStoredUser(): Promise<AuthUser | null> {
  if (cachedUser) return cachedUser;

  try {
    const stored = await AsyncStorage.getItem(AUTH_USER_KEY);
    if (!stored) return null;

    const user = JSON.parse(stored) as AuthUser;
    cachedUser = user;
    return user;
  } catch (error) {
    logger.warn("認証ユーザー読み込みエラー", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * セッショントークンをSecureStore（優先）またはAsyncStorageから取得する
 */
export async function getStoredSessionToken(): Promise<string | null> {
  if (cachedSessionToken !== null) return cachedSessionToken;

  try {
    const store = getSecureStore();
    if (store) {
      const stored = await store.getItemAsync(AUTH_SESSION_TOKEN_KEY);
      cachedSessionToken = stored;
      return stored;
    }
    const stored = await AsyncStorage.getItem(AUTH_SESSION_TOKEN_KEY);
    cachedSessionToken = stored;
    return stored;
  } catch (error) {
    logger.warn("セッショントークン読み込みエラー", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * ユーザー情報を永続化する（AsyncStorage、非機密情報）
 */
async function persistUser(user: AuthUser | null): Promise<void> {
  cachedUser = user;
  if (user) {
    await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    return;
  }
  await AsyncStorage.removeItem(AUTH_USER_KEY);
}

/**
 * セッショントークンをSecureStore（優先）またはAsyncStorageに永続化する
 */
async function persistSessionToken(token: string | null): Promise<void> {
  cachedSessionToken = token;
  try {
    const store = getSecureStore();
    if (store) {
      if (token) {
        await store.setItemAsync(AUTH_SESSION_TOKEN_KEY, token);
      } else {
        await store.deleteItemAsync(AUTH_SESSION_TOKEN_KEY);
      }
      return;
    }
  } catch (error) {
    logger.warn("SecureStoreへのトークン保存に失敗、AsyncStorageにフォールバック", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  // 本番環境では平文ストレージへのフォールバックを警告
  if (!__DEV__) {
    logger.warn("セッショントークンがAsyncStorage（非暗号化）に保存されます");
  }
  if (token) {
    await AsyncStorage.setItem(AUTH_SESSION_TOKEN_KEY, token);
    return;
  }
  await AsyncStorage.removeItem(AUTH_SESSION_TOKEN_KEY);
}

/**
 * メールアドレスでログインする
 *
 * @returns 認証成功時はユーザー情報、失敗時はnull
 */
export async function signInWithEmail(params: EmailLoginParams): Promise<AuthUser | null> {
  const client = getAuthClient();
  if (!client) {
    logger.warn("認証サーバーが未設定のためログインできません");
    return null;
  }

  try {
    const result = await client.signIn.email({
      email: params.email,
      password: params.password,
    });

    if (!result.data?.user) {
      logger.warn("ログイン失敗: ユーザー情報が取得できませんでした");
      return null;
    }

    const user: AuthUser = {
      id: result.data.user.id,
      email: result.data.user.email,
      name: result.data.user.name,
      image: result.data.user.image ?? null,
    };

    await persistSessionToken(result.data.token);
    await persistUser(user);
    logger.info("メールログイン成功", { userId: user.id });
    return user;
  } catch (error) {
    logger.error("メールログインエラー", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error instanceof Error ? error : new Error(String(error));
  }
}

/**
 * メールアドレスで新規登録する
 *
 * @returns 登録成功時はユーザー情報、失敗時はnull
 */
export async function signUpWithEmail(params: EmailSignUpParams): Promise<AuthUser | null> {
  const client = getAuthClient();
  if (!client) {
    logger.warn("認証サーバーが未設定のため登録できません");
    return null;
  }

  try {
    const result = await client.signUp.email({
      email: params.email,
      password: params.password,
      name: params.name,
    });

    if (!result.data?.user) {
      logger.warn("登録失敗: ユーザー情報が取得できませんでした");
      return null;
    }

    const user: AuthUser = {
      id: result.data.user.id,
      email: result.data.user.email,
      name: result.data.user.name,
      image: result.data.user.image ?? null,
    };

    await persistSessionToken(result.data.token);
    await persistUser(user);
    logger.info("メール登録成功", { userId: user.id });
    return user;
  } catch (error) {
    logger.error("メール登録エラー", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error instanceof Error ? error : new Error(String(error));
  }
}

/**
 * ソーシャルプロバイダーでログインする
 *
 * Google: expo-web-browserでBetter Auth OAuthフローを開く
 * Apple: expo-apple-authenticationでネイティブSign Inを使用
 *
 * @returns 認証成功時はユーザー情報、失敗時はnull
 */
export async function signInWithSocial(provider: SocialProvider): Promise<AuthUser | null> {
  if (provider === "apple" && Platform.OS === "ios") {
    return signInWithAppleNative();
  }
  return signInWithOAuthBrowser(provider);
}

/**
 * OAuthブラウザフローでソーシャルログインする
 *
 * Better AuthサーバーのOAuthエンドポイントをブラウザで開き、
 * コールバックURLでアプリに戻る。セッショントークンをURLから取得し、
 * サーバーからユーザー情報を取得する。
 */
async function signInWithOAuthBrowser(provider: SocialProvider): Promise<AuthUser | null> {
  const authUrl = getAuthUrl();
  if (!authUrl) {
    logger.warn("認証サーバーが未設定のためOAuthログインできません");
    return null;
  }

  try {
    const signInUrl = `${authUrl}/api/auth/sign-in/social?provider=${provider}&callbackURL=${encodeURIComponent(CALLBACK_URL)}`;

    const WebBrowser = await import("expo-web-browser");
    const result = await WebBrowser.openAuthSessionAsync(signInUrl, CALLBACK_URL);

    if (result.type !== "success") {
      logger.info("OAuthログインがキャンセルされました", { provider, type: result.type });
      return null;
    }

    const url = new URL(result.url);
    const sessionToken = url.searchParams.get("session_token") ?? url.hash?.replace("#session_token=", "");

    if (!sessionToken) {
      return fetchSessionAfterCallback(authUrl);
    }

    await persistSessionToken(sessionToken);
    return fetchUserFromSession(authUrl, sessionToken);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Cannot find native module")) {
      logger.error("Google/Appleログインにはdevelopment buildが必要です", { provider });
      throw new Error("Google/Appleログインにはdevelopment buildが必要です。Expo Goでは利用できません。");
    }
    logger.error("OAuthブラウザログインエラー", { provider, error: message });
    return null;
  }
}

/**
 * OAuthコールバック後にセッションを取得する
 *
 * Better Authがコールバック時にCookieベースでセッションを設定する場合、
 * トークンがURLパラメータに含まれないことがある。
 * その場合はBetter Authクライアント経由でセッションを取得する。
 */
async function fetchSessionAfterCallback(authUrl: string): Promise<AuthUser | null> {
  const client = getAuthClient();
  if (!client) return null;

  try {
    const sessionToken = await getStoredSessionToken();
    const session = await client.getSession(sessionToken ?? undefined);

    if (!session?.user) {
      logger.warn("OAuthコールバック後のセッション取得に失敗しました");
      return null;
    }

    const user: AuthUser = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image ?? null,
    };

    await persistUser(user);
    logger.info("OAuthセッション取得成功", { userId: user.id });
    return user;
  } catch (error) {
    logger.error("OAuthセッション取得エラー", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * セッショントークンを使ってユーザー情報をサーバーから取得する
 */
async function fetchUserFromSession(authUrl: string, sessionToken: string): Promise<AuthUser | null> {
  try {
    const response = await fetch(`${authUrl}/api/auth/get-session`, {
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    });

    if (!response.ok) {
      logger.warn("セッショントークンでのユーザー取得に失敗しました", { status: response.status });
      return null;
    }

    const data = await response.json() as { user?: { id: string; email: string; name: string | null; image?: string | null } };

    if (!data.user) {
      logger.warn("セッションレスポンスにユーザー情報がありません");
      return null;
    }

    const user: AuthUser = {
      id: data.user.id,
      email: data.user.email,
      name: data.user.name,
      image: data.user.image ?? null,
    };

    await persistUser(user);
    logger.info("セッショントークンによるユーザー取得成功", { userId: user.id });
    return user;
  } catch (error) {
    logger.error("セッショントークンによるユーザー取得エラー", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Apple Sign In（ネイティブ）でログインする
 *
 * expo-apple-authenticationを使用してネイティブのApple Sign Inダイアログを表示し、
 * 取得したidentityTokenをBetter Authサーバーに送信してユーザーを認証する。
 */
async function signInWithAppleNative(): Promise<AuthUser | null> {
  const authUrl = getAuthUrl();
  if (!authUrl) {
    logger.warn("認証サーバーが未設定のためAppleログインできません");
    return null;
  }

  try {
    const AppleAuthentication = await import("expo-apple-authentication");
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      logger.warn("Apple Sign In: identityTokenが取得できませんでした");
      return null;
    }

    const fullName = credential.fullName
      ? [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean).join(" ")
      : null;

    const response = await fetch(`${authUrl}/api/auth/sign-in/social`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "apple",
        idToken: {
          token: credential.identityToken,
          nonce: undefined,
        },
        user: fullName ? { name: fullName } : undefined,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      logger.error("Apple Sign In サーバー認証失敗", { status: response.status, errorText });
      return null;
    }

    const data = await response.json() as {
      user?: { id: string; email: string; name: string | null; image?: string | null };
      session?: { token?: string };
      token?: string;
    };

    if (!data.user) {
      logger.warn("Apple Sign In: サーバーレスポンスにユーザー情報がありません");
      return null;
    }

    const sessionToken = data.session?.token ?? data.token;
    if (sessionToken) {
      await persistSessionToken(sessionToken);
    }

    const user: AuthUser = {
      id: data.user.id,
      email: data.user.email,
      name: data.user.name ?? fullName,
      image: data.user.image ?? null,
    };

    await persistUser(user);
    logger.info("Apple Sign In成功", { userId: user.id });
    return user;
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      const appleError = error as Error & { code: string };
      if (appleError.code === "ERR_REQUEST_CANCELED") {
        logger.info("Apple Sign Inがキャンセルされました");
        return null;
      }
    }
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Cannot find native module")) {
      logger.error("Apple Sign InにはDevelopment Buildが必要です");
      throw new Error("Apple Sign InにはDevelopment Buildが必要です。Expo Goでは利用できません。");
    }
    logger.error("Apple Sign Inエラー", { error: message });
    return null;
  }
}

/**
 * ログアウトする
 */
export async function signOut(): Promise<void> {
  const client = getAuthClient();
  const sessionToken = await getStoredSessionToken();

  try {
    if (client) {
      await client.signOut(sessionToken ?? undefined);
    }
  } catch (error) {
    logger.warn("サーバー側ログアウトエラー", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  await persistUser(null);
  await persistSessionToken(null);
  logger.info("ログアウト完了");
}

/**
 * 認証済みかどうかを判定する
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getStoredUser();
  return user !== null;
}
