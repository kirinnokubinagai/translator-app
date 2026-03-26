FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

WORKDIR /app

# 依存関係インストール
RUN pip install --no-cache-dir \
    runpod \
    transformers>=4.45.0 \
    accelerate \
    bitsandbytes \
    sentencepiece \
    protobuf

# HuggingFaceトークン（ビルド時に渡す）
ARG HF_TOKEN
ENV HF_TOKEN=${HF_TOKEN}

# モデルを事前にダウンロード（オプション、イメージサイズ増加）
# RUN python -c "from transformers import AutoProcessor, Gemma3ForConditionalGeneration; \
#     AutoProcessor.from_pretrained('google/translategemma-12b-it', token='${HF_TOKEN}'); \
#     Gemma3ForConditionalGeneration.from_pretrained('google/translategemma-12b-it', token='${HF_TOKEN}')"

# ハンドラーコピー
COPY handler.py /app/handler.py

# 実行
CMD ["python", "-u", "/app/handler.py"]
