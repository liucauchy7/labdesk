#!/usr/bin/env python3
"""Extract the useful parts of a PDF (title page + methods) for the model.

Prints a single JSON line: {"text": "...", "pages": n, "chars": n, "truncated": bool}
The PDF itself is never stored: the caller writes it to a temporary path and
deletes it as soon as this script returns.
"""

import json
import re
import sys

METHOD_HINTS = (
    "experimental", "experiment", "methods", "method", "materials and methods",
    "device fabrication", "fabrication", "synthesis", "characterization",
    "器件制备", "制备", "实验部分", "实验方法", "表征",
)

MAX_HEAD = 4000
MAX_METHODS = 6000
MAX_TOTAL = 9000


def pick_text(pages):
    if not pages:
        return "", 0
    head = pages[0][:MAX_HEAD]
    methods = ""
    for page in pages:
        lowered = page[:400].lower()
        if any(hint in lowered for hint in METHOD_HINTS):
            methods = page[:MAX_METHODS]
            break
    if not methods:
        tail = "\n".join(pages[-3:])
        if any(hint in tail[:2000].lower() for hint in METHOD_HINTS):
            methods = tail[-MAX_METHODS:]
    if not methods:
        methods = "\n".join(pages[1:])[:MAX_METHODS]
    text = head + "\n\n" + methods
    truncated = len(head) + len(methods) < sum(len(page) for page in pages)
    return text.strip(), truncated


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "缺少 PDF 路径"}, ensure_ascii=False))
        return 2
    try:
        from pypdf import PdfReader

        reader = PdfReader(sys.argv[1])
        pages = []
        for page in reader.pages[:40]:
            try:
                pages.append(re.sub(r"[ \t]+", " ", page.extract_text() or ""))
            except Exception:
                pages.append("")
        text, truncated = pick_text(pages)
        if len(text) < 300:
            print(json.dumps({"error": "没有从 PDF 里读到可用文字，可能是扫描版"}, ensure_ascii=False))
            return 1
        print(json.dumps({
            "text": text[:MAX_TOTAL],
            "pages": len(pages),
            "chars": len(text),
            "truncated": truncated or len(text) > MAX_TOTAL,
        }, ensure_ascii=False))
        return 0
    except Exception as exc:  # pragma: no cover
        print(json.dumps({"error": "%s: %s" % (type(exc).__name__, exc)}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    sys.exit(main())
