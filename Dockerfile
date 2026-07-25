FROM python:3.12-slim

# Install ffmpeg and system utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . .

# Default port for Koyeb is 8000
ENV PORT=8000
EXPOSE $PORT

# Run with Gunicorn (using shell form so $PORT is evaluated)
CMD gunicorn --bind 0.0.0.0:$PORT --workers 2 --threads 4 app:app
