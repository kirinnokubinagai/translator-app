/**
 * スキーママイグレーション管理
 *
 * バージョン番号付きのマイグレーションを管理し、
 * 冪等に実行できるスキーマ変更システムを提供する。
 */
import type { Client } from "@libsql/client";

/** マイグレーション定義 */
type Migration = {
  version: number;
  description: string;
  up: (db: Client) => Promise<void>;
};

/**
 * schema_migrations テーブルを作成する（存在しない場合のみ）
 */
async function ensureMigrationsTable(db: Client): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

/**
 * 適用済みの最新バージョンを取得する
 */
async function getLatestVersion(db: Client): Promise<number> {
  const result = await db.execute(
    "SELECT MAX(version) as max_version FROM schema_migrations"
  );
  const row = result.rows[0] as unknown as { max_version: number | null };
  return row.max_version ?? 0;
}

/**
 * マイグレーションを適用済みとして記録する
 */
async function recordMigration(db: Client, version: number, description: string): Promise<void> {
  await db.execute({
    sql: "INSERT INTO schema_migrations (version, description) VALUES (?, ?)",
    args: [version, description],
  });
}

/** 全マイグレーション定義 */
const migrations: Migration[] = [
  {
    version: 1,
    description: "quotasテーブル作成",
    up: async (db) => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS quotas (
          user_id TEXT PRIMARY KEY,
          balance INTEGER NOT NULL DEFAULT 0,
          total_purchased INTEGER NOT NULL DEFAULT 0,
          total_earned_by_ad INTEGER NOT NULL DEFAULT 0,
          total_consumed INTEGER NOT NULL DEFAULT 0,
          ad_reward_count INTEGER NOT NULL DEFAULT 0,
          ad_reward_date TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
    },
  },
  {
    version: 2,
    description: "purchase_historyテーブル作成",
    up: async (db) => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS purchase_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          receipt_token TEXT,
          pack_id TEXT,
          amount INTEGER NOT NULL,
          type TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
    },
  },
  {
    version: 3,
    description: "ad_noncesテーブル作成",
    up: async (db) => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS ad_nonces (
          nonce TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          issued_at TEXT NOT NULL DEFAULT (datetime('now')),
          consumed_at TEXT DEFAULT NULL
        )
      `);
    },
  },
  {
    version: 4,
    description: "quotasにauth_user_idカラム追加",
    up: async (db) => {
      await db.execute(
        "ALTER TABLE quotas ADD COLUMN auth_user_id TEXT DEFAULT NULL"
      ).catch(() => { /* カラム既存時は無視 */ });
    },
  },
  {
    version: 5,
    description: "purchase_historyにauth_user_idカラム追加",
    up: async (db) => {
      await db.execute(
        "ALTER TABLE purchase_history ADD COLUMN auth_user_id TEXT DEFAULT NULL"
      ).catch(() => { /* カラム既存時は無視 */ });
    },
  },
  {
    version: 6,
    description: "devicesテーブル作成",
    up: async (db) => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS devices (
          device_id TEXT PRIMARY KEY,
          secret_hash TEXT NOT NULL,
          hmac_key TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          last_used_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
    },
  },
  {
    version: 7,
    description: "rate_limitsテーブル作成",
    up: async (db) => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS rate_limits (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT NOT NULL,
          category TEXT NOT NULL DEFAULT 'api',
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
      await db.execute(
        "CREATE INDEX IF NOT EXISTS idx_rate_limits_key_cat ON rate_limits (key, category, created_at)"
      ).catch(() => { /* インデックス既存時は無視 */ });
    },
  },
  {
    version: 8,
    description: "metricsテーブル作成",
    up: async (db) => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          endpoint TEXT NOT NULL,
          method TEXT NOT NULL,
          status_code INTEGER NOT NULL,
          response_time_ms INTEGER NOT NULL,
          error_code TEXT DEFAULT NULL,
          quota_consumed INTEGER DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
      await db.execute(
        "CREATE INDEX IF NOT EXISTS idx_metrics_created_at ON metrics (created_at)"
      ).catch(() => { /* インデックス既存時は無視 */ });
      await db.execute(
        "CREATE INDEX IF NOT EXISTS idx_metrics_endpoint ON metrics (endpoint, created_at)"
      ).catch(() => { /* インデックス既存時は無視 */ });
    },
  },
];

/** スキーマ保証済みフラグ */
let schemaEnsured = false;

/**
 * 全マイグレーションを実行する
 *
 * 未適用のマイグレーションのみ順番に実行し、
 * schema_migrationsテーブルに記録する。
 */
export async function runMigrations(db: Client): Promise<void> {
  if (schemaEnsured) return;

  await ensureMigrationsTable(db);
  const currentVersion = await getLatestVersion(db);

  for (const migration of migrations) {
    if (migration.version <= currentVersion) continue;

    await migration.up(db);
    await recordMigration(db, migration.version, migration.description);
  }

  schemaEnsured = true;
}

/**
 * スキーマ保証済みフラグをリセットする（テスト用）
 */
export function resetMigrationState(): void {
  schemaEnsured = false;
}
