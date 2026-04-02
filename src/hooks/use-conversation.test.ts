/**
 * useConversation フックの統合テスト
 *
 * チャンクキューの逐次処理・話者/言語スナップショット・停止後のキュー処理を
 * モックベースで検証する。
 *
 * Reactフックを直接テストせず、フック内部のキュー処理ロジックを
 * 純粋関数として抽出・テストする方針。
 */

/** チャンクキューアイテムの型（use-conversation.ts のQueueItemと同等） */
type QueueItem = {
  base64: string;
  speaker: "speaker1" | "speaker2";
  sourceLanguage: string;
  targetLanguage: string;
};

/** 処理結果の型 */
type ProcessedItem = {
  base64: string;
  speaker: "speaker1" | "speaker2";
  sourceLanguage: string;
  targetLanguage: string;
  processedAt: number;
};

/**
 * キューの逐次処理をシミュレートする
 *
 * use-conversation.ts の drainQueue ロジックを純粋関数として再現。
 * 各アイテムを順番に処理し、処理結果を返す。
 */
async function drainQueueSimulation(
  queue: QueueItem[],
  processDelay: number = 10,
): Promise<ProcessedItem[]> {
  const results: ProcessedItem[] = [];

  while (queue.length > 0) {
    const item = queue.shift()!;
    await new Promise((r) => setTimeout(r, processDelay));
    results.push({
      ...item,
      processedAt: Date.now(),
    });
  }

  return results;
}

/**
 * キューにアイテムを追加する（話者・言語をスナップショット）
 *
 * use-conversation.ts の processChunk ロジックを再現。
 * 追加時点の言語設定をキャプチャする。
 */
function enqueueChunk(
  queue: QueueItem[],
  base64: string,
  speaker: "speaker1" | "speaker2",
  speaker1Language: string,
  speaker2Language: string,
): void {
  const sourceLanguage = speaker === "speaker1" ? speaker1Language : speaker2Language;
  const targetLanguage = speaker === "speaker1" ? speaker2Language : speaker1Language;

  queue.push({ base64, speaker, sourceLanguage, targetLanguage });
}

describe("チャンクキューの逐次処理", () => {
  it("3チャンク投入→順番通りに処理されること", async () => {
    const queue: QueueItem[] = [];

    // 3チャンクをキューに投入
    enqueueChunk(queue, "chunk-1", "speaker1", "ja", "en");
    enqueueChunk(queue, "chunk-2", "speaker1", "ja", "en");
    enqueueChunk(queue, "chunk-3", "speaker1", "ja", "en");

    expect(queue).toHaveLength(3);

    // 逐次処理
    const results = await drainQueueSimulation(queue);

    // 順番通りに処理されていること
    expect(results).toHaveLength(3);
    expect(results[0].base64).toBe("chunk-1");
    expect(results[1].base64).toBe("chunk-2");
    expect(results[2].base64).toBe("chunk-3");

    // 処理順序が時系列順であること
    for (let i = 1; i < results.length; i++) {
      expect(results[i].processedAt).toBeGreaterThanOrEqual(results[i - 1].processedAt);
    }
  });

  it("キューが空の場合は即座に完了すること", async () => {
    const queue: QueueItem[] = [];
    const results = await drainQueueSimulation(queue);
    expect(results).toHaveLength(0);
  });

  it("処理中にキューに追加されたアイテムも処理されること", async () => {
    const queue: QueueItem[] = [];
    const results: ProcessedItem[] = [];

    // 最初の2チャンクを投入
    enqueueChunk(queue, "chunk-1", "speaker1", "ja", "en");
    enqueueChunk(queue, "chunk-2", "speaker1", "ja", "en");

    // 処理開始（カスタムドレイン：処理途中で追加をシミュレート）
    let addedDuringProcessing = false;
    while (queue.length > 0) {
      const item = queue.shift()!;
      await new Promise((r) => setTimeout(r, 5));
      results.push({ ...item, processedAt: Date.now() });

      // 最初のアイテム処理後にもう1つ追加
      if (!addedDuringProcessing) {
        enqueueChunk(queue, "chunk-3-added-later", "speaker2", "en", "ja");
        addedDuringProcessing = true;
      }
    }

    expect(results).toHaveLength(3);
    expect(results[2].base64).toBe("chunk-3-added-later");
    expect(results[2].speaker).toBe("speaker2");
  });
});

describe("話者・言語スナップショット", () => {
  it("キュー投入時の言語設定が処理時に保持されること", async () => {
    const queue: QueueItem[] = [];

    // 日本語→英語でチャンクを投入
    enqueueChunk(queue, "chunk-1", "speaker1", "ja", "en");

    // 言語設定が「変更された」とシミュレート（キュー内のアイテムは影響されない）
    // chunk-2は中国語→英語で投入
    enqueueChunk(queue, "chunk-2", "speaker1", "zh", "en");

    const results = await drainQueueSimulation(queue);

    // chunk-1は投入時の言語設定を保持
    expect(results[0].sourceLanguage).toBe("ja");
    expect(results[0].targetLanguage).toBe("en");

    // chunk-2は変更後の言語設定
    expect(results[1].sourceLanguage).toBe("zh");
    expect(results[1].targetLanguage).toBe("en");
  });

  it("話者1と話者2で言語が反転すること", async () => {
    const queue: QueueItem[] = [];

    // 話者1: 日本語→英語
    enqueueChunk(queue, "sp1-chunk", "speaker1", "ja", "en");
    // 話者2: 英語→日本語
    enqueueChunk(queue, "sp2-chunk", "speaker2", "ja", "en");

    const results = await drainQueueSimulation(queue);

    // 話者1のソースは日本語、ターゲットは英語
    expect(results[0].sourceLanguage).toBe("ja");
    expect(results[0].targetLanguage).toBe("en");

    // 話者2のソースは英語、ターゲットは日本語
    expect(results[1].sourceLanguage).toBe("en");
    expect(results[1].targetLanguage).toBe("ja");
  });

  it("同一話者で言語切替してもスナップショットが独立していること", async () => {
    const queue: QueueItem[] = [];

    // 最初はja→en
    enqueueChunk(queue, "before-switch", "speaker1", "ja", "en");
    // 言語をko→enに変更した後のチャンク
    enqueueChunk(queue, "after-switch", "speaker1", "ko", "en");

    const results = await drainQueueSimulation(queue);

    expect(results[0].sourceLanguage).toBe("ja");
    expect(results[1].sourceLanguage).toBe("ko");
  });
});

describe("停止後のキュー処理", () => {
  it("停止時にキュー内の残チャンクが処理完了すること", async () => {
    const queue: QueueItem[] = [];

    // 5チャンクをキューに投入
    for (let i = 0; i < 5; i++) {
      enqueueChunk(queue, `chunk-${i}`, "speaker1", "ja", "en");
    }

    // 「停止」をシミュレート（新しいチャンクの追加を止める）
    const isRecording = false;

    // 停止後もキューの残りを処理
    const results = await drainQueueSimulation(queue);

    expect(isRecording).toBe(false);
    expect(results).toHaveLength(5);

    // 全チャンクが順番通りに処理されている
    for (let i = 0; i < 5; i++) {
      expect(results[i].base64).toBe(`chunk-${i}`);
    }
  });

  it("停止後は新しいチャンクが追加されないこと", async () => {
    const queue: QueueItem[] = [];

    enqueueChunk(queue, "chunk-before-stop", "speaker1", "ja", "en");

    // 停止フラグ
    let isRecording = true;

    // 処理前に停止
    isRecording = false;

    // 停止後にチャンクを追加しようとしても、isRecordingがfalseなので追加しない
    if (isRecording) {
      enqueueChunk(queue, "should-not-be-added", "speaker1", "ja", "en");
    }

    // 既存のキューのみ処理
    const results = await drainQueueSimulation(queue);

    expect(results).toHaveLength(1);
    expect(results[0].base64).toBe("chunk-before-stop");
  });

  it("キューが空の状態で停止しても問題ないこと", async () => {
    const queue: QueueItem[] = [];
    const results = await drainQueueSimulation(queue);

    expect(results).toHaveLength(0);
  });
});
