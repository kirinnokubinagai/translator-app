/**
 * 翻訳アプリ用APIプロキシ
 */

type Env = {
  RUNPOD_API_KEY: string;
  RUNPOD_WHISPER_ENDPOINT_ID: string;
  RUNPOD_TRANSLATE_ENDPOINT_ID: string;
  APP_SECRET: string;
  ALLOWED_ORIGIN: string;
};

type EndpointType = "whisper" | "translate";

function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function jsonResponse(body: Record<string, unknown>, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

function errorResponse(message: string, status: number, origin: string): Response {
  return jsonResponse({ success: false, error: { code: "API_ERROR", message } }, status, origin);
}

function validateAppAuth(request: Request, env: Env): boolean {
  const auth = request.headers.get("Authorization");
  if (!auth) return false;
  return auth.replace("Bearer ", "") === env.APP_SECRET;
}

function getEndpointId(env: Env, type: EndpointType): string {
  if (type === "whisper") return env.RUNPOD_WHISPER_ENDPOINT_ID;
  return env.RUNPOD_TRANSLATE_ENDPOINT_ID;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = env.ALLOWED_ORIGIN;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (!validateAppAuth(request, env)) {
      return errorResponse("認証が必要です", 401, origin);
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === "/api/transcribe" && request.method === "POST") {
        return await handleTranscribe(request, env, origin);
      }
      if (path === "/api/translate" && request.method === "POST") {
        return await handleTranslate(request, env, origin);
      }
      if (path.startsWith("/api/job/") && request.method === "GET") {
        return await handleJobStatus(request, env, origin);
      }
      return errorResponse("エンドポイントが見つかりません", 404, origin);
    } catch (error) {
      const message = error instanceof Error ? error.message : "サーバーエラーが発生しました";
      return errorResponse(message, 500, origin);
    }
  },
};

/**
 * 音声認識（runsync同期方式）
 * audio_base64をそのままFaster Whisperに渡す
 */
async function handleTranscribe(
  request: Request,
  env: Env,
  origin: string
): Promise<Response> {
  const body = (await request.json()) as {
    audio_base64?: string;
    language?: string;
    model?: string;
  };

  if (!body.audio_base64) {
    return errorResponse("audio_base64は必須です", 400, origin);
  }

  const runpodUrl = `https://api.runpod.ai/v2/${env.RUNPOD_WHISPER_ENDPOINT_ID}/runsync`;

  const response = await fetch(runpodUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.RUNPOD_API_KEY}`,
    },
    body: JSON.stringify({
      input: {
        audio_base64: body.audio_base64,
        model: body.model ?? "medium",
        language: body.language ?? null,
        transcription: "plain_text",
        translate: false,
        temperature: 0,
        best_of: 5,
        beam_size: 5,
        suppress_tokens: "-1",
        condition_on_previous_text: false,
        temperature_increment_on_fallback: 0.2,
        compression_ratio_threshold: 2.4,
        logprob_threshold: -1,
        no_speech_threshold: 0.6,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    return errorResponse(`Faster Whisper失敗: ${response.status} ${errorText}`, 502, origin);
  }

  const data = await response.text();
  return new Response(data, {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

/**
 * 翻訳ジョブ投入（非同期）
 * カスタムTranslateGemmaワーカーを使用
 */
async function handleTranslate(
  request: Request,
  env: Env,
  origin: string
): Promise<Response> {
  const body = (await request.json()) as {
    text?: string;
    sourceLanguage?: string;
    targetLanguage?: string;
  };

  if (!body.text || !body.sourceLanguage || !body.targetLanguage) {
    return errorResponse("text, sourceLanguage, targetLanguageは必須です", 400, origin);
  }

  const runpodUrl = `https://api.runpod.ai/v2/${env.RUNPOD_TRANSLATE_ENDPOINT_ID}/run`;

  const response = await fetch(runpodUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.RUNPOD_API_KEY}`,
    },
    body: JSON.stringify({
      input: {
        text: body.text,
        source_language: body.sourceLanguage,
        target_language: body.targetLanguage,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    return errorResponse(`翻訳ジョブ投入失敗: ${response.status} ${errorText}`, 502, origin);
  }

  const data = (await response.json()) as { id?: string };
  if (!data.id) {
    return errorResponse("RunPodからジョブIDが返されませんでした", 502, origin);
  }

  return jsonResponse({ jobId: data.id }, 200, origin);
}

/**
 * ジョブステータス問い合わせ
 */
async function handleJobStatus(
  request: Request,
  env: Env,
  origin: string
): Promise<Response> {
  const url = new URL(request.url);
  const jobId = url.pathname.replace("/api/job/", "");
  const endpointParam = url.searchParams.get("endpoint");

  if (!jobId) return errorResponse("ジョブIDが指定されていません", 400, origin);
  if (endpointParam !== "whisper" && endpointParam !== "translate") {
    return errorResponse("endpointパラメータにwhisperまたはtranslateを指定してください", 400, origin);
  }

  const endpointId = getEndpointId(env, endpointParam);
  const statusUrl = `https://api.runpod.ai/v2/${endpointId}/status/${jobId}`;

  const response = await fetch(statusUrl, {
    method: "GET",
    headers: { Authorization: `Bearer ${env.RUNPOD_API_KEY}` },
  });

  if (!response.ok) {
    return errorResponse(`ステータス取得失敗: ${response.status}`, 502, origin);
  }

  const data = await response.text();
  return new Response(data, {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}
