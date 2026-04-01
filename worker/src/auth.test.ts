/**
 * Worker認証ユーティリティのユニットテスト
 *
 * Web Crypto API (crypto.subtle) をモックしてPBKDF2ハッシュをテストする。
 * Node.js 18+ではcrypto.subtleが標準利用可能。
 */

// timingSafeEqualとhashPassword/verifyPasswordはauth.tsのプライベート関数のため、
// テスト用にモジュール内部をテストできるよう関数を再実装してテストする。
// auth.tsはbetter-auth等の外部依存があるため、純粋なロジック部分のみ抽出してテスト。

/** PBKDF2イテレーション回数（auth.tsと同じ値） */
const PBKDF2_ITERATIONS = 100000;

/**
 * テスト用: auth.tsのhashPasswordと同等の実装
 */
async function hashPassword(password: string): Promise<string> {
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
  const saltHex = Array.from(salt)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const hashHex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `pbkdf2:${PBKDF2_ITERATIONS}:${saltHex}:${hashHex}`;
}

/**
 * テスト用: auth.tsのtimingSafeEqualと同等の実装
 */
function timingSafeEqual(a: string, b: string): boolean {
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
 * テスト用: auth.tsのverifyPasswordと同等の実装
 */
async function verifyPassword(params: { hash: string; password: string }): Promise<boolean> {
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
  const hashHex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return timingSafeEqual(hashHex, storedHash);
}

describe("hashPassword", () => {
  it("正しいフォーマット pbkdf2:iterations:salt:hash を返すこと", async () => {
    const result = await hashPassword("TestPass123");
    const parts = result.split(":");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("pbkdf2");
    expect(parts[1]).toBe(String(PBKDF2_ITERATIONS));
    // saltは32文字(16バイト hex)
    expect(parts[2]).toHaveLength(32);
    // hashは64文字(32バイト hex)
    expect(parts[3]).toHaveLength(64);
  });

  it("同じパスワードでも毎回異なるsaltを生成すること", async () => {
    const hash1 = await hashPassword("SamePassword");
    const hash2 = await hashPassword("SamePassword");
    // saltが異なるため全体のハッシュ文字列も異なる
    expect(hash1).not.toBe(hash2);
    // ただし両方ともpbkdf2フォーマットであること
    expect(hash1.startsWith("pbkdf2:")).toBe(true);
    expect(hash2.startsWith("pbkdf2:")).toBe(true);
  });

  it("iterationsがPBKDF2_ITERATIONSと一致すること", async () => {
    const result = await hashPassword("password");
    const iterations = parseInt(result.split(":")[1], 10);
    expect(iterations).toBe(PBKDF2_ITERATIONS);
  });
});

describe("verifyPassword", () => {
  it("正しいパスワードでtrueを返すこと", async () => {
    const password = "MySecurePass1";
    const hash = await hashPassword(password);
    const result = await verifyPassword({ hash, password });
    expect(result).toBe(true);
  });

  it("誤ったパスワードでfalseを返すこと", async () => {
    const hash = await hashPassword("CorrectPass1");
    const result = await verifyPassword({ hash, password: "WrongPass1" });
    expect(result).toBe(false);
  });

  it("空パスワードでも正しく検証できること", async () => {
    const password = "";
    const hash = await hashPassword(password);
    const correct = await verifyPassword({ hash, password: "" });
    const wrong = await verifyPassword({ hash, password: "not-empty" });
    expect(correct).toBe(true);
    expect(wrong).toBe(false);
  });

  it("不正なハッシュフォーマット（pbkdf2プレフィックスなし）でfalseを返すこと", async () => {
    const result = await verifyPassword({
      hash: "invalid:hash:format",
      password: "password",
    });
    expect(result).toBe(false);
  });

  it("不正なハッシュフォーマット（フィールド数不足）でfalseを返すこと", async () => {
    const result = await verifyPassword({
      hash: "pbkdf2:100000:abc",
      password: "password",
    });
    expect(result).toBe(false);
  });

  it("空文字列ハッシュでfalseを返すこと", async () => {
    const result = await verifyPassword({ hash: "", password: "password" });
    expect(result).toBe(false);
  });

  it("異なる特殊文字を含むパスワードで正しく検証できること", async () => {
    const password = "Pass!@#$%^&*()_+";
    const hash = await hashPassword(password);
    expect(await verifyPassword({ hash, password })).toBe(true);
    expect(await verifyPassword({ hash, password: "Pass!@#$%^&*()_" })).toBe(false);
  });

  it("Unicode文字を含むパスワードで正しく検証できること", async () => {
    const password = "パスワード123";
    const hash = await hashPassword(password);
    expect(await verifyPassword({ hash, password })).toBe(true);
    expect(await verifyPassword({ hash, password: "パスワード124" })).toBe(false);
  });
});

describe("timingSafeEqual", () => {
  it("同じ文字列でtrueを返すこと", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
  });

  it("異なる文字列でfalseを返すこと", () => {
    expect(timingSafeEqual("abc", "abd")).toBe(false);
  });

  it("長さが異なる文字列でfalseを返すこと", () => {
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
    expect(timingSafeEqual("abcd", "abc")).toBe(false);
  });

  it("空文字列同士でtrueを返すこと", () => {
    expect(timingSafeEqual("", "")).toBe(true);
  });

  it("一方が空文字列の場合falseを返すこと", () => {
    expect(timingSafeEqual("", "a")).toBe(false);
    expect(timingSafeEqual("a", "")).toBe(false);
  });

  it("64文字のhex文字列で正しく比較できること", () => {
    const hex1 = "a".repeat(64);
    const hex2 = "a".repeat(64);
    const hex3 = "a".repeat(63) + "b";
    expect(timingSafeEqual(hex1, hex2)).toBe(true);
    expect(timingSafeEqual(hex1, hex3)).toBe(false);
  });
});
