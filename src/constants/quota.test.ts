/**
 * クォータ定数のユニットテスト
 */
import {
  INITIAL_QUOTA,
  AD_REWARD_QUOTA,
  TRANSCRIBE_COST,
  TRANSLATE_COST,
  QUOTA_LOW_THRESHOLD,
  QUOTA_PACKS,
} from "./quota";

describe("クォータ定数", () => {
  it("INITIAL_QUOTAが20であること", () => {
    expect(INITIAL_QUOTA).toBe(20);
  });

  it("AD_REWARD_QUOTAが5であること", () => {
    expect(AD_REWARD_QUOTA).toBe(5);
  });

  it("TRANSCRIBE_COSTが1であること", () => {
    expect(TRANSCRIBE_COST).toBe(1);
  });

  it("TRANSLATE_COSTが1であること", () => {
    expect(TRANSLATE_COST).toBe(1);
  });

  it("QUOTA_LOW_THRESHOLDが10であること", () => {
    expect(QUOTA_LOW_THRESHOLD).toBe(10);
  });
});

describe("QUOTA_PACKS", () => {
  it("3つのパックが存在すること", () => {
    expect(QUOTA_PACKS).toHaveLength(3);
  });

  it("starterパックが正しい値を持つこと", () => {
    const starter = QUOTA_PACKS.find((p) => p.type === "starter");
    expect(starter).toBeDefined();
    expect(starter?.amount).toBe(100);
    expect(starter?.priceNum).toBe(160);
    expect(starter?.label).toBe("Starter");
  });

  it("standardパックが正しい値を持つこと", () => {
    const standard = QUOTA_PACKS.find((p) => p.type === "standard");
    expect(standard).toBeDefined();
    expect(standard?.amount).toBe(500);
    expect(standard?.priceNum).toBe(650);
    expect(standard?.label).toBe("Standard");
  });

  it("premiumパックが正しい値を持つこと", () => {
    const premium = QUOTA_PACKS.find((p) => p.type === "premium");
    expect(premium).toBeDefined();
    expect(premium?.amount).toBe(1500);
    expect(premium?.priceNum).toBe(1600);
    expect(premium?.label).toBe("Premium");
  });

  it("全パックに必須フィールドが存在すること", () => {
    for (const pack of QUOTA_PACKS) {
      expect(pack).toHaveProperty("type");
      expect(pack).toHaveProperty("amount");
      expect(pack).toHaveProperty("price");
      expect(pack).toHaveProperty("priceNum");
      expect(pack).toHaveProperty("label");
    }
  });

  it("パックのamountが昇順に並んでいること", () => {
    const amounts = QUOTA_PACKS.map((p) => p.amount);
    for (let i = 1; i < amounts.length; i++) {
      expect(amounts[i]).toBeGreaterThan(amounts[i - 1]);
    }
  });

  it("パックのpriceNumが昇順に並んでいること", () => {
    const prices = QUOTA_PACKS.map((p) => p.priceNum);
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeGreaterThan(prices[i - 1]);
    }
  });
});
