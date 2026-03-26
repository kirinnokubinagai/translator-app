"""
TranslateGemma RunPod Serverless Worker
Google TranslateGemma-12B-itを使用した翻訳ワーカー
"""

import os
import runpod
import torch
from transformers import AutoProcessor, Gemma3ForConditionalGeneration

# モデルをグローバルに読み込み（コールドスタート時のみ）
MODEL_ID = "google/translategemma-12b-it"
HF_TOKEN = os.environ.get("HF_TOKEN", "")

# Network Volumeを使う場合は /runpod-volume にマウント
# 環境変数でキャッシュディレクトリを指定
CACHE_DIR = os.environ.get("HF_HOME", "/runpod-volume/huggingface")
os.environ["HF_HOME"] = CACHE_DIR
os.environ["TRANSFORMERS_CACHE"] = f"{CACHE_DIR}/hub"

model = None
processor = None


def load_model():
    """モデルとプロセッサを読み込む"""
    global model, processor

    if model is None:
        print(f"Loading model: {MODEL_ID}")
        print(f"Cache directory: {CACHE_DIR}")
        print(f"HF_TOKEN set: {bool(HF_TOKEN)}")

        # キャッシュディレクトリ作成
        os.makedirs(CACHE_DIR, exist_ok=True)

        print("Loading processor...")
        processor = AutoProcessor.from_pretrained(
            MODEL_ID,
            token=HF_TOKEN,
            cache_dir=f"{CACHE_DIR}/hub"
        )

        print("Loading model (this may take a while on first run)...")
        model = Gemma3ForConditionalGeneration.from_pretrained(
            MODEL_ID,
            torch_dtype=torch.bfloat16,
            device_map="auto",
            token=HF_TOKEN,
            cache_dir=f"{CACHE_DIR}/hub",
            low_cpu_mem_usage=True,
        )
        print("Model loaded successfully")

    return model, processor


def get_language_code(language: str) -> str:
    """言語名からISO言語コードに変換"""
    language_map = {
        "japanese": "ja",
        "english": "en",
        "chinese": "zh",
        "korean": "ko",
        "french": "fr",
        "german": "de",
        "spanish": "es",
        "italian": "it",
        "portuguese": "pt",
        "russian": "ru",
        "arabic": "ar",
        "hindi": "hi",
        "thai": "th",
        "vietnamese": "vi",
        "indonesian": "id",
        "ja": "ja",
        "en": "en",
        "zh": "zh",
        "ko": "ko",
        "fr": "fr",
        "de": "de",
        "es": "es",
        "it": "it",
        "pt": "pt",
        "ru": "ru",
        "ar": "ar",
        "hi": "hi",
        "th": "th",
        "vi": "vi",
        "id": "id",
    }
    return language_map.get(language.lower(), language.lower()[:2])


def handler(event):
    """
    RunPod Serverless Handler

    入力:
        text: 翻訳するテキスト
        source_language: 元の言語（例: "Japanese", "English"）
        target_language: 翻訳先の言語（例: "English", "Japanese"）

    出力:
        translated_text: 翻訳されたテキスト
    """
    try:
        # モデル読み込み
        model, processor = load_model()

        # 入力取得
        input_data = event.get("input", {})
        text = input_data.get("text", "")
        source_language = input_data.get("source_language", input_data.get("sourceLanguage", ""))
        target_language = input_data.get("target_language", input_data.get("targetLanguage", ""))

        if not text:
            return {"error": "text is required"}
        if not source_language or not target_language:
            return {"error": "source_language and target_language are required"}

        # 言語コード変換
        source_code = get_language_code(source_language)
        target_code = get_language_code(target_language)

        print(f"Translating from {source_code} to {target_code}: {text[:50]}...")

        # TranslateGemmaのメッセージフォーマット
        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "source_lang_code": source_code,
                        "target_lang_code": target_code,
                        "text": text,
                    }
                ],
            }
        ]

        # 入力準備
        inputs = processor.apply_chat_template(
            messages,
            add_generation_prompt=True,
            tokenize=True,
            return_dict=True,
            return_tensors="pt",
        ).to(model.device)

        # 生成
        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=1024,
                do_sample=False,
            )

        # デコード
        generated_tokens = outputs[0][inputs["input_ids"].shape[1]:]
        translated_text = processor.decode(generated_tokens, skip_special_tokens=True)

        print(f"Translation complete: {translated_text[:50]}...")

        return {
            "translated_text": translated_text,
            "source_language": source_code,
            "target_language": target_code,
        }

    except Exception as e:
        print(f"Error: {str(e)}")
        return {"error": str(e)}


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
