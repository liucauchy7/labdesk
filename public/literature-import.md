# 文献批量导入格式（给 Windows 上的 agent 用）

工作台地址：`https://app.nzjlab.cn`

所有请求都要带访问码：

```
Authorization: Bearer <访问码>
Content-Type: application/json
```

访问码在 Mac Mini 上：`~/Library/Application Support/NingLab/LabDesk/secrets/access-code`，只发给组内同学，不要写进公开仓库或截图。

## 接口

| 方法 | 路径 | 用途 |
|---|---|---|
| POST | `/api/literature/import` | 批量新增或更新（按 DOI / 链接 / 标题去重） |
| POST | `/api/literature` | 单条新增或更新 |
| POST | `/api/literature/delete` | 删除一条，body 为 `{"id": "..."}` |
| GET | `/api/state` | 读取现有文献，便于比对 |

导入返回：`{"created": n, "updated": n, "skipped": n, "total": n, "problems": [...]}`。
同一个 DOI 再导入一次会更新而不是重复插入，可以放心重复执行。

## 条目字段

必填：`system`、`title`。其余可空。

| 字段 | 说明 |
|---|---|
| `system` | `sn-pb` 锡铅混合、`pb-gap` 纯铅常规带隙、`sn-only` 纯锡、`pbs-qd` 硫化铅量子点、`wide-gap` 宽带隙、`other` 其他 |
| `title` | 标题，≤200 字 |
| `summary` | 分析结论，≤4000 字，写「针对什么问题 → 用了什么方法 → 得到什么结果」 |
| `link` | 原文链接，可省略 `https://` |
| `doi` | 优先用它去重 |
| `journal` / `year` | 期刊、年份 |
| `first_author` / `corresponding` | 第一作者、通讯作者（多人用顿号分隔，通讯作者会进入频次统计并可点击筛选） |
| `methods` | 方法 / 策略标签，顿号分隔，例如 `反溶剂、界面钝化、添加剂`，会进入方法频次面板 |
| `keywords` | 关键词，顿号分隔，会进入首页词条热度 |
| `bandgap` | 带隙数值（eV），如 `1.75` |
| `study_object` | 研究对象，如 `WBG 单结`、`叠层顶电池` |
| `fabrication` | 器件制备流程，见下 |
| `person` | 录入人，可写 agent 或同学姓名 |

## fabrication 的写法（重要）

**一行一步**，统一写成 `步骤名称：说明`，参数直接写在说明里，不要贴 JSON：

```
基底清洗：FTO 依次用 Hellmanex、去离子水、乙醇各超声 30 min
SnO2 层：旋涂 SnO2 胶体（稀释 20 倍），150 ℃ 退火 30 min
钙钛矿层：反溶剂法，转速 4000 rpm、时间 30 s，退火 100 ℃ 10 min
钝化层：旋涂 PEAI 溶液（5 mg/mL，IPA），转速 3000 rpm、时间 30 s
```

服务端可以直接存这段文本，页面会按行拆成步骤；旧的 JSON 格式也能解析，但新数据请用上面的写法，保证每个体系格式一致。

## 示例

```json
{
  "items": [
    {
      "system": "sn-pb",
      "title": "Tin-lead perovskite solar cells with improved stability",
      "doi": "10.1000/example.2024.1",
      "journal": "Nature Energy",
      "year": 2024,
      "first_author": "A. Zhang",
      "corresponding": "B. Li、C. Wang",
      "methods": "反溶剂、界面钝化、添加剂",
      "keywords": "锡铅、稳定性、钝化",
      "bandgap": 1.25,
      "study_object": "Sn-Pb 单结",
      "summary": "针对锡铅体系易氧化、开路电压损失大的问题，用 X 分子钝化晶界，器件在 N2 中存放 1000 h 保持初始效率的 90%。",
      "fabrication": "基底清洗：ITO 超声 15 min\n钙钛矿层：转速 4000 rpm、时间 30 s，退火 100 ℃ 10 min",
      "link": "https://doi.org/10.1000/example.2024.1"
    }
  ]
}
```

## Windows 上怎么发

PowerShell：

```powershell
$body = Get-Content .\items.json -Raw -Encoding UTF8
Invoke-RestMethod -Method Post `
  -Uri "https://app.nzjlab.cn/api/literature/import" `
  -Headers @{ Authorization = "Bearer $env:LABDESK_TOKEN" } `
  -ContentType "application/json; charset=utf-8" `
  -Body ([Text.Encoding]::UTF8.GetBytes($body))
```

Python（Windows 自带或 conda 都可）：

```python
import json, os, urllib.request

body = json.dumps({"items": items}, ensure_ascii=False).encode("utf-8")
req = urllib.request.Request(
    "https://app.nzjlab.cn/api/literature/import",
    data=body,
    headers={"Authorization": "Bearer " + os.environ["LABDESK_TOKEN"],
             "Content-Type": "application/json"},
    method="POST",
)
print(json.load(urllib.request.urlopen(req, timeout=120)))
```

## 建议流程

1. Zotero 里把已经分析过的锡铅条目导出（JSON / CSV / Markdown 笔记都行）；
2. 让 agent 按上表映射成 `items` 数组，`system` 统一填 `sn-pb`；
3. 先导 2–3 条，打开 https://app.nzjlab.cn 的「协作平台 → 文献协作分析平台」确认样式；
4. 确认无误后整批导入，重复执行不会产生重复条目。
