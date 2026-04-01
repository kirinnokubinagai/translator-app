/**
 * クォータ管理の純粋関数群
 *
 * libsql の Client インターフェースに依存するが、
 * Worker 固有の環境変数やHTTPレスポンスには依存しない。
 */
import type { Client } from "@libsql/client";

/** クォータ行の型 */
export type QuotaRow = {
  user_id: string;
  balance: number;
  total_purchased: number;
  total_earned_by_ad: number;
  total_consumed: number;
  ad_reward_count: number;
  ad_reward_date: string;
  auth_user_id: string | null;
};

/** 初期クォータ量 */
/** 初期クォータ数（アカウントにつき20回分） */
export const INITIAL_QUOTA = 20;

/**
 * ユーザーIDでクォータ行を取得する
 */
export async function getQuotaByUserId(db: Client, userId: string): Promise<QuotaRow | null> {
  const result = await db.execute({
    sql: "SELECT * FROM quotas WHERE user_id = ?",
    args: [userId],
  });
  if (result.rows.length === 0) return null;
  return result.rows[0] as unknown as QuotaRow;
}

/**
 * クォータを初期化する（既存の場合はスキップ）
 */
export async function initQuota(db: Client, userId: string, initialBalance: number): Promise<void> {
  await db.execute({
    sql: `INSERT INTO quotas (user_id, balance) VALUES (?, ?)
          ON CONFLICT (user_id) DO NOTHING`,
    args: [userId, initialBalance],
  });
}

/**
 * クォータを消費する（残高が足りない場合は失敗）
 */
export async function consumeQuota(db: Client, userId: string, cost: number): Promise<boolean> {
  const result = await db.execute({
    sql: `UPDATE quotas SET balance = balance - ?, total_consumed = total_consumed + ?, updated_at = datetime('now')
          WHERE user_id = ? AND balance >= ?`,
    args: [cost, cost, userId, cost],
  });
  return result.rowsAffected > 0;
}

/**
 * クォータを加算する（購入または広告報酬）
 */
export async function addQuota(
  db: Client,
  userId: string,
  amount: number,
  type: "purchase" | "ad_reward"
): Promise<number> {
  const column = type === "purchase" ? "total_purchased" : "total_earned_by_ad";
  await db.execute({
    sql: `UPDATE quotas SET balance = balance + ?, ${column} = ${column} + ?, updated_at = datetime('now')
          WHERE user_id = ?`,
    args: [amount, amount, userId],
  });
  const result = await db.execute({
    sql: "SELECT balance FROM quotas WHERE user_id = ?",
    args: [userId],
  });
  return (result.rows[0] as unknown as { balance: number }).balance;
}

/**
 * クォータ操作に使う実効ユーザーIDを解決する
 *
 * ログイン済み（authUserId あり）ならアカウントIDを返す。
 * 未ログインならデバイスIDを返す。
 */
export async function resolveQuotaUserId(
  db: Client,
  deviceId: string,
  authUserId: string | null
): Promise<string> {
  if (authUserId) return authUserId;

  const row = await db.execute({
    sql: "SELECT auth_user_id FROM quotas WHERE user_id = ?",
    args: [deviceId],
  });
  const storedAuthUserId = row.rows[0]?.auth_user_id as string | null;
  if (storedAuthUserId) return storedAuthUserId;

  return deviceId;
}

/**
 * クォータ初期化ロジック（ログイン有無に応じた口座管理）
 *
 * - ログイン済み + アカウント口座あり → 既存口座を返す
 * - ログイン済み + デバイス口座あり → アカウント口座に移行
 * - ログイン済み + どちらもなし → 新規アカウント口座
 * - 未ログイン + デバイス口座あり → 既存口座を返す
 * - 未ログイン + なし → 新規デバイス口座
 */
export async function initializeQuota(
  db: Client,
  deviceId: string,
  authUserId: string | null
): Promise<{ balance: number; isNew: boolean }> {
  if (authUserId) {
    const accountQuota = await getQuotaByUserId(db, authUserId);
    if (accountQuota) {
      return { balance: accountQuota.balance, isNew: false };
    }

    const deviceQuota = await getQuotaByUserId(db, deviceId);
    if (deviceQuota) {
      // デバイス口座をアカウント口座に移行
      await initQuota(db, authUserId, deviceQuota.balance);
      await db.execute({
        sql: `UPDATE quotas SET
                total_purchased = ?, total_earned_by_ad = ?, total_consumed = ?,
                auth_user_id = ?, updated_at = datetime('now')
              WHERE user_id = ?`,
        args: [
          deviceQuota.total_purchased, deviceQuota.total_earned_by_ad, deviceQuota.total_consumed,
          authUserId, authUserId,
        ],
      });
      // 旧デバイス口座を削除
      await db.execute({
        sql: "DELETE FROM quotas WHERE user_id = ?",
        args: [deviceId],
      });
      return { balance: deviceQuota.balance, isNew: false };
    }

    // 新規アカウント口座
    await initQuota(db, authUserId, INITIAL_QUOTA);
    await db.execute({
      sql: "UPDATE quotas SET auth_user_id = ?, updated_at = datetime('now') WHERE user_id = ?",
      args: [authUserId, authUserId],
    });
    return { balance: INITIAL_QUOTA, isNew: true };
  }

  // 未ログイン
  const existing = await getQuotaByUserId(db, deviceId);
  if (existing) {
    return { balance: existing.balance, isNew: false };
  }

  await initQuota(db, deviceId, INITIAL_QUOTA);
  return { balance: INITIAL_QUOTA, isNew: true };
}
