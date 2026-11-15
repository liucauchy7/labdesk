# 宁志军课题组 Labdesk

A dependency-free responsive web app for the lab's shared research notes, hygiene photos, and equipment maintenance photos. It runs as a small Python service and can be opened from Mac, Windows, and Android browsers. The app shell is PWA-ready; browser installation requires HTTPS (or localhost).

## Run on the Mac Mini

From the workspace directory:

```sh
python3 app/server.py --host 127.0.0.1 --port 8767
```

Open `http://127.0.0.1:8767` on the Mac Mini. The production Android and browser address is `https://app.nzjlab.cn`, which will be routed to this loopback-only service through Cloudflare Tunnel. Do not publish or port-forward TCP 8767. Restarting the service creates a new code unless `LAB_APP_TOKEN` or `LAB_APP_TOKEN_FILE` is set.

Do not open `app/public/index.html` directly for sign-in. A `file://` preview cannot submit the access code; use the HTTP address served by this process instead.

## Remote updates

This is a browser/PWA workspace, so the Mac Mini is the update source rather than each phone or computer. A release can update `app/public/`, `app/server.py`, and `app/public/version.json` on the Mac Mini, then restart the Python service. Connected browsers check the version file, update the versioned service-worker cache, and reload the new shell; no per-device reinstall is needed.

For each release, set the same new value in `APP_VERSION` inside `app/public/app.js` and `version` inside `app/public/version.json`, then copy the release as one batch. Front-end-only changes can be picked up without a process restart, but restarting the service is recommended; changes to `server.py` require a restart.

The Android wrapper checks `version.json` when it opens. If `android.versionCode` is newer than the installed package, it offers the APK at `/downloads/ninglab-labdesk-debug.apk`; Android still requires the user to confirm installation. This is an in-app update notice, not a background push notification. True closed-app push requires a separately configured FCM project.

Back up `app/storage/` before replacing files, keep the access code in the service environment, and verify `http://127.0.0.1:8767/` after restart. Do not expose port 8767 directly to the public internet.

This prototype still uses a shared access code, not per-person accounts or role-based permissions. It now rate-limits failed access-code attempts, but public testing should remain limited to lab members until individual accounts are implemented. Use only the HTTPS hostname; never distribute the loopback origin or Tunnel credentials.

## 文献批量导入（给 Windows 上的 agent）

- 接口：`POST https://app.nzjlab.cn/api/literature/import`，body 为 `{"items": [...]}`，按 DOI / 链接 / 标题去重，可重复执行。
- 字段与格式说明：`docs/literature-import.md`（线上副本 `https://app.nzjlab.cn/literature-import.md`）。
- 单条增改用 `POST /api/literature`，删除用 `POST /api/literature/delete`。
- 都需要 `Authorization: Bearer <访问码>`。

## 0.7.0 新增（2026-11-02）

- **协作平台**：把「文献协作分析平台」和「实验室进展协作平台」放在同一页，用同一个材料方向分类（锡铅混合、纯铅常规带隙、纯锡钙钛矿、硫化铅量子点、宽带隙、其他）。文献只保留链接、分析结论和关键词，不要求上传 PDF。
- **测量记录**：为测试电脑准备。语音说明本次条件、选择原始数据文件，保存后由 Mac Mini 上的模型给出定性趋势（提升/下降/持平），不显示具体数值。
- **首页词条热度**：统计近 30 天测量记录与文献分析里的关键词，显示被提及的频率和 8 周走势。
- **首页本周值日生**：在 app 里维护周表，首页醒目显示本周值日生与负责区域，并可一键跳到卫生记录。

### 语音输入（0.7.6）

点「语音输入」开始录音，说完再点一次结束，录音会上传到 Mac Mini，用本机的 `mlx-whisper` 转成文字填进条件框，不再依赖手机自带的语音服务或 Google 服务。首次部署需要安装一次识别环境：

```sh
cd "$HOME/Library/Application Support/NingLab/LabDesk/asr"
python3 -m venv venv
./venv/bin/python -m pip install mlx-whisper numpy
# 模型文件（约 1 GB）放在 asr/models/whisper-small-mlx/
```

服务通过环境变量 `LAB_ASR_PYTHON`（虚拟环境里的 python）和 `LAB_ASR_MODEL`（模型目录）启用；两者缺失时页面会退回浏览器/手机自带识别，或提示直接打字。录音只在本机处理，不上传到外部服务。

### 在 Windows 测试电脑上安装

1. 用 Edge 或 Chrome 打开 `https://app.nzjlab.cn`，输入访问码。
2. 点地址栏右侧的「安装」图标（Edge 也可能显示为「应用可用」），确认后开始菜单和桌面会出现 Labdesk 图标，打开时没有地址栏，像本地程序一样。
3. 进入「测量记录」→「新建测量记录」：选择材料方向、填记录人、点「语音输入」说条件（也可直接打字）、选择原始数据文件，保存后等待趋势反馈。

语音识别由浏览器提供，需要联网；Edge/Chrome 支持中文听写。若浏览器不支持语音，直接输入文字即可。

### 数据去向

- 原始数据文件：`app/storage/labdata/<记录 ID>/`（生产环境为 `~/Library/Application Support/NingLab/LabDesk/data/labdata/`），只在本机，可通过记录卡片下载。
- 分析结果、关键词、文献条目、值日排班：`state.json`。
- 送进模型的只有条件文字、口述内容和表格的形状/列均值；返回给页面的只有定性描述。

## Local storage

- Hygiene and maintenance photos: `app/storage/uploads/`
- Uploaded PDF originals: `app/storage/library/`
- Record metadata: `app/storage/state.json`

These files are not sent to a third-party service. Back up the `app/storage` directory separately from the Mac Mini. The initial research page reads the existing `outputs/260930-T.import.json` and `数据平台落地方案.md` from this workspace; it does not modify those source files.

To store records on a mounted external drive, set `LAB_APP_DATA_DIR` to a specific directory before startup. Keep a separate backup regardless of the selected location.

## Optional local model

The research assistant expects an OpenAI-compatible Chat Completions endpoint reachable by the Mac Mini. Configure the actual endpoint and model name for the Qwen runtime already installed on the server:

```sh
LAB_LLM_BASE_URL="http://127.0.0.1:1234/v1" \
LAB_LLM_MODEL="<your-local-model-id>" \
python3 app/server.py --host 0.0.0.0 --port 8767
```

If the endpoint requires a key, also set `LAB_LLM_API_KEY`. The prototype sends a short verified research summary and the user's question to that local endpoint. PDF originals are not included in the prompt and are not automatically extracted or summarized yet.

## Current boundaries

- Photo uploads support JPEG, PNG, and WebP up to 12 MB; PDFs are limited to 30 MB.
- Hygiene and maintenance records are stored with the submitting person's name. Schedules, duty rotations, Super User assignments, and individual accounts are not configured yet.
- The local origin uses HTTP only on `127.0.0.1`; remote devices must use `https://app.nzjlab.cn`.
