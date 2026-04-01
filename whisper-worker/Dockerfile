FROM python:3.11-slim

# ffmpeg + 必要システムライブラリ
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Python依存関係（PyTorch不要、ctranslate2がCUDAをバンドル）
RUN pip install --no-cache-dir \
    runpod==1.7.0 \
    faster-whisper==1.1.0 \
    ctranslate2==4.5.0 \
    huggingface_hub

WORKDIR /app
COPY handler.py /app/handler.py

CMD ["python", "-u", "/app/handler.py"]
