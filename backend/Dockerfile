FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for OpenCV and PostgreSQL
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgomp1 \
    libpq-dev \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p /app/storage/original /app/storage/thumbnails /app/storage/processed /app/models

# Download ML models (this will cache them in the image)
# Commented out - models will download on first use
# RUN python -c "from ultralytics import YOLO, SAM; \
#     try: \
#         YOLO('yolov8n.pt'); \
#         print('YOLO model downloaded successfully'); \
#     except Exception as e: \
#         print(f'YOLO download failed: {e}'); \
#     try: \
#         SAM('sam2.1_b.pt'); \
#         print('SAM2 model downloaded successfully'); \
#     except Exception as e: \
#         print(f'SAM2 download failed: {e}');"

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
