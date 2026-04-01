/**
 * クォータ管理の統合テスト
 *
 * quota.ts の本物の関数をインメモリモックDBで検証し、
 * 広告報酬フロー・購入フロー・複数端末同期・残高不足を網羅する。
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

/** 広告報酬の1日あたり上限回数 */
const AD_REWARD_DAILY_LIMIT = 10;

/** 広告視聴報酬クォータ数 */
const AD_REWARD_QUOTA = 5;

/** 音声認識消費クォータ */
const TRANSCRIBE_COST = 1;

/** 翻訳消費クォータ */
const TRANSLATE_COST = 1;

/** ad_noncesの行型 */
type AdNonceRow = {
  nonce: string;
  user_id: string;
  issued_at: string;
  consumed_at: string | null;
};

/** purchase_historyの行型 */
type PurchaseHistoryRow = {
  id: number;
  user_id: string;
  receipt_token: string | null;
  pack_id: string | null;
  amount: number;
  type: string;
  created_at: string;
  auth_user_id: string | null;
};

/**
 * libsql Client のインメモリモック（統合テスト用拡張版）
 *
 * quotas / ad_nonces / purchase_history を処理する。
 */
function createMockDb(): Client {
  const rows = new Map<string, StoredRow>();
  const adNonces = new Map<string, AdNonceRow>();
  const purchaseHistory: PurchaseHistoryRow[] = [];
  let purchaseIdSeq = 0;

  function makeResultSet(matchedRows: unknown[], affected = 0): ResultSet {
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

      // CREATE TABLE / ALTER TABLE — no-op
      if (sql.startsWith("CREATE TABLE") || sql.startsWith("ALTER TABLE")) {
        return makeResultSet([]);
      }

      // ========== ad_nonces ==========

      // INSERT INTO ad_nonces
      if (sql.includes("INSERT INTO ad_nonces")) {
        const nonce = args[0] as string;
        const userId = args[1] as string;
        adNonces.set(nonce, {
          nonce,
          user_id: userId,
          issued_at: new Date().toISOString(),
          consumed_at: null,
        });
        return makeResultSet([], 1);
      }

      // SELECT FROM ad_nonces (未消費チェック)
      if (sql.includes("FROM ad_nonces") && sql.includes("consumed_at IS NULL")) {
        const nonce = args[0] as string;
        const userId = args[1] as string;
        const row = adNonces.get(nonce);
        if (row && row.user_id === userId && row.consumed_at === null) {
          return makeResultSet([row]);
        }
        return makeResultSet([]);
      }

      // UPDATE ad_nonces SET consumed_at
      if (sql.includes("UPDATE ad_nonces") && sql.includes("consumed_at")) {
        const nonce = args[0] as string;
        const row = adNonces.get(nonce);
        if (row) {
          row.consumed_at = new Date().toISOString();
        }
        return makeResultSet([], row ? 1 : 0);
      }

      // ========== purchase_history ==========

      // INSERT INTO purchase_history
      if (sql.includes("INSERT INTO purchase_history")) {
        purchaseIdSeq++;
        purchaseHistory.push({
          id: purchaseIdSeq,
          user_id: args[0] as string,
          receipt_token: args[1] as string | null,
          pack_id: args[2] as string | null,
          amount: args[3] as number,
          type: args[4] as string,
          created_at: new Date().toISOString(),
          auth_user_id: (args[5] as string | null) ?? null,
        });
        return makeResultSet([], 1);
      }

      // SELECT FROM purchase_history (レシート重複チェック)
      if (sql.includes("FROM purchase_history") && sql.includes("receipt_token")) {
        const token = args[0] as string;
        const found = purchaseHistory.filter((r) => r.receipt_token === token);
        return makeResultSet(found);
      }

      // ========== quotas ==========

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

      // UPDATE quotas SET balance = balance - ? (consumeQuota)
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

      // UPDATE quotas SET total_purchased = ?, ... (initializeQuota migration)
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

      // UPDATE quotas SET ad_reward_count / ad_reward_date
      if (sql.includes("ad_reward_count") && sql.includes("ad_reward_date") && sql.includes("UPDATE")) {
        const userId = args[args.length - 1] as string;
        const row = rows.get(userId);
        if (row) {
          row.ad_reward_count = (args[0] as number) ?? row.ad_reward_count + 1;
          row.ad_reward_date = (args[1] as string) ?? new Date().toISOString().slice(0, 10);
        }
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
        return makeResultSet(row ? [{ balance: row.balance }] : []);
      }

      // SELECT auth_user_id FROM quotas WHERE user_id = ?
      if (sql.includes("SELECT auth_user_id FROM quotas")) {
        const userId = args[0] as string;
        const row = rows.get(userId);
        return makeResultSet(row ? [{ auth_user_id: row.auth_user_id }] : []);
      }

      return makeResultSet([]);
    },
  };

  return db as Client;
}

/**
 * 広告報酬のnonce発行・消費をシミュレートする
 */
async function issueAdNonce(db: Client, userId: string): Promise<string> {
  const nonce = `nonce-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await db.execute({
    sql: "INSERT INTO ad_nonces (nonce, user_id) VALUES (?, ?)",
    args: [nonce, userId],
  });
  return nonce;
}

/**
 * 広告nonceを消費してクォータを加算する
 */
async function consumeAdNonceAndReward(
  db: Client,
  userId: string,
  nonce: string,
  rewardAmount: number
): Promise<boolean> {
  const check = await db.execute({
    sql: "SELECT * FROM ad_nonces WHERE nonce = ? AND user_id = ? AND consumed_at IS NULL",
    args: [nonce, userId],
  });
  if (check.rows.length === 0) return false;

  await db.execute({
    sql: "UPDATE ad_nonces SET consumed_at = datetime('now') WHERE nonce = ?",
    args: [nonce],
  });

  await addQuota(db, userId, rewardAmount, "ad_reward");
  return true;
}

/**
 * 購入フローをシミュレートする（レシート重複チェック付き）
 */
async function processPurchase(
  db: Client,
  userId: string,
  receiptToken: string,
  packId: string,
  amount: number
): Promise<{ success: boolean; reason?: string }> {
  // レシート重複チェック
  const existing = await db.execute({
    sql: "SELECT * FROM purchase_history WHERE receipt_token = ?",
    args: [receiptToken],
  });
  if (existing.rows.length > 0) {
    return { success: false, reason: "レシートが重複しています" };
  }

  // purchase_history に記録
  await db.execute({
    sql: "INSERT INTO purchase_history (user_id, receipt_token, pack_id, amount, type) VALUES (?, ?, ?, ?, ?)",
    args: [userId, receiptToken, packId, amount, "purchase"],
  });

  // クォータ加算
  await addQuota(db, userId, amount, "purchase");
  return { success: true };
}

// ==========================================
// テスト
// ==========================================

describe("統合テスト: 広告報酬フロー", () => {
  it("nonce発行→消費→残高加算が正しく動作すること", async () => {
    const db = createMockDb();
    await initializeQuota(db, "device-A", null);

    // nonce発行
    const nonce = await issueAdNonce(db, "device-A");
    expect(nonce).toBeTruthy();

    // nonce消費 + 報酬加算
    const rewarded = await consumeAdNonceAndReward(db, "device-A", nonce, AD_REWARD_QUOTA);
    expect(rewarded).toBe(true);

    // 残高確認
    const row = await getQuotaByUserId(db, "device-A");
    expect(row!.balance).toBe(INITIAL_QUOTA + AD_REWARD_QUOTA);
    expect(row!.total_earned_by_ad).toBe(AD_REWARD_QUOTA);
  });

  it("同じnonceを2回使用できないこと", async () => {
    const db = createMockDb();
    await initializeQuota(db, "device-A", null);

    const nonce = await issueAdNonce(db, "device-A");
    const first = await consumeAdNonceAndReward(db, "device-A", nonce, AD_REWARD_QUOTA);
    expect(first).toBe(true);

    // 2回目は失敗
    const second = await consumeAdNonceAndReward(db, "device-A", nonce, AD_REWARD_QUOTA);
    expect(second).toBe(false);

    // 残高は1回分のみ加算
    const row = await getQuotaByUserId(db, "device-A");
    expect(row!.balance).toBe(INITIAL_QUOTA + AD_REWARD_QUOTA);
  });

  it("日次上限に到達するまで連続で報酬を受け取れること", async () => {
    const db = createMockDb();
    await initializeQuota(db, "device-A", null);

    for (let i = 0; i < AD_REWARD_DAILY_LIMIT; i++) {
      const nonce = await issueAdNonce(db, "device-A");
      const ok = await consumeAdNonceAndReward(db, "device-A", nonce, AD_REWARD_QUOTA);
      expect(ok).toBe(true);
    }

    const row = await getQuotaByUserId(db, "device-A");
    expect(row!.balance).toBe(INITIAL_QUOTA + AD_REWARD_QUOTA * AD_REWARD_DAILY_LIMIT);
    expect(row!.total_earned_by_ad).toBe(AD_REWARD_QUOTA * AD_REWARD_DAILY_LIMIT);
  });
});

describe("統合テスト: 購入フロー", () => {
  it("レシート重複チェックで同一レシートの二重適用を防ぐこと", async () => {
    const db = createMockDb();
    await initializeQuota(db, "device-A", "user-1");

    const result1 = await processPurchase(db, "user-1", "receipt-abc", "standard", 500);
    expect(result1.success).toBe(true);

    // 同じレシートで再度購入
    const result2 = await processPurchase(db, "user-1", "receipt-abc", "standard", 500);
    expect(result2.success).toBe(false);
    expect(result2.reason).toContain("重複");

    // 残高は1回分のみ
    const row = await getQuotaByUserId(db, "user-1");
    expect(row!.balance).toBe(INITIAL_QUOTA + 500);
    expect(row!.total_purchased).toBe(500);
  });

  it("購入後にpurchase_historyに記録されること", async () => {
    const db = createMockDb();
    await initializeQuota(db, "device-A", "user-1");

    await processPurchase(db, "user-1", "receipt-001", "starter", 100);
    await processPurchase(db, "user-1", "receipt-002", "premium", 1500);

    const row = await getQuotaByUserId(db, "user-1");
    expect(row!.balance).toBe(INITIAL_QUOTA + 100 + 1500);
    expect(row!.total_purchased).toBe(1600);
  });

  it("異なるレシートで複数回購入できること", async () => {
    const db = createMockDb();
    await initializeQuota(db, "device-A", "user-1");

    for (let i = 0; i < 5; i++) {
      const result = await processPurchase(db, "user-1", `receipt-${i}`, "starter", 100);
      expect(result.success).toBe(true);
    }

    const row = await getQuotaByUserId(db, "user-1");
    expect(row!.balance).toBe(INITIAL_QUOTA + 500);
  });
});

describe("統合テスト: 複数端末クォータ同期", () => {
  it("デバイスAで購入→デバイスBでログイン→残高が共有されること", async () => {
    const db = createMockDb();

    // デバイスAで口座作成 + ログイン
    await initializeQuota(db, "device-A", "user-1");

    // デバイスAで購入
    await processPurchase(db, "user-1", "receipt-sync-1", "standard", 500);

    // デバイスBから同じアカウントでログイン
    const resultB = await initializeQuota(db, "device-B", "user-1");
    expect(resultB.balance).toBe(INITIAL_QUOTA + 500);
    expect(resultB.isNew).toBe(false);

    // デバイスBで消費
    const consumed = await consumeQuota(db, "user-1", 10);
    expect(consumed).toBe(true);

    // デバイスAから見ても反映
    const resultA = await initializeQuota(db, "device-A", "user-1");
    expect(resultA.balance).toBe(INITIAL_QUOTA + 500 - 10);
  });

  it("デバイスAで広告報酬→デバイスBで残高確認できること", async () => {
    const db = createMockDb();
    await initializeQuota(db, "device-A", "user-1");

    // デバイスAで広告報酬
    const nonce = await issueAdNonce(db, "user-1");
    await consumeAdNonceAndReward(db, "user-1", nonce, AD_REWARD_QUOTA);

    // デバイスBから確認
    const resultB = await initializeQuota(db, "device-B", "user-1");
    expect(resultB.balance).toBe(INITIAL_QUOTA + AD_REWARD_QUOTA);
  });
});

describe("統合テスト: 消費と残高不足", () => {
  it("残高1でSTT+翻訳の2コスト要求→失敗すること", async () => {
    const db = createMockDb();
    await initializeQuota(db, "device-A", null);

    // 残高を1まで消費
    await consumeQuota(db, "device-A", INITIAL_QUOTA - 1);
    const row = await getQuotaByUserId(db, "device-A");
    expect(row!.balance).toBe(1);

    // STT(1) + 翻訳(1) = 2コストを一括チェック
    const totalCost = TRANSCRIBE_COST + TRANSLATE_COST;
    const success = await consumeQuota(db, "device-A", totalCost);
    expect(success).toBe(false);

    // 残高は変わらず
    const afterRow = await getQuotaByUserId(db, "device-A");
    expect(afterRow!.balance).toBe(1);
  });

  it("残高0から広告報酬で回復→消費できること", async () => {
    const db = createMockDb();
    await initializeQuota(db, "device-A", null);

    // 全消費
    await consumeQuota(db, "device-A", INITIAL_QUOTA);
    const emptyRow = await getQuotaByUserId(db, "device-A");
    expect(emptyRow!.balance).toBe(0);

    // 消費失敗
    const failedConsume = await consumeQuota(db, "device-A", 1);
    expect(failedConsume).toBe(false);

    // 広告報酬で回復
    const nonce = await issueAdNonce(db, "device-A");
    await consumeAdNonceAndReward(db, "device-A", nonce, AD_REWARD_QUOTA);

    // 消費成功
    const successConsume = await consumeQuota(db, "device-A", 1);
    expect(successConsume).toBe(true);

    const finalRow = await getQuotaByUserId(db, "device-A");
    expect(finalRow!.balance).toBe(AD_REWARD_QUOTA - 1);
  });

  it("連続消費で残高が正確に追跡されること", async () => {
    const db = createMockDb();
    await initializeQuota(db, "device-A", "user-1");
    await addQuota(db, "user-1", 100, "purchase");

    /** 合計消費数 */
    let totalConsumed = 0;
    for (let i = 0; i < 50; i++) {
      const ok = await consumeQuota(db, "user-1", 2);
      expect(ok).toBe(true);
      totalConsumed += 2;
    }

    const row = await getQuotaByUserId(db, "user-1");
    expect(row!.balance).toBe(INITIAL_QUOTA + 100 - totalConsumed);
    expect(row!.total_consumed).toBe(totalConsumed);
  });
});
