---
title: Yt4ksaver
emoji: 🎥
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# yt4ksaver Backend

This repository runs the Python/Flask backend container for **yt4ksaver.com**.

It uses `yt-dlp` and `ffmpeg` to download high-resolution (up to 8K) YouTube videos and convert high-quality MP3 audio files.

## Hugging Face Space Config

- **SDK**: Docker
- **Port**: 7860 (exposed to HF ingress)
