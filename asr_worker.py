#!/usr/bin/env python3
"""Transcribe PCM WAV in the ASR virtualenv, keeping MLX warm in --serve mode."""

import contextlib
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


DEFAULT_PROMPT = (
    "测量记录：锡铅体系。添加剂是分子B，基底是ITO玻璃。"
    "工艺包括钙钛矿量子点旋涂、乙酸乙酯反溶剂和退火。"
)


def recognize(path, model, prompt):
    try:
        audio = load_wav(path)
        if audio.size < 16000 * 0.4 or not np.any(audio):
            return {"text": ""}
        from mlx_whisper import transcribe

        result = transcribe(
            audio,
            path_or_hf_repo=model,
            language="zh",
            task="transcribe",
            temperature=0.0,
            condition_on_previous_text=False,
            initial_prompt=prompt or None,
        )
        return {"text": " ".join(str(result.get("text", "")).split())[:2000]}
    except Exception as exc:
        # Don't emit any audio, transcript, or request path in errors.
        return {"error": type(exc).__name__}


def main():
    if len(sys.argv) != 2:
        print(json.dumps({"error": "缺少音频文件路径"}))
        return 2
    model = os.environ.get("LAB_ASR_MODEL", "mlx-community/whisper-small-mlx")
    prompt = os.environ.get("LAB_ASR_PROMPT", DEFAULT_PROMPT)
    if sys.argv[1] != "--serve":
        result = recognize(sys.argv[1], model, prompt)
        print(json.dumps(result))
        return int("error" in result)
    for line in sys.stdin:
        try:
            path = json.loads(line)["path"]
            # Reserve stdout exclusively for the parent process's JSON messages.
            with contextlib.redirect_stdout(sys.stderr):
                result = recognize(path, model, prompt)
        except (TypeError, ValueError, KeyError):
            result = {"error": "InvalidRequest"}
        print(json.dumps(result), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
