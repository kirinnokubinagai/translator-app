/**
 * クォータ口座の統合テスト
 *
 * quota.ts からエクスポートされた本物の関数を、
 * libsql Client のインメモリモックで直接テストする。
 */
import {
  type QuotaRow,
  INITIAL_QUOTA,
  getQuotaByUserId,
  initQuota,
  consumeQuota,
  addQuota,
  resolveQuotaUserId,
  initializeQuota,
} from "./quota";
import type { Client, ResultSet, Row } from "@libsql/client";

/** インメモリ行ストア */
type StoredRow = QuotaRow & Record<string, unknown>;

/**
 * libsql Client のインメモリモック
 *
 * INSERT / UPDATE / DELETE / SELECT を簡易パースして
 * Map ベースの行ストアで処理する。
 */
function createMockDb(): Client {
  const rows = new Map<string, StoredRow>();

  function makeResultSet(matchedRows: StoredRow[], affected = 0): ResultSet {
    return {
      rows: matchedRows as unknown as Row[],
      columns: [],
      columnTypes: [],
      rowsAffected: affected,
      lastInsertRowid: undefined,
      toJSON: () => ({}),
    };
  }

  const db: Partial<Client> = {
    execute: async (stmtOrSql: unknown) => {
      const stmt = stmtOrSql as { sql: string; args: unknown[] };
      const sql = stmt.sql.replace(/\s+/g, " ").trim();
      const args = stmt.args ?? [];

      // CREATE TABLE — no-op
      if (sql.startsWith("CREATE TABLE")) {
        return makeResultSet([]);
      }

      // ALTER TABLE — no-op
      if (sql.startsWith("ALTER TABLE")) {
        return makeResultSet([]);
      }

      // INSERT INTO quotas
      if (sql.includes("INSERT INTO quotas")) {
        const userId = args[0] as string;
        const balance = args[1] as number;
        if (!rows.has(userId)) {
          rows.set(userId, {
            user_id: userId,
            balance,
            total_purchased: 0,
            total_earned_by_ad: 0,
            total_consumed: 0,
            ad_reward_count: 0,
            ad_reward_date: "",
            auth_user_id: null,
          });
        }
        return makeResultSet([], 1);
      }

      // DELETE FROM quotas WHERE user_id = ?
      if (sql.includes("DELETE FROM quotas")) {
        const userId = args[0] as string;
        const deleted = rows.has(userId) ? 1 : 0;
        rows.delete(userId);
        return makeResultSet([], deleted);
      }

      // UPDATE quotas SET balance = balance - ?, total_consumed ... WHERE user_id = ? AND balance >= ?
      if (sql.includes("balance = balance -") && sql.includes("total_consumed")) {
        const cost = args[0] as number;
        const userId = args[2] as string;
        const row = rows.get(userId);
        if (!row || row.balance < cost) {
          return makeResultSet([], 0);
        }
        row.balance -= cost;
        row.total_consumed += cost;
        return makeResultSet([], 1);
      }

      // UPDATE quotas SET balance = balance + ? (addQuota)
      if (sql.includes("balance = balance +") && (sql.includes("total_purchased") || sql.includes("total_earned_by_ad"))) {
        const amount = args[0] as number;
        const userId = args[2] as string;
        const row = rows.get(userId);
        if (!row) return makeResultSet([], 0);
        row.balance += amount;
        if (sql.includes("total_purchased")) row.total_purchased += amount;
        if (sql.includes("total_earned_by_ad")) row.total_earned_by_ad += amount;
        return makeResultSet([], 1);
      }

      // UPDATE quotas SET total_purchased = ?, total_earned_by_ad = ?, total_consumed = ?, auth_user_id = ?
      if (sql.includes("total_purchased = ?") && sql.includes("total_earned_by_ad = ?") && sql.includes("total_consumed = ?")) {
        const totalPurchased = args[0] as number;
        const totalEarnedByAd = args[1] as number;
        const totalConsumed = args[2] as number;
        const authUserId = args[3] as string;
        const userId = args[4] as string;
        const row = rows.get(userId);
        if (row) {
          row.total_purchased = totalPurchased;
          row.total_earned_by_ad = totalEarnedByAd;
          row.total_consumed = totalConsumed;
          row.auth_user_id = authUserId;
        }
        return makeResultSet([], row ? 1 : 0);
      }

      // UPDATE quotas SET auth_user_id = ? ... WHERE user_id = ?
      if (sql.includes("auth_user_id = ?") && !sql.includes("total_purchased")) {
        const authUserId = args[0] as string;
        const userId = args[1] as string;
        const row = rows.get(userId);
        if (row) row.auth_user_id = authUserId;
        return makeResultSet([], row ? 1 : 0);
      }

      // SELECT * FROM quotas WHERE user_id = ?
      if (sql.includes("SELECT * FROM quotas") || sql.includes("SELECT *  FROM quotas")) {
        const userId = args[0] as string;
        const row = rows.get(userId);
        return makeResultSet(row ? [row] : []);
      }

      // SELECT balance FROM quotas WHERE user_id = ?
      if (sql.includes("SELECT balance FROM quotas")) {
        const userId = args[0] as string;
        const row = rows.get(userId);
        return makeResultSet(row ? [{ balance: row.balance } as unknown as StoredRow] : []);
      }

      // SELECT auth_user_id FROM quotas WHERE user_id = ?
      if (sql.includes("SELECT auth_user_id FROM quotas")) {
        const userId = args[0] as string;
        const row = rows.get(userId);
        return makeResultSet(row ? [{ auth_user_id: row.auth_user_id } as unknown as StoredRow] : []);
      }

      return makeResultSet([]);
    },
  };

  return db as Client;
}

describe("initializeQuota: 未ログイン端末", () => {
  it("初回初期化でINITIAL_QUOTAが設定されること", async () => {
    const db = createMockDb();
    const result = await initializeQuota(db, "device-A", null);
    expect(result.balance).toBe(INITIAL_QUOTA);
    expect(result.isNew).toBe(true);
  });

  it("2回目の初期化では既存残高が返ること", async () => {
    const db = createMockDb();
    await initializeQuota(db, "device-A", null);
    await consumeQuota(db, "device-A", 5);
    const result = await initializeQuota(db, "device-A", null);
    expect(result.balance).toBe(INITIAL_QUOTA - 5);
    expect(result.isNew).toBe(false);
  });
});

describe("initializeQuota: ログイン移行", () => {
  it("未ログインデバイスにログインするとアカウント口座に移行すること", async () => {
    const db = createMockDb();
    await initializeQuota(db, "device-A", null);
    await addQuota(db, "device-A", 100, "purchase");
    await consumeQuota(db, "device-A", 30);

    const result = await initializeQuota(db, "device-A", "user-1");
    expect(result.balance).toBe(INITIAL_QUOTA + 100 - 30);
    expect(result.isNew).toBe(false);

    // 旧デバイス口座は削除
    const old = await getQuotaByUserId(db, "device-A");
    expect(old).toBeNull();

    // アカウント口座が存在
    const account = await getQuotaByUserId(db, "user-1");
    expect(account).not.toBeNull();
    expect(account!.balance).toBe(INITIAL_QUOTA + 100 - 30);
    expect(account!.total_purchased).toBe(100);
    expect(account!.total_consumed).toBe(30);
  });

  it("既にアカウント口座がある場合はそちらの残高を返すこと", async () => {
    const db = createMockDb();
    await initializeQuota(db, "device-A", null);
    await initializeQuota(db, "device-A", "user-1");
    await addQuota(db, "user-1", 200, "purchase");

    const result = await initializeQuota(db, "device-B", "user-1");
    expect(result.balance).toBe(INITIAL_QUOTA + 200);
    expect(result.isNew).toBe(false);
  });
});

describe("resolveQuotaUserId", () => {
  it("authUserIdがある場合はそれを返すこと", async () => {
    const db = createMockDb();
    await initializeQuota(db, "device-A", null);
    const uid = await resolveQuotaUserId(db, "device-A", "user-1");
    expect(uid).toBe("user-1");
  });

  it("DBにauth_user_idが紐付いていればヘッダーなしでもそれを返すこと", async () => {
    const db = createMockDb();
    // デバイス口座を作成し、手動でauth_user_idを紐付ける
    await initializeQuota(db, "device-A", null);
    const row = await getQuotaByUserId(db, "device-A");
    expect(row).not.toBeNull();
    // auth_user_id を直接設定（ログイン後にinitializeQuotaで移行せず紐付けだけされたケース）
    await db.execute({
      sql: "UPDATE quotas SET auth_user_id = ? WHERE user_id = ?",
      args: ["user-1", "device-A"],
    });
    // ヘッダーなし（null）でもauth_user_idが返る
    const uid = await resolveQuotaUserId(db, "device-A", null);
    expect(uid).toBe("user-1");
  });

  it("紐付けがないデバイスではdeviceIdを返すこと", async () => {
    const db = createMockDb();
    await initializeQuota(db, "device-B", null);
    const uid = await resolveQuotaUserId(db, "device-B", null);
    expect(uid).toBe("device-B");
  });

  it("何もなければdeviceIdを返すこと", async () => {
    const db = createMockDb();
    await initializeQuota(db, "device-A", null);
    const uid = await resolveQuotaUserId(db, "device-A", null);
    expect(uid).toBe("device-A");
  });
});

describe("複数端末の残高統一", () => {
  it("ログイン済みの複数端末が同じ残高を参照すること", async () => {
    const db = createMockDb();
    await initializeQuota(db, "device-A", "user-1");
    await addQuota(db, "user-1", 100, "purchase");

    // 端末Bから同じアカウント
    const resultB = await initializeQuota(db, "device-B", "user-1");
    expect(resultB.balance).toBe(INITIAL_QUOTA + 100);

    // 消費
    await consumeQuota(db, "user-1", 10);

    // 端末Aからも反映
    const resultA = await initializeQuota(db, "device-A", "user-1");
    expect(resultA.balance).toBe(INITIAL_QUOTA + 100 - 10);
  });
});

describe("addQuota", () => {
  it("購入加算が正しく動作すること", async () => {
    const db = createMockDb();
    await initializeQuota(db, "device-A", "user-1");
    const newBalance = await addQuota(db, "user-1", 50, "purchase");
    expect(newBalance).toBe(INITIAL_QUOTA + 50);

    const row = await getQuotaByUserId(db, "user-1");
    expect(row!.total_purchased).toBe(50);
  });

  it("広告報酬加算が正しく動作すること", async () => {
    const db = createMockDb();
    await initializeQuota(db, "device-A", null);
    const newBalance = await addQuota(db, "device-A", 3, "ad_reward");
    expect(newBalance).toBe(INITIAL_QUOTA + 3);

    const row = await getQuotaByUserId(db, "device-A");
    expect(row!.total_earned_by_ad).toBe(3);
  });
});

describe("consumeQuota", () => {
  it("残高不足で消費が失敗すること", async () => {
    const db = createMockDb();
    await initializeQuota(db, "device-A", null);
    const success = await consumeQuota(db, "device-A", INITIAL_QUOTA + 1);
    expect(success).toBe(false);
  });

  it("残高ちょうどで消費が成功すること", async () => {
    const db = createMockDb();
    await initializeQuota(db, "device-A", null);
    const success = await consumeQuota(db, "device-A", INITIAL_QUOTA);
    expect(success).toBe(true);
    const row = await getQuotaByUserId(db, "device-A");
    expect(row!.balance).toBe(0);
  });

  it("複数回購入+消費で残高が正しいこと", async () => {
    const db = createMockDb();
    await initializeQuota(db, "device-A", "user-1");
    await addQuota(db, "user-1", 50, "purchase");
    await addQuota(db, "user-1", 100, "purchase");
    await consumeQuota(db, "user-1", 20);

    const row = await getQuotaByUserId(db, "user-1");
    expect(row!.balance).toBe(INITIAL_QUOTA + 50 + 100 - 20);
    expect(row!.total_purchased).toBe(150);
    expect(row!.total_consumed).toBe(20);
  });
});
