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

# ハンドラーコピー
COPY handler.py /app/handler.py

# 実行
CMD ["python", "-u", "/app/handler.py"]
