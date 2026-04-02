import { logger } from "@/lib/logger";

/** 認証サーバーURL */
const AUTH_URL = process.env.EXPO_PUBLIC_AUTH_URL ?? "";

/**
 * 認証サーバーURLを取得する
 */
export function getAuthUrl(): string {
  return AUTH_URL;
}

function createAuthHeaders(sessionToken?: string): Record<string, string> {
  return sessionToken
    ? {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      }
    : {
        "Content-Type": "application/json",
      };
}

type SignInEmailResult = {
  user: { id: string; email: string; name: string | null; image?: string | null };
  token: string;
  redirect?: boolean;
};

type SignUpEmailResult = {
  user: { id: string; email: string; name: string | null; image?: string | null };
  token: string;
};

/**
 * 軽量認証クライアント（better-authサーバーのREST APIをfetchで呼ぶ）
 */
export function getAuthClient() {
  if (!AUTH_URL) {
    logger.debug("認証サーバーURLが未設定");
    return null;
  }

  return {
    signIn: {
      /** メールログイン */
      email: async (params: { email: string; password: string }) => {
        const res = await fetch(`${AUTH_URL}/api/auth/sign-in/email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(err.message ?? "ログインに失敗しました");
        }
        const data = (await res.json()) as SignInEmailResult;
        return { data };
      },
    },
    signUp: {
      /** メール登録 */
      email: async (params: { email: string; password: string; name: string }) => {
        const res = await fetch(`${AUTH_URL}/api/auth/sign-up/email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(err.message ?? "登録に失敗しました");
        }
        const data = (await res.json()) as SignUpEmailResult;
        return { data };
      },
    },
    /** セッション取得 */
    getSession: async (sessionToken?: string) => {
      const res = await fetch(`${AUTH_URL}/api/auth/get-session`, {
        method: "GET",
        headers: createAuthHeaders(sessionToken),
      });
      if (!res.ok) return null;
      return (await res.json()) as {
        user: { id: string; email: string; name: string | null; image?: string | null };
      };
    },
    /** ログアウト */
    signOut: async (sessionToken?: string) => {
      await fetch(`${AUTH_URL}/api/auth/sign-out`, {
        method: "POST",
        headers: createAuthHeaders(sessionToken),
      });
    },
  };
}
