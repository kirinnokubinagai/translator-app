/**
 * Better Auth サーバー設定
 *
 * Turso (libsql) + Drizzle ORM をデータベースとして使用し、
 * メール/パスワード認証およびソーシャルログイン（Apple/Google）を提供する。
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";

import type { Env } from "./types";
import * as schema from "./schema";

/** PBKDF2イテレーション回数 */
export const PBKDF2_ITERATIONS = 100000;

/**
 * Web Crypto APIを使ったPBKDF2パスワードハッシュ（Workers環境で高速）
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const hash = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, "0")).join("");
  const hashHex = Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `pbkdf2:${PBKDF2_ITERATIONS}:${saltHex}:${hashHex}`;
}

/**
 * 2つのHex文字列をタイミングセーフに比較する
 *
 * 文字列比較は一致しない文字が見つかった時点で早期リターンするため、
 * タイミングサイドチャネル攻撃に脆弱。全バイトを必ず比較して回避する。
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) {
    diff |= bufA[i] ^ bufB[i];
  }
  return diff === 0;
}

/**
 * PBKDF2パスワード検証（タイミングセーフ比較）
 */
export async function verifyPassword(params: { hash: string; password: string }): Promise<boolean> {
  const parts = params.hash.split(":");
  if (parts[0] !== "pbkdf2" || parts.length !== 4) return false;
  const iterations = parseInt(parts[1], 10);
  const saltMatch = parts[2].match(/.{2}/g);
  if (!saltMatch) return false;
  const salt = new Uint8Array(saltMatch.map((b) => parseInt(b, 16)));
  const storedHash = parts[3];
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(params.password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const hash = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    256,
  );
  const hashHex = Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return timingSafeEqual(hashHex, storedHash);
}

/**
 * Better Auth インスタンスを生成する
 *
 * リクエストごとに新規インスタンスを生成する。
 * baseURLはリクエストURLから動的に取得するため、
 * キャッシュすると最初のリクエストのURLに固定されてしまう問題を回避する。
 *
 * @param env - Cloudflare Worker の環境変数バインディング
 * @param requestUrl - リクエストURLからbaseURLを動的に取得
 * @returns Better Auth インスタンス
 */
export function createAuth(env: Env, requestUrl?: string) {
  const baseURL = requestUrl ? new URL(requestUrl).origin : undefined;

  const client = createClient({
    url: env.TURSO_DB_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });

  const db = drizzle(client, { schema });

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        ...schema,
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
      },
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL,
    basePath: "/api/auth",
    emailAndPassword: {
      enabled: true,
      password: {
        hash: hashPassword,
        verify: verifyPassword,
      },
    },
    socialProviders: {
      apple: {
        clientId: env.APPLE_CLIENT_ID,
        clientSecret: env.APPLE_CLIENT_SECRET,
      },
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },
    trustedOrigins: ["translator-app://"],
  });
}
