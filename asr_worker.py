#!/usr/bin/env python3
"""Transcribe a 16 kHz mono WAV file with mlx-whisper and print JSON.

Runs in a separate interpreter (the ASR virtualenv) so the main web server does
not need machine-learning dependencies loaded into its own process.
"""

import json
import os
import sys
import wave

import numpy as np


def load_wav(path):
    with wave.open(path, "rb") as handle:
        channels = handle.getnchannels()
        width = handle.getsampwidth()
        rate = handle.getframerate()
        frames = handle.readframes(handle.getnframes())
    if width != 2:
        raise ValueError("只支持 16 位 PCM 音频")
    samples = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
    if channels > 1:
        samples = samples.reshape(-1, channels).mean(axis=1)
    if rate != 16000:
        duration = samples.shape[0] / float(rate)
        target = int(round(duration * 16000))
        if target <= 0:
            return samples
        source_axis = np.linspace(0.0, duration, num=samples.shape[0], endpoint=False)
        target_axis = np.linspace(0.0, duration, num=target, endpoint=False)
        samples = np.interp(target_axis, source_axis, samples).astype(np.float32)
    return samples


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "缺少音频文件路径"}, ensure_ascii=False))
        return 2
    model = os.environ.get("LAB_ASR_MODEL", "mlx-community/whisper-small-mlx")
    try:
        audio = load_wav(sys.argv[1])
        if audio.shape[0] < 16000 * 0.4:
            print(json.dumps({"text": "", "error": "录音太短"}, ensure_ascii=False))
            return 0
        from mlx_whisper import transcribe

        result = transcribe(
            audio,
            path_or_hf_repo=model,
            language="zh",
            task="transcribe",
            temperature=0.0,
            condition_on_previous_text=False,
            initial_prompt="太阳能电池实验条件记录，例如锡铅钙钛矿、退火温度、旋涂转速、界面钝化、添加剂。",
        )
        text = " ".join(str(result.get("text", "")).split())
        print(json.dumps({"text": text}, ensure_ascii=False))
        return 0
    except Exception as exc:  # pragma: no cover - reported to the caller
        print(json.dumps({"error": "%s: %s" % (type(exc).__name__, exc)}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    sys.exit(main())
