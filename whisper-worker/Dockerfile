FROM nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04

# Python + ffmpeg
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Python依存関係（CUDA対応ctranslate2）
RUN pip3 install --no-cache-dir \
    runpod==1.7.0 \
    faster-whisper==1.1.0 \
    huggingface_hub

WORKDIR /app
COPY handler.py /app/handler.py

CMD ["python3", "-u", "/app/handler.py"]
