FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

WORKDIR /app

# PyTorch 2.6+にアップグレード（transformersの要件）
RUN pip install --no-cache-dir --upgrade \
    torch==2.6.0 \
    torchvision \
    torchaudio \
    --index-url https://download.pytorch.org/whl/cu124

# 依存関係インストール
RUN pip install --no-cache-dir \
    runpod \
    transformers>=4.45.0 \
    accelerate \
    bitsandbytes \
    sentencepiece \
    protobuf \
    huggingface_hub

# ビルド時にモデルをダウンロードしてイメージに焼き込む
ARG HF_TOKEN
RUN mkdir -p /app/models && \
    HF_TOKEN=${HF_TOKEN} python -c "import os; from huggingface_hub import snapshot_download; snapshot_download('google/translategemma-4b-it', token=os.environ['HF_TOKEN'], cache_dir='/app/models/hub')"

# ハンドラーコピー
COPY handler.py /app/handler.py

# キャッシュディレクトリをイメージ内に固定
ENV HF_HOME=/app/models
ENV TRANSFORMERS_CACHE=/app/models/hub

# 実行
CMD ["python", "-u", "/app/handler.py"]
