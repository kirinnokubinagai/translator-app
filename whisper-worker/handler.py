"""
Faster Whisper RunPod Serverless Worker
CTranslate2ベースの高速音声認識ワーカー（PyTorch不要）
"""

import os
import base64
import tempfile
import runpod
from faster_whisper import WhisperModel

# Network Volumeキャッシュディレクトリ
CACHE_DIR = os.environ.get(
    "WHISPER_CACHE_DIR", "/runpod-volume/huggingface/whisper"
)
os.environ["HF_HOME"] = "/runpod-volume/huggingface"

# デフォルトモデルとcompute_type
DEFAULT_MODEL = "large-v3-turbo"
DEFAULT_COMPUTE_TYPE = "int8_float16"

# グローバルモデルキャッシュ: model_name -> WhisperModel
_model_cache: dict[str, WhisperModel] = {}


def get_model(model_name: str) -> WhisperModel:
    """モデルを取得（キャッシュから、なければロード）"""
    if model_name in _model_cache:
        return _model_cache[model_name]

    print(f"Loading model: {model_name}")
    os.makedirs(CACHE_DIR, exist_ok=True)

    model = WhisperModel(
        model_name,
        device="cuda",
        compute_type=DEFAULT_COMPUTE_TYPE,
        download_root=CACHE_DIR,
    )
    _model_cache[model_name] = model
    print(f"Model {model_name} loaded successfully")
    return model


def handler(event):
    """
    RunPod Serverless Handler

    入力 (event["input"]):
        audio_base64: str (必須) - base64エンコード音声
        model: str (任意) - モデル名、デフォルト "large-v3-turbo"
        language: str | null (任意) - 言語コード、nullで自動検出
        transcription: str (任意) - "plain_text" or "srt"
        translate: bool (任意) - 英語翻訳フラグ
        temperature: float (任意)
        best_of: int (任意)
        beam_size: int (任意)
        condition_on_previous_text: bool (任意)
        temperature_increment_on_fallback: float (任意)
        compression_ratio_threshold: float (任意)
        logprob_threshold: float (任意)
        no_speech_threshold: float (任意)

    出力:
        transcription: str - 文字起こしテキスト
        detected_language: str - 検出言語コード
        segments: list - セグメント情報
    """
    try:
        input_data = event.get("input", {})

        # 必須パラメータ
        audio_base64 = input_data.get("audio_base64")
        if not audio_base64:
            return {"error": "audio_base64 is required"}

        # オプションパラメータ（Cloudflare Workerの契約に合わせる）
        model_name = input_data.get("model", DEFAULT_MODEL)
        language = input_data.get("language") or None
        transcription_format = input_data.get("transcription", "plain_text")
        task = "translate" if input_data.get("translate", False) else "transcribe"
        temperature = input_data.get("temperature", 0)
        best_of = input_data.get("best_of", 5)
        beam_size = input_data.get("beam_size", 5)
        condition_on_previous_text = input_data.get(
            "condition_on_previous_text", False
        )
        temperature_increment_on_fallback = input_data.get(
            "temperature_increment_on_fallback", 0.2
        )
        compression_ratio_threshold = input_data.get(
            "compression_ratio_threshold", 2.4
        )
        logprob_threshold = input_data.get("logprob_threshold", -1.0)
        no_speech_threshold = input_data.get("no_speech_threshold", 0.6)

        # モデルロード
        model = get_model(model_name)

        # base64音声をデコードして一時ファイルに保存
        audio_bytes = base64.b64decode(audio_base64)
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        try:
            # temperature fallbackリストを構築
            if temperature == 0 and temperature_increment_on_fallback > 0:
                steps = int(1 / temperature_increment_on_fallback) + 1
                temperature_list = tuple(
                    t * temperature_increment_on_fallback for t in range(steps)
                )
            else:
                temperature_list = temperature

            # 音声認識実行
            segments_generator, info = model.transcribe(
                tmp_path,
                language=language,
                task=task,
                beam_size=beam_size,
                best_of=best_of,
                temperature=temperature_list,
                condition_on_previous_text=condition_on_previous_text,
                compression_ratio_threshold=compression_ratio_threshold,
                log_prob_threshold=logprob_threshold,
                no_speech_threshold=no_speech_threshold,
            )

            # セグメントを实体化（一時ファイル削除前に完了させる必要がある）
            segments_list = []
            full_text_parts = []
            for seg in segments_generator:
                segment_data = {
                    "id": seg.id,
                    "seek": seg.seek,
                    "start": round(seg.start, 3),
                    "end": round(seg.end, 3),
                    "text": seg.text,
                    "avg_logprob": round(seg.avg_logprob, 4),
                    "compression_ratio": round(seg.compression_ratio, 4),
                    "no_speech_prob": round(seg.no_speech_prob, 4),
                }
                segments_list.append(segment_data)
                full_text_parts.append(seg.text.strip())

            # テキストフォーマット
            if transcription_format == "plain_text":
                transcription = " ".join(full_text_parts)
            else:
                transcription = "\n".join(full_text_parts)

            print(
                f"Transcription complete: lang={info.language}, "
                f"segments={len(segments_list)}, "
                f"text_len={len(transcription)}"
            )

            return {
                "transcription": transcription,
                "detected_language": info.language,
                "segments": segments_list,
            }
        finally:
            os.unlink(tmp_path)

    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback

        traceback.print_exc()
        return {"error": str(e)}


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
