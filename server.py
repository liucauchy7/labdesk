#!/usr/bin/env python3
"""Small authenticated LAN server for the lab workspace app."""

import argparse
import base64
import gzip
import hmac
import ipaddress
import json
import mimetypes
import os
import re
import secrets
import socket
import subprocess
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import wave
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = Path(__file__).resolve().parent / "public"
STORAGE = Path(__file__).resolve().parent / "storage"
UPLOADS = STORAGE / "uploads"
LIBRARY = STORAGE / "library"
LABDATA = STORAGE / "labdata"
DB_PATH = STORAGE / "state.json"
IMPORT_PATH = ROOT / "outputs" / "260930-T.import.json"
REPORT_PATH = ROOT / "数据平台落地方案.md"
DOWNLOADS = Path(__file__).resolve().parent / "android" / "dist"
MAX_BODY = 42 * 1024 * 1024
MAX_PHOTO = 12 * 1024 * 1024
MAX_PDF = 30 * 1024 * 1024
MAX_RAW = 8 * 1024 * 1024
MAX_SPEECH = 12 * 1024 * 1024
MAX_PDF_ANALYZE = 30 * 1024 * 1024
RAW_SUFFIXES = {".csv", ".txt", ".tsv", ".dat", ".json", ".xlsx"}
RAW_MIMES = {
    "text/csv", "text/plain", "text/tab-separated-values", "application/json",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/octet-stream",
}
PHOTO_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
LOCK = threading.RLock()
AUTH_LOCK = threading.RLock()
AUTH_FAILURES = {}
AUTH_WINDOW_SECONDS = 10 * 60
AUTH_FAILURE_LIMIT = 8
TOKEN = ""
ASR_PYTHON = ""
ASR_WORKER = Path(__file__).resolve().parent / "asr_worker.py"
ASR_MODEL = ""
ASR_TIMEOUT = 120
ASR_READY = False
PDF_PYTHON = ""
PDF_WORKER = Path(__file__).resolve().parent / "pdf_worker.py"
PDF_TIMEOUT = 120
PDF_READY = False
LLM_BASE_URL = ""
LLM_MODEL = ""
LLM_API_KEY = ""
LLM_FALLBACK_BASE_URL = ""
LLM_FALLBACK_MODEL = ""
LLM_FALLBACK_API_KEY = ""

ZONES_FILE = Path(os.environ.get("LAB_ZONES_FILE", "")).expanduser() if os.environ.get("LAB_ZONES_FILE") else Path(__file__).resolve().parent / "zones.local.json"

PLACEHOLDER_ZONES = [
    {"id": "area-1", "name": "示例区域 1", "category": "公共区域", "group": "示例楼", "type": "area", "assignees": []},
    {"id": "area-2", "name": "示例区域 2", "category": "公共区域", "group": "示例楼", "type": "area", "assignees": []},
    {"id": "device-1", "name": "示例仪器 1", "category": "仪器", "group": "示例组", "type": "device", "assignees": []},
    {"id": "device-2", "name": "示例仪器 2", "category": "仪器", "group": "示例组", "type": "device", "assignees": []},
]


def load_zones():
    if ZONES_FILE.is_file():
        try:
            data = json.loads(ZONES_FILE.read_text(encoding="utf-8"))
            if isinstance(data, list) and data and all(isinstance(item, dict) and item.get("id") for item in data):
                return data
        except (OSError, ValueError) as exc:
            print("Cannot read zones file: %s" % exc)
    return PLACEHOLDER_ZONES


ZONES = load_zones()


WORKSHOP = [
    {
        "id": "precursor-calculator",
        "title": "钙钛矿前驱体配方计算器",
        "author": "马鸣宇",
        "desc": "按浓度、片数和冗余算配液体积，给出各药品称量值与溶剂配比；支持保存配方和导出 CSV。",
        "url": "/workshop/precursor-calculator.html",
    },
]

SYSTEMS = [
    {"id": "sn-pb", "name": "锡铅混合体系"},
    {"id": "pb-gap", "name": "纯铅常规带隙"},
    {"id": "sn-only", "name": "纯锡钙钛矿"},
    {"id": "pbs-qd", "name": "硫化铅量子点"},
    {"id": "wide-gap", "name": "宽带隙钙钛矿"},
    {"id": "perovskite-module", "name": "钙钛矿模组"},
    {"id": "perovskite-led", "name": "钙钛矿LED"},
    {"id": "perovskite-detector", "name": "钙钛矿探测器"},
    {"id": "perovskite-ferroelectric", "name": "钙钛矿铁电"},
    {"id": "perovskite-thermoelectric", "name": "钙钛矿热电"},
    {"id": "solid-state-battery", "name": "固态储能电池"},
    {"id": "llm", "name": "大语言模型"},
    {"id": "semiconductor", "name": "半导体先进工艺"},
    {"id": "other", "name": "其他方向"},
]
SYSTEM_NAMES = {item["id"]: item["name"] for item in SYSTEMS}

METRIC_LABELS = [
    ("pce", ("pce", "efficiency", "eff", "效率")),
    ("voc", ("voc", "v_oc", "v-oc", "open voltage", "开路电压", "开压")),
    ("jsc", ("jsc", "j_sc", "j-sc", "current density", "电流密度")),
    ("ff", ("ff", "fill factor", "填充因子")),
]
METRIC_NAMES = {"pce": "PCE", "voc": "开路电压", "jsc": "短路电流密度", "ff": "填充因子"}


def now_iso():
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def lan_address():
    probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        probe.connect(("192.0.2.1", 1))
        address = probe.getsockname()[0]
        return address if address != "0.0.0.0" else "127.0.0.1"
    except OSError:
        return "127.0.0.1"
    finally:
        probe.close()


def empty_db():
    return {
        "hygieneRecords": [],
        "maintenanceRecords": [],
        "library": [],
        "labRecords": [],
        "literature": [],
        "dutyRoster": [],
        "ideas": [],
        "trash": [],
    }


def read_db():
    STORAGE.mkdir(parents=True, exist_ok=True)
    if not DB_PATH.exists():
        return empty_db()
    try:
        value = json.loads(DB_PATH.read_text(encoding="utf-8"))
        return {
            "hygieneRecords": value.get("hygieneRecords", []),
            "maintenanceRecords": value.get("maintenanceRecords", []),
            "library": value.get("library", []),
            "labRecords": value.get("labRecords", []),
            "literature": value.get("literature", []),
            "dutyRoster": value.get("dutyRoster", []),
            "ideas": value.get("ideas", []),
            "trash": value.get("trash", []),
        }
    except (OSError, ValueError):
        return empty_db()


def save_db(db):
    STORAGE.mkdir(parents=True, exist_ok=True)
    temp_path = DB_PATH.with_suffix(".tmp")
    temp_path.write_text(json.dumps(db, ensure_ascii=False, indent=2), encoding="utf-8")
    temp_path.replace(DB_PATH)


IDEA_UPVOTE_THRESHOLD = 5
IDEA_QUIET_HOURS = 48


def idea_status(idea):
    if idea.get("done"):
        return "done"
    upvotes = len(idea.get("upvotes") or [])
    downvotes = len(idea.get("downvotes") or [])
    if upvotes >= IDEA_UPVOTE_THRESHOLD:
        return "approved"
    created = idea.get("createdAt") or ""
    try:
        created_at = datetime.fromisoformat(created)
    except (TypeError, ValueError):
        return "open"
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    age = datetime.now(timezone.utc) - created_at
    if downvotes == 0 and age >= timedelta(hours=IDEA_QUIET_HOURS):
        return "approved"
    return "open"


def idea_view(idea):
    view = dict(idea)
    view["status"] = idea_status(idea)
    view["upvoteCount"] = len(idea.get("upvotes") or [])
    view["downvoteCount"] = len(idea.get("downvotes") or [])
    return view


def read_research():
    if not IMPORT_PATH.exists():
        return {"available": False, "message": "尚未找到导入的 JV 样例数据。"}
    try:
        raw = json.loads(IMPORT_PATH.read_text(encoding="utf-8"))
        summary = raw.get("summary", {})
        pairs = raw.get("candidate_pairs", [])
        scans = raw.get("scans", [])
        pair = next((item for item in pairs if item.get("pair_sequence") == 10), None)
        anomaly = None
        if pair:
            scan_map = {item.get("scan_id"): item for item in scans}
            forward = scan_map.get(pair.get("forward_scan_id"), {}).get("normalized", {})
            reverse = scan_map.get(pair.get("reverse_scan_id"), {}).get("normalized", {})
            if forward and reverse:
                anomaly = {
                    "sequence": pair.get("pair_sequence"),
                    "channel": pair.get("channel"),
                    "forwardPce": forward.get("pce_percent"),
                    "reversePce": reverse.get("pce_percent"),
                    "difference": abs(forward.get("pce_percent", 0) - reverse.get("pce_percent", 0)),
                    "timestamp": pair.get("timestamp_local"),
                }
        source = raw.get("source", {})
        scans_compact = []
        for scan in scans:
            n = scan.get("normalized") or {}
            ff = n.get("ff_fraction")
            scans_compact.append({
                "t": scan.get("timestamp_local"),
                "d": scan.get("direction"),
                "ch": scan.get("channel"),
                "pce": n.get("pce_percent"),
                "voc": n.get("voc_v"),
                "jsc": n.get("jsc_ma_cm2"),
                "ff": (ff * 100) if isinstance(ff, (int, float)) else None,
            })
        return {
            "available": True,
            "sourceName": source.get("name", "260930-T.csv"),
            "sha256": source.get("sha256", ""),
            "rows": source.get("rows"),
            "columns": source.get("columns"),
            "summary": summary,
            "anomaly": anomaly,
            "scans": scans_compact,
            "reportAvailable": REPORT_PATH.exists(),
        }
    except (OSError, ValueError):
        return {"available": False, "message": "JV 样例数据暂时无法读取。"}


def clean_text(value, limit=500):
    return str(value or "").strip()[:limit]


def decode_data_url(value, accepted_types, limit):
    match = re.fullmatch(r"data:([^;,]+);base64,([A-Za-z0-9+/=\r\n]+)", str(value or ""))
    if not match or match.group(1) not in accepted_types:
        raise ValueError("文件格式不受支持。")
    try:
        content = base64.b64decode(match.group(2), validate=True)
    except (ValueError, base64.binascii.Error):
        raise ValueError("文件内容无法读取。")
    if not content or len(content) > limit:
        raise ValueError("文件为空或超过大小限制。")
    return match.group(1), content


def week_start_iso(offset_weeks=0):
    today = datetime.now().astimezone().date()
    monday = today - timedelta(days=today.weekday())
    if offset_weeks:
        monday = monday + timedelta(weeks=offset_weeks)
    return monday.isoformat()


def current_duty(db):
    start = week_start_iso()
    entry = next((item for item in db["dutyRoster"] if item.get("weekStart") == start), None)
    weeks = sorted(db["dutyRoster"], key=lambda item: str(item.get("weekStart", "")))[-8:]
    return {"weekStart": start, "entry": entry, "weeks": weeks}


def normalize_terms(values):
    if isinstance(values, str):
        values = [values]
    terms = []
    for value in values or []:
        for term in re.split(r"[,，、;；\s]+", str(value)):
            term = term.strip().strip("#")
            if 1 < len(term) <= 16 and term not in terms:
                terms.append(term)
            if len(terms) >= 12:
                return terms
    return terms


def metric_key(column):
    lowered = str(column).strip().lower().replace(" ", "_")
    for key, hints in METRIC_LABELS:
        for hint in hints:
            if hint in lowered:
                return key
    return None


def parse_number(value):
    text = str(value).strip().replace("%", "")
    if not text:
        return None
    try:
        number = float(text)
    except ValueError:
        return None
    if number != number or number in (float("inf"), float("-inf")):
        return None
    return number


def summarize_raw_file(name, content):
    """Return table shape and per-column averages; raw rows never leave the Mac Mini."""
    info = {"name": name, "bytes": len(content), "rows": None, "columns": [], "means": {}}
    if len(content) > 2 * 1024 * 1024:
        info["skipped"] = "文件较大，仅保存原件"
        return info
    text = None
    for encoding in ("utf-8-sig", "utf-8", "gbk"):
        try:
            text = content.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    if text is None or "\x00" in text:
        info["skipped"] = "非文本表格，仅保存原件"
        return info
    lines = [line for line in text.splitlines()[:6000] if line.strip()]
    if not lines:
        info["skipped"] = "文件为空"
        return info
    delimiter = next((candidate for candidate in (",", "\t", ";") if lines[0].count(candidate) >= 1), None)
    if delimiter is None:
        info["rows"] = len(lines)
        return info
    table = [[cell.strip() for cell in line.split(delimiter)] for line in lines]
    header = table[0]
    numeric_header = all(parse_number(cell) is not None for cell in header if cell)
    if numeric_header:
        columns = ["列%d" % (index + 1) for index in range(len(header))]
        data_rows = table
    else:
        columns = [cell or "列%d" % (index + 1) for index, cell in enumerate(header)]
        data_rows = table[1:]
    sums = {}
    counts = {}
    for row in data_rows:
        for index, cell in enumerate(row):
            if index >= len(columns):
                break
            number = parse_number(cell)
            if number is None:
                continue
            sums[index] = sums.get(index, 0.0) + number
            counts[index] = counts.get(index, 0) + 1
    info["rows"] = len(data_rows)
    info["columns"] = columns[:16]
    means = {}
    for index in range(min(len(columns), 16)):
        if counts.get(index):
            means[columns[index]] = round(sums[index] / counts[index], 6)
    info["means"] = means
    return info


def metric_averages(file_stats):
    averages = {}
    for info in file_stats or []:
        for column, mean in (info.get("means") or {}).items():
            key = metric_key(column)
            if key and key not in averages:
                averages[key] = mean
    return averages


def compare_metrics(current, previous):
    deltas = {}
    for key, value in current.items():
        old = (previous or {}).get(key)
        if old in (None, 0):
            continue
        change = (value - old) / abs(old) * 100
        if abs(change) < 1.5:
            label = "基本持平"
        elif change > 0:
            label = "有所提升"
        else:
            label = "有所下降"
        deltas[key] = {"name": METRIC_NAMES.get(key, key), "direction": label, "percent": round(change, 1)}
    return deltas


def fallback_analysis(record, deltas):
    system = SYSTEM_NAMES.get(record.get("system"), "该方向")
    parts = []
    if deltas:
        changed = [item for item in deltas.values() if item["direction"] != "基本持平"]
        if changed:
            labels = "、".join("%s%s" % (item["name"], item["direction"]) for item in changed)
            parts.append("与上一次同方向记录相比，%s。" % labels)
        else:
            parts.append("与上一次同方向记录相比，各项指标变化不大。")
    conditions = clean_text(record.get("conditions"), 200)
    summary = "%s的新记录已归档%s。" % (system, ("，条件为：" + conditions) if conditions else "")
    trend = " ".join(parts) or "暂无可比较的历史记录，先保留本次条件与原始数据，后续同条件复测后再看趋势。"
    return {
        "summary": summary,
        "trend": trend,
        "keywords": normalize_terms([system, *re.split(r"[，,、\s]+", conditions)])[:8],
        "deltas": deltas,
        "source": "local",
    }


def _llm_request(base_url, model, api_key, messages, max_tokens, timeout):
    endpoint = base_url.rstrip("/")
    native_ollama = endpoint.endswith("/api") or endpoint.endswith("/api/chat")
    if endpoint.endswith("/api"):
        endpoint += "/chat"
    elif not native_ollama and not endpoint.endswith("/chat/completions"):
        endpoint += "/chat/completions"
    request_data = {"model": model, "messages": messages, "think": False, "stream": False}
    if native_ollama:
        request_data["options"] = {"num_predict": max_tokens, "temperature": 0.2}
    else:
        request_data.update({"max_tokens": max_tokens, "temperature": 0.2})
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = "Bearer " + api_key
    request = urllib.request.Request(endpoint, data=json.dumps(request_data).encode("utf-8"), headers=headers, method="POST")
    with urllib.request.urlopen(request, timeout=timeout) as response:
        result = json.loads(response.read(4 * 1024 * 1024).decode("utf-8"))
    if native_ollama:
        return (result.get("message", {}) or {}).get("content", "")
    return (result.get("choices", [{}])[0].get("message", {}) or {}).get("content", "")


def llm_complete(messages, max_tokens=700, timeout=90, prefer="primary"):
    primary = (LLM_BASE_URL, LLM_MODEL, LLM_API_KEY, timeout) if (LLM_BASE_URL and LLM_MODEL) else None
    fallback = (LLM_FALLBACK_BASE_URL, LLM_FALLBACK_MODEL, LLM_FALLBACK_API_KEY, max(timeout, 180)) if (LLM_FALLBACK_BASE_URL and LLM_FALLBACK_MODEL) else None
    providers = []
    if prefer == "fallback":
        providers = [item for item in (fallback, primary) if item]
    else:
        providers = [item for item in (primary, fallback) if item]
    if not providers:
        return None
    last_error = None
    for base_url, model, api_key, limit in providers:
        try:
            return _llm_request(base_url, model, api_key, messages, max_tokens, limit)
        except Exception as exc:
            last_error = exc
            print("Model call failed (%s): %s" % (model, exc))
    if last_error is not None:
        raise last_error
    return None


def literature_keys(fields):
    doi = (fields.get("doi") or "").strip().lower()
    link = (fields.get("link") or "").strip().lower()
    title = re.sub(r"\s+", "", (fields.get("title") or "").lower())
    return doi, link, title


def upsert_literature(db, fields, entry_id=""):
    doi, link, title = literature_keys(fields)
    existing = None
    if entry_id:
        existing = next((item for item in db["literature"] if item.get("id") == entry_id), None)
    if existing is None:
        for item in db["literature"]:
            other_doi, other_link, other_title = literature_keys(item)
            if doi and other_doi and doi == other_doi:
                existing = item
                break
            if link and other_link and link == other_link:
                existing = item
                break
            if not doi and not link and title and title == other_title:
                existing = item
                break
    if existing is not None:
        for key, value in fields.items():
            if value is None:
                continue
            if key == "person" and value == "" and existing.get("person"):
                continue
            existing[key] = value
        existing["updatedAt"] = now_iso()
        return existing, False
    item = {
        "id": entry_id or str(uuid.uuid4()),
        **{key: value for key, value in fields.items() if value is not None},
        "createdAt": now_iso(),
        "updatedAt": now_iso(),
    }
    db["literature"].insert(0, item)
    return item, True


def parse_json_value(text):
    raw = str(text or "").strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```[a-zA-Z]*\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    try:
        return json.loads(raw)
    except ValueError:
        pass
    for opener, closer in (("[", "]"), ("{", "}")):
        start = raw.find(opener)
        end = raw.rfind(closer)
        if start >= 0 and end > start:
            try:
                return json.loads(raw[start:end + 1])
            except ValueError:
                continue
    return None


CJK_RE = re.compile(r"[\u4e00-\u9fa5]")


def cjk_ratio(text):
    text = str(text or "")
    if not text:
        return 0.0
    letters = [ch for ch in text if ch.isalpha() or CJK_RE.match(ch)]
    if not letters:
        return 0.0
    return len(CJK_RE.findall(text)) / len(letters)


def trim_fabrication(raw):
    text = str(raw or "")
    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return [{"n": str(step.get("n", ""))[:120], "d": str(step.get("d", ""))[:600]}
                    for step in parsed[:8] if isinstance(step, dict)]
    except ValueError:
        pass
    return [{"n": "Fabrication", "d": text[:1500]}] if text else []


def salvage_json_array(text):
    raw = str(text or "").strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```[a-zA-Z]*\s*", "", raw)
    start = raw.find("[")
    if start < 0:
        return []
    body = raw[start + 1:]
    index = body.rfind("}")
    while index > 0:
        try:
            value = json.loads("[" + body[:index + 1] + "]")
            if isinstance(value, list):
                return value
        except ValueError:
            pass
        index = body.rfind("}", 0, index)
    return []


def parse_json_object(text):
    raw = str(text or "").strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```[a-zA-Z]*\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    try:
        value = json.loads(raw)
        return value if isinstance(value, dict) else None
    except ValueError:
        pass
    start = raw.find("{")
    end = raw.rfind("}")
    if start >= 0 and end > start:
        try:
            value = json.loads(raw[start:end + 1])
            return value if isinstance(value, dict) else None
        except ValueError:
            return None
    return None


def parse_analysis(text):
    parsed = {"summary": "", "trend": "", "keywords": []}
    for line in str(text or "").splitlines():
        line = line.strip().lstrip("-*").strip()
        if not line:
            continue
        for prefix, key in (("摘要", "summary"), ("趋势", "trend"), ("关键词", "keywords")):
            if line.startswith(prefix):
                value = line[len(prefix):].lstrip("：: ").strip()
                if key == "keywords":
                    parsed["keywords"] = normalize_terms([value])
                else:
                    parsed[key] = value
    return parsed


def analyze_record(record, db, use_llm=True):
    stats = record.get("fileStats") or []
    current = metric_averages(stats)
    same_system = [item for item in db["labRecords"]
                   if item.get("id") != record.get("id") and item.get("system") == record.get("system")]
    same_system.sort(key=lambda item: str(item.get("createdAt", "")), reverse=True)
    previous = {}
    for item in same_system:
        candidate = metric_averages(item.get("fileStats"))
        if candidate:
            previous = candidate
            break
    deltas = compare_metrics(current, previous)
    result = fallback_analysis(record, deltas)
    if use_llm and LLM_BASE_URL and LLM_MODEL:
        condition_text = clean_text(record.get("conditions"), 1200)
        transcript = clean_text(record.get("transcript"), 1200)
        delta_text = "、".join("%s%s" % (item["name"], item["direction"]) for item in deltas.values()) or "无历史可比数据"
        prompt = (
            "你是课题组的实验记录助手。请根据下面这次太阳能电池测试的口述条件和与上一次同方向记录的趋势对比，写一段给组内看的简短反馈。\n"
            "要求：只描述方向性趋势（提升、下降、基本持平）和可能相关的条件差异，不要写出任何具体数值、百分比或原始数据；"
            "不确定的地方直接说不确定，不要编造机理或结论；中文，摘要不超过 60 字，趋势不超过 100 字。\n"
            "输出三行，格式严格为：\n摘要：...\n趋势：...\n关键词：词1、词2、词3\n\n"
            "方向：%s\n本次条件：%s\n口述记录：%s\n与上次对比：%s\n文件概况：%s"
        ) % (
            SYSTEM_NAMES.get(record.get("system"), "未指定"),
            condition_text or "未填写",
            transcript or "无",
            delta_text,
            json.dumps([{ "name": item.get("name"), "rows": item.get("rows"), "columns": item.get("columns")} for item in stats], ensure_ascii=False),
        )
        try:
            answer = llm_complete([
                {"role": "system", "content": "你是严谨的实验记录助手，只做定性归纳，绝不编造数据或机理。"},
                {"role": "user", "content": prompt},
            ])
            parsed = parse_analysis(answer)
            if parsed["summary"] or parsed["trend"]:
                result.update({
                    "summary": parsed["summary"] or result["summary"],
                    "trend": parsed["trend"] or result["trend"],
                    "keywords": parsed["keywords"] or result["keywords"],
                    "source": "llm",
                })
        except (OSError, ValueError, KeyError, IndexError, urllib.error.URLError) as exc:
            print("Analysis model failed: %s" % exc)
    result["deltas"] = deltas
    result["createdAt"] = now_iso()
    return result


def aggregate_topics(db):
    entries = []
    for record in db["labRecords"]:
        analysis = record.get("analysis") or {}
        entries.append((record.get("createdAt"), record.get("system"), analysis.get("keywords") or record.get("keywords") or []))
    for item in db["literature"]:
        entries.append((item.get("createdAt"), item.get("system"), item.get("keywords") or []))
    now = datetime.now(timezone.utc)
    buckets = {}
    for created_at, system, keywords in entries:
        try:
            moment = datetime.fromisoformat(str(created_at))
        except ValueError:
            continue
        if moment.tzinfo is None:
            moment = moment.replace(tzinfo=timezone.utc)
        age_days = (now - moment.astimezone(timezone.utc)).days
        for term in normalize_terms(keywords):
            bucket = buckets.setdefault(term, {"term": term, "count": 0, "recent": 0, "systems": set(), "weeks": [0] * 8, "lastAt": created_at})
            if age_days <= 30:
                bucket["count"] += 1
            if age_days <= 7:
                bucket["recent"] += 1
            if system:
                bucket["systems"].add(SYSTEM_NAMES.get(system, system))
            week_index = min(7, age_days // 7)
            bucket["weeks"][7 - week_index] += 1
            if str(created_at) > str(bucket["lastAt"]):
                bucket["lastAt"] = created_at
    topics = []
    for bucket in buckets.values():
        bucket["systems"] = sorted(bucket["systems"])
        topics.append(bucket)
    topics.sort(key=lambda item: (-item["count"], -item["recent"], item["term"]))
    return topics[:12]


class Handler(BaseHTTPRequestHandler):
    server_version = "LabWorkspace/0.1"

    def setup(self):
        super().setup()
        self.connection.settimeout(30)

    def log_message(self, fmt, *args):
        print("[%s] %s" % (self.log_date_time_string(), fmt % args))

    def send_bytes(self, status, content, content_type, extra_headers=None):
        accepts_gzip = "gzip" in (self.headers.get("Accept-Encoding") or "").lower()
        if accepts_gzip and len(content) > 1400 and not (extra_headers or {}).get("Content-Encoding"):
            content = gzip.compress(content, 6)
            extra_headers = dict(extra_headers or {})
            extra_headers["Content-Encoding"] = "gzip"
            extra_headers["Vary"] = "Accept-Encoding"
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Permissions-Policy", "camera=(self), microphone=(self), geolocation=()")
        if self.path.startswith("/wbg"):
            csp = "default-src 'self'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'"
        else:
            csp = "default-src 'self'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'"
        self.send_header("Content-Security-Policy", csp)
        self.send_header("Cache-Control", "no-store")
        if extra_headers:
            for name, value in extra_headers.items():
                self.send_header(name, value)
        self.end_headers()
        self.wfile.write(content)

    def send_file(self, status, file_path, content_type, extra_headers=None):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(file_path.stat().st_size))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cache-Control", "private, no-store")
        if extra_headers:
            for name, value in extra_headers.items():
                self.send_header(name, value)
        self.end_headers()
        with file_path.open("rb") as source:
            while True:
                chunk = source.read(1024 * 1024)
                if not chunk:
                    break
                self.wfile.write(chunk)

    def send_json(self, status, payload, extra_headers=None):
        content = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_bytes(status, content, "application/json; charset=utf-8", extra_headers)

    def client_key(self):
        forwarded = self.headers.get("CF-Connecting-IP", "").strip()
        if forwarded:
            try:
                return str(ipaddress.ip_address(forwarded))
            except ValueError:
                pass
        return self.client_address[0]

    def require_token(self):
        client = self.client_key()
        now = time.monotonic()
        with AUTH_LOCK:
            recent = [stamp for stamp in AUTH_FAILURES.get(client, []) if now - stamp < AUTH_WINDOW_SECONDS]
            if len(recent) >= AUTH_FAILURE_LIMIT:
                AUTH_FAILURES[client] = recent
                self.send_json(429, {"error": "访问码尝试次数过多，请稍后再试。"})
                return False
        supplied = self.headers.get("Authorization", "")
        if not hmac.compare_digest(supplied, "Bearer " + TOKEN):
            with AUTH_LOCK:
                recent.append(now)
                AUTH_FAILURES[client] = recent
            self.send_json(401, {"error": "访问码不正确或已过期，请重新连接实验室服务。"})
            return False
        with AUTH_LOCK:
            AUTH_FAILURES.pop(client, None)
        return True

    def read_json(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            raise ValueError("请求长度无效。")
        if length <= 0 or length > MAX_BODY:
            raise ValueError("请求为空或超过上传限制。")
        if not self.headers.get("Content-Type", "").startswith("application/json"):
            raise ValueError("请求格式无效。")
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, ValueError):
            raise ValueError("请求内容无法解析。")

    def do_GET(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        if path == "/downloads/ninglab-labdesk-debug.apk":
            file_path = DOWNLOADS / "ninglab-labdesk-debug.apk"
            if not file_path.is_file():
                self.send_error(404)
                return
            self.send_file(200, file_path, "application/vnd.android.package-archive", {
                "Content-Disposition": "attachment; filename=ninglab-labdesk.apk",
            })
            return
        if path.startswith("/api/") and not self.require_token():
            return
        if path == "/api/state":
            try:
                info = DB_PATH.stat()
                etag = 'W/"%d-%d"' % (int(info.st_mtime), info.st_size)
            except OSError:
                etag = ""
            if etag and self.headers.get("If-None-Match") == etag:
                self.send_response(304)
                self.send_header("ETag", etag)
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                return
            with LOCK:
                db = read_db()
            self.send_json(200, {
                "zones": ZONES,
                "hygieneRecords": db["hygieneRecords"],
                "maintenanceRecords": db["maintenanceRecords"],
                "library": db["library"],
                "labRecords": db["labRecords"],
                "literature": db["literature"],
                "ideas": [idea_view(item) for item in db.get("ideas", [])],
                "trash": db.get("trash", []),
                "systems": SYSTEMS,
                "workshop": WORKSHOP,
                "duty": current_duty(db),
                "topics": aggregate_topics(db),
                "research": read_research(),
                "llm": {
                    "configured": bool(LLM_BASE_URL and LLM_MODEL),
                    "model": LLM_MODEL if LLM_BASE_URL else "",
                    "remote": bool(LLM_BASE_URL) and not LLM_BASE_URL.startswith("http://127.0.0.1"),
                    "fallback": LLM_FALLBACK_MODEL,
                    "analysis": bool(LLM_BASE_URL and LLM_MODEL),
                },
                "pdf": {"ready": PDF_READY},
                "asr": {
                    "ready": ASR_READY,
                    "model": Path(ASR_MODEL).name if ASR_READY else "",
                },
            }, {"ETag": etag})
            return
        if path == "/api/research-note":
            if not REPORT_PATH.exists():
                self.send_error(404)
                return
            content = REPORT_PATH.read_bytes()
            self.send_bytes(200, content, "text/markdown; charset=utf-8", {"Content-Disposition": "attachment; filename*=UTF-8''lab-research-note.md"})
            return
        if path.startswith("/api/media/"):
            media_id = path.rsplit("/", 1)[-1]
            if not re.fullmatch(r"[a-f0-9-]{36}\.(?:jpg|png|webp)", media_id):
                self.send_error(404)
                return
            file_path = UPLOADS / media_id
            if not file_path.is_file():
                self.send_error(404)
                return
            content_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
            self.send_file(200, file_path, content_type)
            return
        if path.startswith("/api/library/file/"):
            item_id = path.rsplit("/", 1)[-1]
            with LOCK:
                db = read_db()
            item = next((entry for entry in db["library"] if entry.get("id") == item_id), None)
            if not item:
                self.send_error(404)
                return
            file_path = LIBRARY / item.get("storedName", "")
            if not file_path.is_file():
                self.send_error(404)
                return
            self.send_file(200, file_path, "application/pdf", {"Content-Disposition": "inline; filename*=UTF-8''document.pdf"})
            return
        if path == "/api/archive/manifest":
            with LOCK:
                db = read_db()
            records = []
            for record in db.get("labRecords", []):
                record_id = record.get("id", "")
                files = []
                for index, item in enumerate(record.get("files") or []):
                    stored = LABDATA / record_id / item.get("storedName", "")
                    size = stored.stat().st_size if stored.is_file() else 0
                    files.append({
                        "index": index,
                        "name": item.get("name", ""),
                        "size": size,
                        "url": "/api/lab-data/%s/%d" % (record_id, index),
                    })
                records.append({
                    "id": record_id,
                    "system": record.get("system", ""),
                    "systemName": SYSTEM_NAMES.get(record.get("system"), record.get("system", "")),
                    "person": record.get("person", ""),
                    "createdAt": record.get("createdAt", ""),
                    "conditions": clean_text(record.get("conditions"), 400),
                    "files": files,
                })
            library = []
            for item in db.get("library", []):
                stored = LIBRARY / item.get("storedName", "")
                library.append({
                    "id": item.get("id", ""),
                    "title": item.get("title", ""),
                    "name": item.get("storedName", ""),
                    "bytes": stored.stat().st_size if stored.is_file() else int(item.get("bytes") or 0),
                    "url": "/api/library/file/%s" % item.get("id", ""),
                })
            records.sort(key=lambda row: row.get("createdAt", ""), reverse=True)
            self.send_json(200, {
                "generatedAt": now_iso(),
                "server": "app.nzjlab.cn",
                "counts": {
                    "records": len(records),
                    "files": sum(len(row["files"]) for row in records),
                    "library": len(library),
                },
                "records": records,
                "library": library,
            })
            return
        if path == "/api/ideas/export":
            with LOCK:
                db = read_db()
            approved = [idea_view(item) for item in db.get("ideas", [])
                        if item.get("kind", "idea") == "idea" and idea_status(item) == "approved"]
            approved.sort(key=lambda item: item.get("createdAt", ""))
            lines = ["# 待实现的团队想法", ""]
            if not approved:
                lines.append("（暂无达到条件的想法：需要 5 个赞，或发布满 48 小时且无人反对。）")
            for index, idea in enumerate(approved, 1):
                lines.append("## %d. %s" % (index, idea.get("title", "")))
                lines.append("")
                lines.append("- 提出人：%s" % idea.get("author", ""))
                lines.append("- 提出时间：%s" % (idea.get("createdAt", "")[:10]))
                lines.append("- 支持 %d / 反对 %d" % (idea.get("upvoteCount", 0), idea.get("downvoteCount", 0)))
                if idea.get("body"):
                    lines.append("")
                    lines.append(idea["body"])
                lines.append("")
            self.send_bytes(200, ("\n".join(lines) + "\n").encode("utf-8"), "text/markdown; charset=utf-8")
            return
        if path.startswith("/api/lab-data/"):
            parts = path.split("/")
            if len(parts) != 5:
                self.send_error(404)
                return
            record_id, index_text = parts[3], parts[4]
            with LOCK:
                db = read_db()
            record = next((item for item in db["labRecords"] if item.get("id") == record_id), None)
            files = (record or {}).get("files") or []
            try:
                item = files[int(index_text)]
            except (ValueError, IndexError):
                self.send_error(404)
                return
            file_path = LABDATA / record_id / item.get("storedName", "")
            if not file_path.is_file():
                self.send_error(404)
                return
            content_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
            self.send_file(200, file_path, content_type, {
                "Content-Disposition": "attachment; filename*=UTF-8''%s" % urllib.parse.quote(item.get("name", "data")),
            })
            return
        if path.startswith("/api/"):
            self.send_error(404)
            return
        relative = "index.html" if path == "/" else path.lstrip("/")
        candidate = (PUBLIC / relative).resolve()
        if not candidate.is_relative_to(PUBLIC.resolve()) or not candidate.is_file():
            self.send_error(404)
            return
        content_type = "application/manifest+json" if candidate.name.endswith(".webmanifest") else (mimetypes.guess_type(candidate.name)[0] or "application/octet-stream")
        charset = "; charset=utf-8" if content_type.startswith(("text/", "application/javascript", "application/manifest+json")) else ""
        self.send_bytes(200, candidate.read_bytes(), content_type + charset)

    def do_POST(self):
        path = urlparse(self.path).path
        if not self.require_token():
            return
        try:
            body = self.read_json()
            if path == "/api/records":
                self.create_record(body)
            elif path == "/api/library":
                self.create_library_item(body)
            elif path == "/api/assistant":
                self.ask_assistant(body)
            elif path == "/api/lab-records":
                self.create_lab_record(body)
            elif path == "/api/lab-records/analyze":
                self.analyze_lab_record(body)
            elif path == "/api/lab-records/delete":
                self.delete_entry("labRecords", body)
            elif path == "/api/literature":
                self.save_literature(body)
            elif path == "/api/literature/extract":
                self.extract_literature(body)
            elif path == "/api/literature/import":
                self.import_literature(body)
            elif path == "/api/literature/translate":
                self.translate_literature(body)
            elif path == "/api/literature/link":
                self.patch_literature_link(body)
            elif path == "/api/literature/delete":
                self.delete_entry("literature", body)
            elif path == "/api/duty":
                self.save_duty(body)
            elif path == "/api/ideas":
                self.save_idea(body)
            elif path == "/api/ideas/vote":
                self.vote_idea(body)
            elif path == "/api/ideas/delete":
                self.delete_entry("ideas", body)
            elif path == "/api/trash/restore":
                self.restore_trash(body)
            elif path == "/api/trash/purge":
                self.purge_trash(body)
            elif path == "/api/ideas/done":
                self.mark_idea_done(body)
            elif path == "/api/transcribe":
                self.transcribe_audio(body)
            else:
                self.send_error(404)
        except ValueError as exc:
            self.send_json(400, {"error": str(exc)})
        except Exception as exc:
            print("Request failed: %s" % exc)
            self.send_json(500, {"error": "保存失败，请检查服务器磁盘空间后重试。"})

    def create_record(self, body):
        kind = clean_text(body.get("kind"), 32)
        target = clean_text(body.get("target"), 100)
        person = clean_text(body.get("person"), 100)
        note = clean_text(body.get("note"), 800)
        if kind not in ("hygiene", "maintenance") or not target or not person:
            raise ValueError("请选择项目并填写记录人。")
        expected_type = "area" if kind == "hygiene" else "device"
        allowed_targets = {zone["id"] for zone in ZONES if zone["type"] == expected_type}
        if target not in allowed_targets:
            raise ValueError("所选项目与记录类型不匹配。")
        photo_values = body.get("photos")
        if photo_values is None:
            photo_values = [body.get("photo")]
        if not isinstance(photo_values, list) or not 1 <= len(photo_values) <= 5:
            raise ValueError("每条记录需要上传 1 到 5 张照片。")
        decoded_photos = [decode_data_url(value, PHOTO_TYPES, MAX_PHOTO) for value in photo_values]
        if sum(len(content) for _, content in decoded_photos) > 30 * 1024 * 1024:
            raise ValueError("所有照片合计不能超过 30 MB。")
        for mime, content in decoded_photos:
            if mime == "image/jpeg" and not content.startswith(b"\xff\xd8\xff"):
                raise ValueError("JPEG 照片内容无效。")
            if mime == "image/png" and not content.startswith(b"\x89PNG\r\n\x1a\n"):
                raise ValueError("PNG 照片内容无效。")
            if mime == "image/webp" and not (content.startswith(b"RIFF") and content[8:12] == b"WEBP"):
                raise ValueError("WebP 照片内容无效。")
        UPLOADS.mkdir(parents=True, exist_ok=True)
        file_names = []
        try:
            for mime, content in decoded_photos:
                file_name = str(uuid.uuid4()) + PHOTO_TYPES[mime]
                (UPLOADS / file_name).write_bytes(content)
                file_names.append(file_name)
        except OSError:
            for file_name in file_names:
                (UPLOADS / file_name).unlink(missing_ok=True)
            raise
        record = {
            "id": str(uuid.uuid4()),
            "kind": kind,
            "target": target,
            "person": person,
            "note": note,
            "photo": file_names[0],
            "photos": file_names,
            "createdAt": now_iso(),
        }
        key = "hygieneRecords" if kind == "hygiene" else "maintenanceRecords"
        with LOCK:
            db = read_db()
            db[key].insert(0, record)
            save_db(db)
        self.send_json(201, {"record": record})

    def create_library_item(self, body):
        title = clean_text(body.get("title"), 180)
        note = clean_text(body.get("note"), 800)
        original_name = Path(clean_text(body.get("name"), 180)).name
        if not original_name.lower().endswith(".pdf"):
            raise ValueError("请上传 PDF 文件。")
        mime, content = decode_data_url(body.get("file"), {"application/pdf"}, MAX_PDF)
        if not content.startswith(b"%PDF"):
            raise ValueError("文件内容不是有效的 PDF。")
        LIBRARY.mkdir(parents=True, exist_ok=True)
        item_id = str(uuid.uuid4())
        stored_name = item_id + ".pdf"
        (LIBRARY / stored_name).write_bytes(content)
        item = {
            "id": item_id,
            "title": title or original_name,
            "name": original_name,
            "note": note,
            "storedName": stored_name,
            "bytes": len(content),
            "createdAt": now_iso(),
        }
        with LOCK:
            db = read_db()
            db["library"].insert(0, item)
            save_db(db)
        self.send_json(201, {"item": item})

    def create_lab_record(self, body):
        system = clean_text(body.get("system"), 40)
        person = clean_text(body.get("person"), 100)
        conditions = clean_text(body.get("conditions"), 1200)
        transcript = clean_text(body.get("transcript"), 2000)
        if system not in SYSTEM_NAMES:
            raise ValueError("请选择材料方向。")
        if not person:
            raise ValueError("请填写记录人。")
        if not conditions and not transcript:
            raise ValueError("请填写或语音录入本次测试条件。")
        raw_files = body.get("files") or []
        if not isinstance(raw_files, list) or len(raw_files) > 3:
            raise ValueError("每次最多上传 3 个原始数据文件。")
        record_id = str(uuid.uuid4())
        stored_dir = LABDATA / record_id
        files = []
        stats = []
        try:
            if raw_files:
                stored_dir.mkdir(parents=True, exist_ok=True)
            for index, item in enumerate(raw_files):
                if not isinstance(item, dict):
                    raise ValueError("原始数据格式无效。")
                name = Path(clean_text(item.get("name"), 180)).name
                suffix = Path(name).suffix.lower()
                if suffix not in RAW_SUFFIXES:
                    raise ValueError("原始数据仅支持 CSV、TXT、TSV、DAT、JSON、XLSX 文件。")
                mime, content = decode_data_url(item.get("data"), RAW_MIMES, MAX_RAW)
                stored_name = "%02d%s" % (index + 1, suffix)
                (stored_dir / stored_name).write_bytes(content)
                files.append({"name": name, "storedName": stored_name, "bytes": len(content)})
                stats.append(summarize_raw_file(name, content))
        except Exception:
            for leftover in (stored_dir.glob("*") if stored_dir.exists() else []):
                leftover.unlink(missing_ok=True)
            raise
        record = {
            "id": record_id,
            "system": system,
            "person": person,
            "conditions": conditions,
            "transcript": transcript,
            "files": files,
            "fileStats": stats,
            "analysis": None,
            "createdAt": now_iso(),
        }
        with LOCK:
            db = read_db()
            db["labRecords"].insert(0, record)
            try:
                record["analysis"] = analyze_record(record, db, use_llm=False)
            except Exception as exc:
                print("Analysis skipped: %s" % exc)
            save_db(db)
        self.send_json(201, {"record": record})

    def analyze_lab_record(self, body):
        record_id = clean_text(body.get("id"), 64)
        with LOCK:
            db = read_db()
            record = next((item for item in db["labRecords"] if item.get("id") == record_id), None)
            if not record:
                raise ValueError("找不到这条记录。")
            try:
                record["analysis"] = analyze_record(record, db)
            except Exception as exc:
                print("Analysis failed: %s" % exc)
                raise ValueError("分析暂时不可用，请稍后重试。")
            save_db(db)
        self.send_json(200, {"record": record})

    def translate_literature(self, body):
        limit = body.get("limit")
        try:
            limit = max(1, min(int(limit), 10)) if limit else 1
        except (TypeError, ValueError):
            limit = 1
        if not LLM_BASE_URL or not LLM_MODEL:
            self.send_json(503, {"error": "模型还没有配置。"})
            return
        only_id = clean_text(body.get("id"), 64)
        target = clean_text(body.get("target"), 4) or "en"
        with LOCK:
            db = read_db()
            if target == "zh":
                pending = [item for item in db["literature"]
                           if item.get("fabrication") and not item.get("zh")
                           and not item.get("zhSkipped") and cjk_ratio(item.get("fabrication")) < 0.05
                           and (not only_id or item.get("id") == only_id)]
            else:
                pending = [item for item in db["literature"] if not item.get("en")
                           and not item.get("translateSkipped")
                           and (not only_id or item.get("id") == only_id)]
        if not pending:
            self.send_json(200, {"translated": 0, "remaining": 0})
            return
        batch = pending[:limit]
        if target == "zh":
            prompt = (
                "把下面的英文器件制备流程翻译成中文，用于中文界面展示。只输出 JSON 数组，不要解释、不要代码块。\n"
                "每一项输出 {\"id\": 原 id, \"fabrication\": [{\"n\": 中文步骤名, \"d\": 中文说明}]}。\n"
                "要求：保留数字、单位、化学式、缩写（如 Sn-Pb、PCE、SAM、ITO、rpm、°C）；不要增删信息；每步不超过 40 字。\n\n"
                + json.dumps([
                    {"id": item.get("id"), "fabrication": trim_fabrication(item.get("fabrication", ""))}
                    for item in batch
                ], ensure_ascii=False)
            )
            try:
                answer = llm_complete(
                    [{"role": "system", "content": "你是学术翻译，只输出 JSON。"},
                     {"role": "user", "content": prompt}],
                    max_tokens=9000, timeout=360,
                )
            except Exception as exc:
                print("Translate(zh) failed: %s" % exc)
                self.send_json(502, {"error": "翻译暂时不可用。"})
                return
            parsed = parse_json_value(answer)
            if isinstance(parsed, dict):
                parsed = parsed.get("items") or parsed.get("data") or []
            if not isinstance(parsed, list):
                parsed = salvage_json_array(answer)
                if not parsed:
                    with LOCK:
                        fresh = read_db()
                        for entry in fresh["literature"]:
                            if entry.get("fabrication") and not entry.get("zh") and not entry.get("zhSkipped"):
                                entry["zhSkipped"] = True
                                break
                        save_db(fresh)
            updated = 0
            with LOCK:
                fresh = read_db()
                index = {entry.get("id"): entry for entry in fresh["literature"]}
                for entry in parsed:
                    if not isinstance(entry, dict):
                        continue
                    row = index.get(entry.get("id"))
                    if not row:
                        continue
                    steps = entry.get("fabrication")
                    if isinstance(steps, str):
                        try:
                            steps = json.loads(steps)
                        except ValueError:
                            steps = [{"n": "制备流程", "d": steps}]
                    if not isinstance(steps, list):
                        steps = []
                    row["zh"] = {
                        "fabrication": [
                            {"n": clean_text(step.get("n"), 200), "d": clean_text(step.get("d"), 3000)}
                            for step in steps if isinstance(step, dict)
                        ]
                    }
                    updated += 1
                save_db(fresh)
                remaining = sum(1 for item in fresh["literature"]
                                if item.get("fabrication") and not item.get("zh")
                                and not item.get("zhSkipped") and cjk_ratio(item.get("fabrication")) < 0.05)
            self.send_json(200, {"translated": updated, "remaining": remaining})
            return
        payload = [
            {
                "id": item.get("id"),
                "title": item.get("title", ""),
                "study_object": item.get("study_object", ""),
                "summary": item.get("summary", ""),
                "fabrication": trim_fabrication(item.get("fabrication", "")),
            }
            for item in batch
        ]
        prompt = (
            "把下面的文献条目翻译成英文，用于英文界面展示。只输出 JSON 数组，不要解释、不要代码块。\n"
            "每一项输出 {\"id\": 原 id, \"title\": 英文标题, \"study_object\": 英文研究对象, "
            "\"summary\": 英文摘要, \"fabrication\": [{\"n\": 英文步骤名, \"d\": 英文说明}]}。\n"
            "要求：保留数字、单位、化学式、缩写（如 Sn-Pb、PCE、SAM、ITO）；不要增删信息；"
            "fabrication 若原文是 JSON 数组，逐条翻译；若是长文本则按句拆成 3-8 步；每步英文不超过 25 词，可省略重复限定语。\n\n"
            + json.dumps(payload, ensure_ascii=False)
        )
        try:
            answer = llm_complete(
                [{"role": "system", "content": "你是学术翻译，只输出 JSON。"},
                 {"role": "user", "content": prompt}],
                max_tokens=9000, timeout=360,
            )
        except Exception as exc:
            print("Translate failed: %s" % exc)
            self.send_json(502, {"error": "翻译暂时不可用。"})
            return
        parsed = parse_json_value(answer)
        if isinstance(parsed, dict):
            parsed = parsed.get("items") or parsed.get("data") or parsed.get("results") or []
        if not isinstance(parsed, list):
            parsed = salvage_json_array(answer)
            if not parsed:
                print("Translate parse failed; answer head: %r" % str(answer)[:200])
                with LOCK:
                    fresh = read_db()
                    for entry in fresh["literature"]:
                        if not entry.get("en") and not entry.get("translateSkipped"):
                            entry["translateSkipped"] = True
                            break
                    save_db(fresh)
        updated = 0
        with LOCK:
            db = read_db()
            index = {item.get("id"): item for item in db["literature"]}
            for entry in parsed:
                if not isinstance(entry, dict):
                    continue
                item = index.get(entry.get("id"))
                if not item:
                    continue
                fabrication = entry.get("fabrication")
                if isinstance(fabrication, str):
                    try:
                        fabrication = json.loads(fabrication)
                    except ValueError:
                        fabrication = [{"n": "Fabrication", "d": fabrication}]
                if not isinstance(fabrication, list):
                    fabrication = []
                item["en"] = {
                    "title": clean_text(entry.get("title"), 300),
                    "study_object": clean_text(entry.get("study_object"), 300),
                    "summary": clean_text(entry.get("summary"), 5000),
                    "fabrication": [
                        {"n": clean_text(step.get("n"), 200), "d": clean_text(step.get("d"), 3000)}
                        for step in fabrication if isinstance(step, dict)
                    ],
                }
                updated += 1
            save_db(db)
            remaining = sum(1 for item in db["literature"] if not item.get("en"))
        self.send_json(200, {"translated": updated, "remaining": remaining})

    def patch_literature_link(self, body):
        entry_id = clean_text(body.get("id"), 64)
        link = clean_text(body.get("link"), 500)
        doi = clean_text(body.get("doi"), 200)
        if not entry_id:
            raise ValueError("缺少文献 id。")
        if link and not re.match(r"^https?://", link):
            link = "https://" + link
        if not link and doi:
            link = "https://doi.org/" + re.sub(r"^https?://(dx\.)?doi\.org/", "", doi, flags=re.IGNORECASE)
        if not link:
            raise ValueError("请提供链接或 DOI。")
        with LOCK:
            db = read_db()
            item = next((entry for entry in db["literature"] if entry.get("id") == entry_id), None)
            if not item:
                raise ValueError("找不到这条文献。")
            item["link"] = link
            if doi:
                item["doi"] = doi
            item["updatedAt"] = now_iso()
            save_db(db)
        self.send_json(200, {"item": item})

    def delete_entry(self, collection, body):
        entry_id = clean_text(body.get("id"), 64)
        with LOCK:
            db = read_db()
            removed = next((item for item in db[collection] if item.get("id") == entry_id), None)
            if removed is None:
                raise ValueError("找不到这条记录。")
            db[collection] = [item for item in db[collection] if item.get("id") != entry_id]
            db.setdefault("trash", []).insert(0, {
                "trashId": str(uuid.uuid4()),
                "collection": collection,
                "item": removed,
                "deletedAt": now_iso(),
            })
            if len(db["trash"]) > 500:
                db["trash"] = db["trash"][:500]
            save_db(db)
        self.send_json(200, {"ok": True, "trash": True})

    def restore_trash(self, body):
        trash_id = clean_text(body.get("id"), 64)
        with LOCK:
            db = read_db()
            entry = next((item for item in db.get("trash", []) if item.get("trashId") == trash_id), None)
            if not entry:
                raise ValueError("回收站里找不到这条。")
            collection = entry.get("collection")
            item = entry.get("item") or {}
            if collection not in ("literature", "labRecords", "ideas"):
                raise ValueError("这类内容暂不支持恢复。")
            bucket = db.setdefault(collection, [])
            if not any(existing.get("id") == item.get("id") for existing in bucket):
                bucket.insert(0, item)
            db["trash"] = [row for row in db["trash"] if row.get("trashId") != trash_id]
            save_db(db)
        self.send_json(200, {"ok": True})

    def purge_trash(self, body):
        trash_id = clean_text(body.get("id"), 64)
        with LOCK:
            db = read_db()
            entry = next((item for item in db.get("trash", []) if item.get("trashId") == trash_id), None)
            if not entry:
                raise ValueError("回收站里找不到这条。")
            db["trash"] = [row for row in db["trash"] if row.get("trashId") != trash_id]
            save_db(db)
        if entry.get("collection") == "labRecords":
            entry_id = (entry.get("item") or {}).get("id", "")
            target = LABDATA / entry_id
            if entry_id and target.exists():
                for leftover in target.glob("*"):
                    leftover.unlink(missing_ok=True)
                target.rmdir()
        self.send_json(200, {"ok": True})

    def transcribe_audio(self, body):
        if not ASR_READY:
            self.send_json(503, {"error": "这台服务器还没有配置语音识别，请直接输入文字。"})
            return
        raw = str(body.get("audio") or "")
        prefix = re.match(r"^data:audio/[a-z0-9.+-]+;base64,", raw, re.IGNORECASE)
        if not prefix:
            raise ValueError("录音格式不正确，请重试。")
        try:
            payload = base64.b64decode(raw[prefix.end():], validate=False)
        except (ValueError, TypeError):
            raise ValueError("录音数据无法解析，请重试。")
        if not payload:
            raise ValueError("没有收到录音，请再试一次。")
        if len(payload) > MAX_SPEECH:
            raise ValueError("录音太长，请分几次说。")
        temp_dir = STORAGE / "tmp"
        temp_dir.mkdir(parents=True, exist_ok=True)
        audio_path = temp_dir / ("speech-%s.wav" % uuid.uuid4().hex)
        audio_path.write_bytes(payload)
        try:
            with wave.open(str(audio_path), "rb") as handle:
                seconds = handle.getnframes() / float(handle.getframerate() or 1)
            if seconds < 0.4:
                self.send_json(200, {"text": "", "error": "录音太短，请说完再点一次。"})
                return
            if seconds > 120:
                raise ValueError("录音超过 2 分钟，请分几次说。")
            environment = dict(os.environ)
            environment.setdefault("HF_ENDPOINT", "https://hf-mirror.com")
            environment.setdefault("HF_HOME", str(STORAGE.parent / "asr" / "cache"))
            environment["LAB_ASR_MODEL"] = ASR_MODEL
            environment.pop("PYTHONPATH", None)
            completed = subprocess.run(
                [ASR_PYTHON, str(ASR_WORKER), str(audio_path)],
                capture_output=True, text=True, timeout=ASR_TIMEOUT, env=environment,
            )
        except subprocess.TimeoutExpired:
            self.send_json(504, {"error": "语音识别超时，请说短一点再试。"})
            return
        finally:
            audio_path.unlink(missing_ok=True)
        output = (completed.stdout or "").strip().splitlines()
        result = {}
        for line in reversed(output):
            try:
                result = json.loads(line)
                break
            except ValueError:
                continue
        if not result:
            print("Speech worker failed: %s" % (completed.stderr or "")[-400:])
            self.send_json(503, {"error": "语音识别失败，请直接输入文字。"})
            return
        if result.get("error"):
            print("Speech worker error: %s" % result["error"])
            self.send_json(503, {"error": "没有识别出内容，请再说一次，或直接输入文字。"})
            return
        self.send_json(200, {"text": clean_text(result.get("text"), 2000)})

    def extract_literature(self, body):
        if not PDF_READY:
            self.send_json(503, {"error": "这台服务器还没有准备 PDF 解析环境。"})
            return
        if not LLM_BASE_URL or not LLM_MODEL:
            self.send_json(503, {"error": "模型还没有配置，无法自动分析。"})
            return
        raw = str(body.get("file") or "")
        prefix = re.match(r"^data:application/pdf;base64,", raw, re.IGNORECASE)
        if not prefix:
            raise ValueError("请选择 PDF 文件。")
        try:
            payload = base64.b64decode(raw[prefix.end():], validate=False)
        except (ValueError, TypeError):
            raise ValueError("PDF 数据无法解析，请重试。")
        if not payload:
            raise ValueError("没有收到 PDF。")
        if len(payload) > MAX_PDF_ANALYZE:
            raise ValueError("PDF 超过 30 MB，请压缩后再试。")
        temp_dir = STORAGE / "tmp"
        temp_dir.mkdir(parents=True, exist_ok=True)
        pdf_path = temp_dir / ("literature-%s.pdf" % uuid.uuid4().hex)
        pdf_path.write_bytes(payload)
        try:
            environment = dict(os.environ)
            environment.pop("PYTHONPATH", None)
            completed = subprocess.run(
                [PDF_PYTHON, str(PDF_WORKER), str(pdf_path)],
                capture_output=True, text=True, timeout=PDF_TIMEOUT, env=environment,
            )
        except subprocess.TimeoutExpired:
            self.send_json(504, {"error": "PDF 解析超时，请换一个小一点的文件。"})
            return
        finally:
            pdf_path.unlink(missing_ok=True)
        result = {}
        for line in reversed((completed.stdout or "").strip().splitlines()):
            try:
                result = json.loads(line)
                break
            except ValueError:
                continue
        if not result or result.get("error"):
            print("PDF worker failed: %s" % (result.get("error") or (completed.stderr or "")[-300:]))
            raise ValueError(result.get("error") or "PDF 解析失败，请确认不是扫描版。")
        text = clean_text(result.get("text"), 30000)
        engine = clean_text(body.get("engine"), 12) or "quality"
        language = clean_text(body.get("language"), 8) or "zh"
        if language not in ("zh", "en", "both"):
            language = "zh"
        language_rule = {
            "zh": "summary 与 fabrication 用中文写；title 保留原文。",
            "en": "summary and fabrication must be written in English; keep the original title.",
            "both": "summary 先用中文写 200-300 字，再换行附一段 80-120 词的英文摘要；fabrication 用中文。",
        }[language]
        prompt = (
            "你是文献信息抽取助手。阅读下面论文的开头与实验方法部分，只输出一个 JSON 对象（不要代码块、不要解释）。\n"
            "字段：title 标题原文；journal 期刊；year 年份整数；doi DOI；first_author 第一作者；"
            "corresponding 通讯作者（顿号分隔，最多 4 人）；system 材料方向（只能取 sn-pb、pb-gap、sn-only、pbs-qd、wide-gap、other 之一）；"
            "study_object 研究对象（如 Sn-Pb 单结、叠层顶电池）；bandgap 带隙数值或 null；"
            "methods 方法标签数组（如 [\"反溶剂\",\"界面钝化\"]）；keywords 关键词数组（3-6 个）；"
            "summary 分析结论 80-150 字，只写：针对什么问题、用了什么方法、结果如何；"
            "fabrication 器件制备流程，输出字符串数组，最多 8 步，每步不超过 20 个词，格式「步骤名称：说明」，不要 JSON。\n"
            "语言要求：" + language_rule + "\n"
                        "材料方向判定：吸收层是 Sn-Pb 混合（含 Sn-Pb 叠层顶电池）→ sn-pb；纯 Pb 常规带隙 → pb-gap；纯 Sn → sn-only；"
            "PbS 量子点 → pbs-qd；带隙 ≥1.6 eV 的宽禁带 → wide-gap；无法判断才用 other。\n\n"
"论文内容：\n" + text
        )
        try:
            answer = llm_complete(
                [{"role": "system", "content": "你只输出 JSON，不编造论文中不存在的结论。"},
                 {"role": "user", "content": prompt}],
                max_tokens=1200, timeout=120,
                prefer="fallback" if engine == "fast" else "primary",
            )
        except Exception as exc:
            print("PDF analysis failed: %s" % exc)
            self.send_json(502, {"error": "模型暂时不可用，请稍后重试。"})
            return
        fields = parse_json_object(answer)
        if not fields:
            self.send_json(502, {"error": "模型返回的内容不是有效 JSON，请重试。"})
            return
        system = clean_text(fields.get("system"), 40)
        blob = " ".join(str(fields.get(key, "")) for key in ("title", "study_object", "summary", "keywords"))
        if system not in SYSTEM_NAMES:
            system = ""
        if re.search(r"Sn[- ]?Pb|锡铅", blob, re.IGNORECASE):
            system = "sn-pb"
        elif system == "pb-gap" and re.search(r"Sn[- ]?only|纯锡|Sn-?based", blob, re.IGNORECASE):
            system = "sn-only"
        raw_fabrication = fields.get("fabrication")
        if isinstance(raw_fabrication, list):
            raw_fabrication = "\n".join(str(step).strip() for step in raw_fabrication if str(step).strip())
        fabrication = clean_text(raw_fabrication, 8000)
        if fabrication and "\n" not in fabrication:
            parts = [part.strip(" 。.;；") for part in re.split(r"[；;]", fabrication) if part.strip(" 。.;；")]
            if len(parts) > 1:
                fabrication = "\n".join(parts)
        normalized = {
            "title": clean_text(fields.get("title"), 200),
            "journal": clean_text(fields.get("journal"), 200),
            "doi": clean_text(fields.get("doi"), 200),
            "first_author": clean_text(fields.get("first_author"), 100),
            "corresponding": clean_text(fields.get("corresponding"), 300),
            "study_object": clean_text(fields.get("study_object"), 100),
            "summary": clean_text(fields.get("summary"), 4000),
            "methods": "、".join(normalize_terms(fields.get("methods")))[:300],
            "keywords": "、".join(normalize_terms(fields.get("keywords")))[:200],
            "fabrication": fabrication,
            "system": system if system in SYSTEM_NAMES else "",
            "bandgap": fields.get("bandgap"),
            "year": fields.get("year"),
        }
        self.send_json(200, {
            "fields": normalized,
            "pages": result.get("pages", 0),
            "chars": result.get("chars", 0),
            "truncated": bool(result.get("truncated")),
        })

    def literature_fields(self, body):
        system = clean_text(body.get("system"), 40)
        title = clean_text(body.get("title"), 200)
        summary = clean_text(body.get("summary"), 4000)
        link = clean_text(body.get("link"), 500)
        person = clean_text(body.get("person"), 100)
        keywords = normalize_terms(body.get("keywords"))
        extra = {
            "first_author": clean_text(body.get("first_author"), 100),
            "corresponding": clean_text(body.get("corresponding"), 300),
            "doi": clean_text(body.get("doi"), 200),
            "fabrication": clean_text(body.get("fabrication"), 8000),
            "methods": clean_text(body.get("methods"), 300),
            "journal": clean_text(body.get("journal"), 200),
            "study_object": clean_text(body.get("study_object"), 100),
        }
        try:
            extra["bandgap"] = float(body.get("bandgap")) if body.get("bandgap") not in (None, "") else None
        except (TypeError, ValueError):
            extra["bandgap"] = None
        try:
            extra["year"] = int(body.get("year")) if body.get("year") not in (None, "") else None
        except (TypeError, ValueError):
            extra["year"] = None
        if system not in SYSTEM_NAMES:
            raise ValueError("请选择材料方向。")
        if not title:
            raise ValueError("请填写文献标题或主题。")
        if link and not re.match(r"^https?://", link):
            link = "https://" + link
        doi_value = (extra.get("doi") or "").strip()
        if not link and doi_value:
            link = "https://doi.org/" + re.sub(r"^https?://(dx\.)?doi\.org/", "", doi_value, flags=re.IGNORECASE)
        entry_id = clean_text(body.get("id"), 64)
        return entry_id, {
            "system": system, "title": title, "summary": summary, "link": link,
            "keywords": keywords, "person": person, **extra,
        }

    def save_literature(self, body):
        entry_id, fields = self.literature_fields(body)
        with LOCK:
            db = read_db()
            item, created = upsert_literature(db, fields, entry_id)
            save_db(db)
        self.send_json(200, {"item": item, "created": created})

    def import_literature(self, body):
        items = body.get("items")
        if not isinstance(items, list) or not items:
            raise ValueError("请提供 items 数组。")
        if len(items) > 500:
            raise ValueError("一次最多导入 500 条。")
        created = updated = skipped = 0
        problems = []
        with LOCK:
            db = read_db()
            for index, raw in enumerate(items):
                if not isinstance(raw, dict):
                    skipped += 1
                    problems.append({"index": index, "error": "条目不是对象"})
                    continue
                try:
                    entry_id, fields = self.literature_fields(raw)
                except ValueError as exc:
                    skipped += 1
                    problems.append({"index": index, "error": str(exc)})
                    continue
                try:
                    _, was_created = upsert_literature(db, fields, entry_id)
                except ValueError as exc:
                    skipped += 1
                    problems.append({"index": index, "error": str(exc)})
                    continue
                if was_created:
                    created += 1
                else:
                    updated += 1
            save_db(db)
        self.send_json(200, {
            "created": created, "updated": updated, "skipped": skipped,
            "total": len(db["literature"]), "problems": problems[:20],
        })

    def save_idea(self, body):
        kind = clean_text(body.get("kind"), 12) or "idea"
        if kind not in ("idea", "rant"):
            kind = "idea"
        title = clean_text(body.get("title"), 120)
        content = clean_text(body.get("body"), 2000)
        author = clean_text(body.get("author"), 60)
        if kind == "rant":
            if not content:
                raise ValueError("吐槽内容不能为空。")
            title = title or content[:40]
            author = "匿名"
        else:
            if not title:
                raise ValueError("请写一句想法标题。")
            if not author:
                raise ValueError("请填写你的名字，方便大家知道是谁提的。")
        with LOCK:
            db = read_db()
            idea = {
                "id": str(uuid.uuid4()),
                "kind": kind,
                "title": title,
                "body": content,
                "author": author,
                "upvotes": [author] if kind == "idea" else [],
                "downvotes": [],
                "done": False,
                "createdAt": now_iso(),
            }
            db.setdefault("ideas", []).insert(0, idea)
            save_db(db)
        self.send_json(200, {"idea": idea_view(idea)})

    def vote_idea(self, body):
        idea_id = clean_text(body.get("id"), 64)
        author = clean_text(body.get("author"), 60)
        direction = clean_text(body.get("direction"), 8)
        if direction not in ("up", "down"):
            raise ValueError("投票方向不正确。")
        if not author:
            raise ValueError("请先填写你的名字。")
        with LOCK:
            db = read_db()
            idea = next((item for item in db.get("ideas", []) if item.get("id") == idea_id), None)
            if not idea:
                raise ValueError("找不到这条想法。")
            upvotes = set(idea.get("upvotes") or [])
            downvotes = set(idea.get("downvotes") or [])
            if direction == "up":
                if author in upvotes:
                    upvotes.discard(author)
                else:
                    upvotes.add(author)
                    downvotes.discard(author)
            else:
                if author in downvotes:
                    downvotes.discard(author)
                else:
                    downvotes.add(author)
                    upvotes.discard(author)
            idea["upvotes"] = sorted(upvotes)
            idea["downvotes"] = sorted(downvotes)
            save_db(db)
        self.send_json(200, {"idea": idea_view(idea)})

    def mark_idea_done(self, body):
        idea_id = clean_text(body.get("id"), 64)
        with LOCK:
            db = read_db()
            idea = next((item for item in db.get("ideas", []) if item.get("id") == idea_id), None)
            if not idea:
                raise ValueError("找不到这条想法。")
            idea["done"] = bool(body.get("done", True))
            idea["doneAt"] = now_iso() if idea["done"] else ""
            save_db(db)
        self.send_json(200, {"idea": idea_view(idea)})

    def save_duty(self, body):
        week_start = clean_text(body.get("weekStart"), 10)
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", week_start):
            raise ValueError("请指定周起始日期。")
        names = body.get("names") or []
        names = normalize_terms(names)
        areas = clean_text(body.get("areas"), 200)
        with LOCK:
            db = read_db()
            db["dutyRoster"] = [item for item in db["dutyRoster"] if item.get("weekStart") != week_start]
            if names:
                db["dutyRoster"].append({"weekStart": week_start, "names": names, "areas": areas, "updatedAt": now_iso()})
            db["dutyRoster"].sort(key=lambda item: str(item.get("weekStart", "")))
            save_db(db)
            duty = current_duty(db)
        self.send_json(200, {"duty": duty})

    def ask_assistant(self, body):
        question = clean_text(body.get("question"), 4000)
        if not question:
            raise ValueError("请先输入问题。")
        if not LLM_BASE_URL or not LLM_MODEL:
            self.send_json(200, {
                "configured": False,
                "answer": "本地模型还没有连接。配置 LAB_LLM_BASE_URL 与 LAB_LLM_MODEL 后，页面会把研究数据摘要和设备目录发送到 Mac Mini 上的兼容接口；PDF 原件仍保存在本机。",
            })
            return
        research = read_research()
        research_brief = {
            "source": research.get("sourceName"),
            "scans": (research.get("summary") or {}).get("n_scans"),
            "anomaly": research.get("anomaly"),
            "available": research.get("available"),
        }
        with LOCK:
            db = read_db()
        zone_names = {item["id"]: item["name"] for item in ZONES}
        measurements = []
        for record in db.get("labRecords", [])[:10]:
            analysis = record.get("analysis") or {}
            measurements.append({
                "date": (record.get("createdAt") or "")[:10],
                "person": record.get("person", ""),
                "system": SYSTEM_NAMES.get(record.get("system"), record.get("system", "")),
                "conditions": clean_text(record.get("conditions"), 300),
                "trend": clean_text(analysis.get("trend"), 200),
                "keywords": analysis.get("keywords", [])[:6],
            })
        upkeep = []
        for collection, label in (("hygieneRecords", "卫生"), ("maintenanceRecords", "维护")):
            for record in db.get(collection, [])[:6]:
                upkeep.append({
                    "kind": label,
                    "date": (record.get("createdAt") or "")[:10],
                    "target": zone_names.get(record.get("target"), record.get("target", "")),
                    "person": record.get("person", ""),
                    "note": clean_text(record.get("note"), 120),
                })
        literature_counts = {}
        method_counts = {}
        for item in db.get("literature", []):
            name = SYSTEM_NAMES.get(item.get("system"), item.get("system", ""))
            literature_counts[name] = literature_counts.get(name, 0) + 1
            for method in re.split(r"[;,；、]", str(item.get("methods") or "")):
                method = method.strip()
                if method:
                    method_counts[method] = method_counts.get(method, 0) + 1
        context = {
            "verified_jv_sample": research_brief,
            "equipment_and_areas": [{"name": item["name"], "category": item["category"]} for item in ZONES],
            "recent_measurements": measurements,
            "recent_upkeep": upkeep,
            "literature_overview": {
                "by_system": literature_counts,
                "top_methods": sorted(method_counts.items(), key=lambda kv: -kv[1])[:8],
                "entries": len(db.get("literature", [])),
            },
            "current_duty": current_duty(db),
            "existing_research_note": "课题组数据平台落地方案，涵盖原始数据追溯、实验分组确认、统计看板、Mac Mini 本地部署。",
        }
        prompt = ("你是课题组的实验助手，回答要面向组员每天的实际工作：最近测了哪些条件、哪些记录还缺、哪个方向文献没覆盖、下一步做什么检查。"
                  "请区分本组已核实事实与一般科学建议：涉及样品身份、实验条件和结果时只能引用资料，未知就明确说明，不要根据性能猜测配方或机理；"
                  "一般实验方法问题可以给出通用建议，并标明这不是本组已确认的操作规范。以简短条目作答，先给结论再给依据。\n\n资料："
                  + json.dumps(context, ensure_ascii=False) + "\n\n问题：" + question)
        messages = [
            {"role": "system", "content": "你是课题组研究助手。谨慎陈述，不编造样品身份、条件、结论或统计口径。"},
            {"role": "user", "content": prompt},
        ]
        try:
            answer = llm_complete(messages, max_tokens=900, timeout=120)
            if not answer:
                raise ValueError("model returned no answer")
            self.send_json(200, {"configured": True, "answer": clean_text(answer, 12000)})
        except (OSError, ValueError, KeyError, IndexError, urllib.error.URLError) as exc:
            print("Model request failed: %s" % exc)
            self.send_json(502, {"error": "模型服务暂时不可用，请稍后重试；本地模型仍可直接使用。"})


class LabHTTPServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def main():
    global TOKEN, LLM_BASE_URL, LLM_MODEL, LLM_API_KEY, STORAGE, UPLOADS, LIBRARY, LABDATA, DB_PATH
    global ASR_PYTHON, ASR_MODEL, ASR_READY, ASR_TIMEOUT
    global PDF_PYTHON, PDF_READY, PDF_TIMEOUT
    global LLM_FALLBACK_BASE_URL, LLM_FALLBACK_MODEL, LLM_FALLBACK_API_KEY
    parser = argparse.ArgumentParser(description="Run the lab workspace app behind a local HTTPS tunnel.")
    parser.add_argument("--host", default="127.0.0.1", help="Network interface to bind (default: localhost only)")
    parser.add_argument("--port", type=int, default=8767)
    args = parser.parse_args()
    storage_override = os.environ.get("LAB_APP_DATA_DIR", "").strip()
    if storage_override:
        STORAGE = Path(storage_override).expanduser().resolve()
        UPLOADS = STORAGE / "uploads"
        LIBRARY = STORAGE / "library"
        LABDATA = STORAGE / "labdata"
        DB_PATH = STORAGE / "state.json"
    STORAGE.mkdir(parents=True, exist_ok=True)
    token_source = "generated"
    TOKEN = os.environ.get("LAB_APP_TOKEN", "").strip()
    token_file = os.environ.get("LAB_APP_TOKEN_FILE", "").strip()
    if TOKEN:
        token_source = "LAB_APP_TOKEN"
    elif token_file:
        try:
            TOKEN = Path(token_file).expanduser().read_text(encoding="utf-8").strip()
        except OSError as exc:
            parser.error("cannot read LAB_APP_TOKEN_FILE: %s" % exc)
        if not TOKEN:
            parser.error("LAB_APP_TOKEN_FILE is empty")
        token_source = "LAB_APP_TOKEN_FILE"
    else:
        TOKEN = secrets.token_urlsafe(18)
    ASR_PYTHON = os.environ.get("LAB_ASR_PYTHON", "").strip()
    ASR_MODEL = os.environ.get("LAB_ASR_MODEL", "").strip() or "mlx-community/whisper-small-mlx"
    try:
        ASR_TIMEOUT = max(30, int(os.environ.get("LAB_ASR_TIMEOUT", "120")))
    except ValueError:
        ASR_TIMEOUT = 120
    ASR_READY = bool(ASR_PYTHON) and Path(ASR_PYTHON).is_file() and ASR_WORKER.is_file()
    PDF_PYTHON = os.environ.get("LAB_PDF_PYTHON", "").strip() or ASR_PYTHON
    try:
        PDF_TIMEOUT = max(30, int(os.environ.get("LAB_PDF_TIMEOUT", "120")))
    except ValueError:
        PDF_TIMEOUT = 120
    PDF_READY = bool(PDF_PYTHON) and Path(PDF_PYTHON).is_file() and PDF_WORKER.is_file()
    LLM_BASE_URL = os.environ.get("LAB_LLM_BASE_URL", "").strip()
    LLM_MODEL = os.environ.get("LAB_LLM_MODEL", "").strip()
    LLM_API_KEY = os.environ.get("LAB_LLM_API_KEY", "").strip()
    LLM_FALLBACK_BASE_URL = os.environ.get("LAB_LLM_FALLBACK_BASE_URL", "").strip()
    LLM_FALLBACK_MODEL = os.environ.get("LAB_LLM_FALLBACK_MODEL", "").strip()
    LLM_FALLBACK_API_KEY = os.environ.get("LAB_LLM_FALLBACK_API_KEY", "").strip()
    server = LabHTTPServer((args.host, args.port), Handler)
    print("Lab workspace is listening on %s:%s" % (args.host, args.port))
    print("Open locally: http://127.0.0.1:%s" % args.port)
    if args.host not in ("127.0.0.1", "::1", "localhost"):
        print("Open on the same LAN: http://%s:%s" % (lan_address(), args.port))
    if token_source == "generated":
        print("Access code: %s" % TOKEN)
    else:
        print("Access code: configured securely via %s" % token_source)
    print("Keep port 8767 private; publish only through the configured HTTPS tunnel.")
    print("Storage: %s" % STORAGE)
    if LLM_BASE_URL and LLM_MODEL:
        print("Local model: %s (%s)" % (LLM_MODEL, LLM_BASE_URL))
    print("Speech recognition: %s" % ("enabled" if ASR_READY else "disabled"))
    print("PDF analysis: %s" % ("enabled" if PDF_READY else "disabled"))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping lab workspace server.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
