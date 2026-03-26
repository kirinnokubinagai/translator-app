/** RunPodジョブのステータス */
export type RunPodJobStatus =
  | "IN_QUEUE"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

/** RunPodジョブステータスレスポンス */
export type RunPodStatusResponse = {
  status: RunPodJobStatus;
  output?: unknown;
  error?: string;
};

/** ジョブ投入レスポンス */
export type SubmitResponse = {
  jobId: string;
};

/**
 * ジョブのステータスが完了系かどうか判定する
 */
export function isJobTerminal(status: RunPodJobStatus): boolean {
  return (
    status === "COMPLETED" || status === "FAILED" || status === "CANCELLED"
  );
}

/**
 * 指定ミリ秒待機する
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
