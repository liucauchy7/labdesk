/* Labdesk UI localisation: Chinese source strings -> English.
   Chinese is the source language; English is a lookup table applied to the
   rendered DOM, so the templates in app.js stay readable. */

const LABDESK_LANG_KEY = "labdesk.lang";

const LABDESK_EN = {
  "第一次使用？按设备安装": "First time? Install for your device",
  "下载安装包": "Download APK",
  "添加到主屏幕": "Add to home screen",
  "浏览器安装": "Install in browser",
  "电脑": "Desktop",
  "回收站": "Trash",
  "删除的内容先放这里，可以恢复": "Deleted items wait here and can be restored",
  "回收站是空的": "Trash is empty",
  "恢复": "Restore",
  "彻底删除": "Delete forever",
  "已移入回收站": "Moved to trash",
  "彻底删除后无法恢复，确定？": "This cannot be undone. Continue?",
  "已彻底删除": "Permanently deleted",
  "文献": "Literature",
  "测量": "Measurement",
  "想法": "Idea",
  "创意工坊": "Workshop",
  "组员自己写的小工具，点开即用": "Small tools written by the group — open and use",
  "还没有工具": "No tools yet",
  "写好的小工具可以放到创意工坊里。": "Finished tools can live in the workshop.",
  "打开": "Open",
  "钙钛矿前驱体配方计算器": "Perovskite precursor calculator",
  "提想法、投票，达到条件就排期实现": "Post ideas, vote, and approved ones get scheduled",
  "匿名说真话：卫生、仪器、流程，哪里别扭都可以讲": "Anonymous feedback: hygiene, equipment, process — say what bothers you",
  "功能想法": "Ideas",
  "匿名吐槽": "Rants",
  "匿名吐槽": "Rants",
  "匿名发布": "Post anonymously",
  "想吐槽什么": "What is bothering you",
  "完全匿名，不记录姓名。": "Fully anonymous — no names recorded.",
  "只记录内容，不记录是谁说的。": "Only the text is stored, never who wrote it.",
  "例如：五号楼台面总是堆满样品，没人清理；或者通风橱灯坏了很久":
    "e.g. the Building 5 bench is always piled with samples, or the fume hood light has been broken for ages",
  "还没有吐槽": "No rants yet",
  "点右上角，匿名说两句。": "Tap the top-right button to say something anonymously.",
  "同感": "Same here",
  "已匿名发布": "Posted anonymously",
  "组内共享 PDF 与分析；原件保存在 Mac Mini": "Shared PDFs and analyses; originals stay on the Mac Mini",
  "文献分析条目": "Literature entries",
  "标题、方法、结论与制备流程，可在协作平台筛选": "Title, methods, results and fabrication — filterable in Collaboration",
  "支持上传、备注与打开；上传分析时原件不落盘": "Upload, annotate and open; analysing a PDF leaves no copy",
  "PDF 不保存，分析后自动整理": "No PDF kept — just the extracted analysis",
  "在协作平台点「添加文献分析」，选择一个或多个 PDF，模型会读出标题、方法、结论和制备流程并自动填入；原件在处理完立即删除。":
    "In Collaboration, tap Add literature analysis and pick one or more PDFs; the model reads title, methods, results and fabrication, and the file is deleted right after.",
  "去添加分析": "Add an analysis",
  "经中转调用": "via relay",
  "翻译为英文": "Translate to English",
  "翻译中…": "Translating…",
  /* instruments and areas */
  "有机镀膜": "Organic coating",
  "热蒸发": "Thermal evaporation",
  "磁控溅射": "Magnetron sputtering",
  "小房间 EQE": "EQE room",
  "薄膜制备": "Thin-film deposition",
  "表征设备": "Characterisation",
  "公共区域": "Shared area",
  "五号楼": "Building 5",
  "七号楼": "Building 7",
  "仪器": "Equipment",
  "七号楼地面": "Building 7 floor",
  "七号楼台面": "Building 7 benches",
  "五号楼地面": "Building 5 floor",
  "五号楼台面": "Building 5 benches",
  "仓库收纳管理": "Storage organisation",
  "通风橱侧台面及架子": "Fume hood side bench",
  "手套箱侧台面及架子": "Glovebox side bench",
  "量子点台面": "Quantum-dot bench",
  "马弗炉架子": "Muffle furnace shelf",
  "合成通风橱": "Synthesis fume hood",
  "刮涂通风橱": "Blade-coating fume hood",
  "五号楼与七号楼公共区域": "Building 5 and 7 shared areas",

  "界面钝化": "Interface passivation",
  "密度泛函理论": "DFT",
  "打开完整目录查看": "Open the full catalogue",
  "关键词来自每次分析自动提取，也可以在文献分析里手动调整。":
    "Keywords come from each analysis and can be edited in the literature form.",
  "当前 PDF 仅集中存储和共享，尚未接入全文解析；图表来自已导入 JV 实验数据。":
    "PDFs are stored and shared only; full-text parsing is not enabled. Charts come from imported JV data.",
  "导出成待办清单。": "to export a to-do list.",
  "建议以实验批次、条件组、基底/器件、测量和原始文件建立可追溯台账。实验室成员沿用现有仪器和表格，上传后确认样品分组与工艺差异；缺失信息保留为未知，不用模型推测。Mac Mini 可先承担内网文件存储、结构化记录和看板服务。":
    "Build a traceable ledger by batch, condition set, substrate/device, measurement and raw file. The team keeps its current instruments and sheets; after upload, confirm sample grouping and process differences. Missing information stays unknown — the model is not asked to guess. The Mac Mini can start as file storage, structured records and a dashboard.",
  "原件与解析记录分开保存，后续汇总可追到来源。":
    "Originals and parsed records are kept separately so summaries stay traceable.",
  "卫生、仪器维护照片先形成简单闭环，再逐步增加排班和权限。":
    "Start with a simple loop for duty and upkeep photos, then add rosters and permissions.",
  "可比性按体系、结构、测量口径和批次分层，不只看冠军效率。":
    "Compare by system, structure, measurement protocol and batch — not just champion efficiency.",
  "每个点是一次 JV 扫描，已合并正/反向数据；横轴按天分列，同一天的数据在同一列，同一取值出现次数越多颜色越深。共 74 次扫描。":
    "Each dot is one JV scan with forward/reverse merged; the x-axis is per day, and darker means the same value appears more often. 74 scans in total.",
  "已合并正/反向扫描，不再分开统计；每个点对应一次扫描。这些是扫描统计，不是独立器件/条件组均值，也不代表认证或稳态效率。":
    "Forward/reverse scans are merged: each dot is one scan. These are scan statistics, not device or condition averages, and not certified or stabilised efficiencies.",
  "已验证 CSV 导出内部一致性，不等于校准/光强或样品标签核验。":
    "CSV export consistency was verified; calibration, light intensity and sample labels were not.",
  "不将实验数据统计误称为文献结论；后续接入 PDF 解析后，可再扩展文献证据图表。":
    "Experiment statistics are not presented as literature conclusions; literature evidence can be added once PDF parsing lands.",
  "PCE 公式核对": "PCE formula check",
  "第 10 组候选正反扫相差 3.98 个百分点，值得回查；器件身份和工艺条件尚未确认，不能据此归因。":
    "Group 10 forward/reverse scans differ by 3.98 points — worth rechecking; device identity and process conditions are unconfirmed, so no attribution yet.",

  /* material systems */
  "锡铅混合体系": "Sn-Pb alloy",
  "纯铅常规带隙": "Pb-only (regular gap)",
  "纯锡钙钛矿": "Sn-only perovskite",
  "硫化铅量子点": "PbS quantum dots",
  "宽带隙钙钛矿": "Wide-bandgap perovskite",
  "钙钛矿模组": "Perovskite modules",
  "钙钛矿LED": "Perovskite LEDs",
  "钙钛矿探测器": "Perovskite detectors",
  "钙钛矿铁电": "Perovskite ferroelectrics",
  "钙钛矿热电": "Perovskite thermoelectrics",
  "固态储能电池": "Solid-state batteries",
  "大语言模型": "Language models",
  "半导体先进工艺": "Advanced semiconductor process",
  "其他方向": "Other",

  /* short nav labels */
  "协作": "Collab",
  "测量": "Measure",
  "文献": "Library",
  "卫生": "Hygiene",
  "仪器": "Tools",

  /* method tags (display only) */
  "界面/钝化": "Interface/passivation",
  "表征分析": "Characterisation",
  "添加剂/掺杂": "Additives/doping",
  "理论计算": "Theory/computation",
  "成膜工艺": "Film formation",
  "反溶剂": "Anti-solvent",
  "评测/可解释": "Benchmarks/interpretability",
  "提示/推理": "Prompting/reasoning",
  "组分/带隙": "Composition/bandgap",
  "成像": "Imaging",
  "极化表征": "Polarisation",
  "合成": "Synthesis",
  "探测类型": "Detection mode",
  "应用": "Applications",
  "训练/微调": "Training/fine-tuning",
  "SAM/自组装": "SAM/self-assembly",
  "理论/光学": "Theory/optics",
  "电化学测试": "Electrochemistry",
  "理论/仿真": "Theory/simulation",
  "叠层": "Tandem",
  "结构表征": "Structure",
  "界面": "Interface",
  "输运测量": "Transport",
  "材料形态": "Morphology",
  "电解质": "Electrolyte",
  "结晶/退火调控": "Crystallisation/annealing",
  "器件": "Devices",
  "稳定性": "Stability",
  "材料/合成": "Materials/synthesis",
  "配体交换": "Ligand exchange",
  "制备工艺": "Fabrication",
  "理论建模": "Modelling",
  "灵敏度策略": "Sensitivity strategies",
  "效率": "Efficiency",
  "发光层": "Emissive layer",
  "器件结构": "Device structure",
  "涂布工艺": "Coating",
  "电极": "Electrodes",
  "文献综述": "Reviews",
  "二维/准二维": "2D/quasi-2D",
  "仿真": "Simulation",
  "工艺": "Process",
  "测试/表征": "Testing/characterisation",
  "互连/划线": "Interconnect/scribing",
  "组分/溶剂工程": "Composition/solvent engineering",
  "传输层": "Transport layer",
  "掺杂/缺陷": "Doping/defects",
  "封装": "Encapsulation",
  "界面/缺陷钝化": "Interface/defect passivation",
  "真空蒸镀": "Vacuum evaporation",
  "成本/规模化": "Cost/scalability",
  "可靠性/安全": "Reliability/safety",

  /* navigation & chrome */
  "总览": "Overview",
  "协作平台": "Collaboration",
  "测量记录": "Measurements",
  "卫生与仪器": "Upkeep",
  "卫生记录": "Hygiene",
  "仪器维护": "Equipment",
  "照片总览": "Photos",
  "照片": "Photos",
  "维护": "Upkeep",
  "论坛": "Forum",
  "文献协作": "Library",
  "Harness 平台": "Harness",
  "工作空间": "Workspace",
  "安全服务已连接": "Secure service connected",
  "资料保存在 Mac Mini": "Data stays on the Mac Mini",
  "版本": "Version",
  "断开连接": "Disconnect",
  "宁志军课题组": "Ning Lab",
  "宁志军课题组工作台": "Ning Lab Workspace",

  /* connect screen */
  "输入课题组管理员提供的访问码。记录与照片经加密连接上传，并保存在实验室 Mac Mini。":
    "Enter the access code from your lab admin. Records and photos are uploaded over an encrypted connection and stored on the lab Mac Mini.",
  "服务访问码": "Access code",
  "输入访问码": "Enter access code",
  "连接服务": "Connect",
  "HTTPS 安全连接 · 资料保存在 Mac Mini": "Encrypted · data stored on the Mac Mini",
  "iPhone / Android / 电脑安装说明": "Install on iPhone / Android / desktop",
  "访问码不正确，请向课题组管理员确认后重试。": "Wrong access code. Check with your lab admin and try again.",
  "访问码无效或服务已重启，请重新连接。": "Access code invalid or the service restarted. Please reconnect.",

  /* overview */
  "组内协作总览": "Team overview",
  "实验问题、本周值日与词条热度，一页开始": "Questions, duty roster and trending topics in one place",
  "核心任务": "Core tasks",
  "课题组日常工作": "Daily lab work",
  "问实验、上传值日照片、记录仪器维护。": "Ask the assistant, upload duty photos, log equipment upkeep.",
  "实验助手": "Lab assistant",
  "读取最近的测量记录、值日维护和文献方向，帮组员梳理每天的工作。":
    "Reads recent measurements, upkeep logs and literature coverage to summarise the week.",
  "例如：这周大家测了哪些条件？还有哪些记录没补？": "e.g. What did we measure this week? Which records are missing?",
  "分析": "Analyse",
  "每周卫生值日": "Weekly duty",
  "值日完成后为负责区域拍照，可一次上传多张": "Photograph your area after duty; multiple photos allowed",
  "仪器维护 · Super User": "Equipment upkeep",
  "选择负责仪器，上传维护过程与结果照片": "Pick the instrument and upload maintenance photos",
  "尚未记录，点击开始": "No records yet — tap to start",
  "尚未记录，打开设备目录": "No records yet — open the catalogue",
  "本周值日生": "Duty this week",
  "调整排班": "Edit roster",
  "安排值日": "Set duty",
  "上传卫生照片": "Upload duty photo",
  "本周还没有排班": "No duty assigned this week",
  "词条热度": "Trending terms",
  "近 30 天组内提及频率（来自测量记录与文献分析）": "Mentions in the last 30 days (measurements and literature)",
  "查看协作平台": "Open collaboration",
  "区域与设备": "Areas and equipment",
  "打开目录": "Open catalogue",
  "文献协作": "Literature",
  "添加文献 PDF": "Add literature PDF",
  "与组员共享原件和备注": "Share originals and notes with the group",
  "打开文献协作": "Open literature",
  "查看资料库与现有数据图": "Browse the library and data charts",
  "最近照片记录": "Recent photos",
  "组内成员共享，可在照片总览中查看全部": "Shared with the group; see all in Photos",
  "还没有卫生或维护记录。记录提交后会显示在这里。": "No upkeep records yet. New records will appear here.",
  "文献协作资料": "Literature items",
  "仪器维护记录": "Upkeep records",
  "已共享现场照片": "Shared site photos",
  "近 30 天组内提及": "Mentions in 30 days",

  /* collaboration */
  "文献分析与实验室进展分开管理，都按材料方向归档":
    "Literature analysis and lab progress, both grouped by material system",
  "PDF 资料库": "PDF library",
  "添加文献分析": "Add analysis",
  "文献协作分析平台": "Literature analysis",
  "实验室进展协作平台": "Lab progress",
  "全部方向": "All systems",
  "筛选": "Filter",
  "条件": "Conditions",
  "还没有条件，点下面任意一条加入（可多选）": "No filters yet — tap any item below (multi-select)",
  "任一满足": "Match any",
  "全部满足": "Match all",
  "清除": "Clear",
  "搜索标题、方法、通讯作者、添加剂或关键词": "Search title, method, author, additive or keyword",
  "方法 / 策略": "Methods",
  "通讯作者": "Corresponding author",
  "分析结论": "Analysis",
  "器件制备流程": "Fabrication steps",
  "原文链接": "Original paper",
  "未附链接": "No link",
  "组内共享": "Shared",
  "展开": "open",
  "收起": "close",
  "全部展开": "Expand all",
  "全部收起": "Collapse all",
  "这个方向还没有文献分析": "No analysis for this system yet",
  "导入分析结论与链接即可，不需要上传 PDF 原件。": "Add a summary and link; no need to upload the PDF.",
  "添加第一条": "Add the first one",
  "这个方向还没有实验进展": "No lab progress for this system yet",
  "在测试电脑上打开「测量记录」，语音说明条件并选择原始数据。":
    "Open Measurements on the test PC, dictate the conditions and attach raw data.",
  "记录一条": "Add a record",
  "已按年份从新到旧排列 · 展开后可看分析结论与制备流程":
    "Newest first · expand a card to see the analysis and fabrication",
  "条款": "Terms",

  /* measurements */
  "测完太阳能电池后，用语音说明条件、选择原始数据，模型返回趋势反馈":
    "After measuring, dictate the conditions, attach raw data and get a qualitative trend",
  "新建测量记录": "New measurement",
  "还没有测量记录": "No measurements yet",
  "在测试电脑上打开这一页（建议用 Edge 或 Chrome 安装成桌面应用），测完点「新建测量记录」。":
    "Open this page on the test PC (install it with Edge or Chrome), then tap New measurement.",
  "语音识别在浏览器内完成；若浏览器不支持，直接打字也可以。原始数据可用 CSV、TXT、TSV、DAT、JSON 或 XLSX。在测试电脑上用 Edge 或 Chrome 打开本页，点地址栏右侧的「安装」即可像程序一样固定在桌面。":
    "Speech is captured in the browser; typing works too. Raw data can be CSV, TXT, TSV, DAT, JSON or XLSX. Install the page from Edge/Chrome to pin it to the desktop.",
  "原始数据只写入 Mac Mini 私有目录，公网只回传方向性趋势，不显示具体数值。分析由":
    "Raw files are written to the private Mac Mini folder; only qualitative trends are returned. Analysis by",
  "完成。": ".",
  "还没有趋势反馈，可以点下面重新分析。": "No trend yet — use Re-analyse below.",
  "重新分析": "Re-analyse",
  "删除这条记录": "Delete this record",
  "删除这条测量记录及其原始数据？": "Delete this measurement and its raw files?",

  /* upkeep */
  "公共区域值日与仪器维护在同一页记录，按负责人和 Super User 查看":
    "Shared areas and equipment upkeep on one page, filtered by owner",
  "拍照记录": "Add photo",
  "全部负责人": "All owners",
  "负责人": "Owner",
  "公共区域值日": "Shared areas",
  "最近记录": "Recent records",
  "还没有卫生照片": "No duty photos yet",
  "还没有维护照片": "No upkeep photos yet",
  "记录打扫": "Log cleaning",
  "记录维护": "Log upkeep",
  "轮值未设置": "No rotation",
  "周期未设置": "No schedule",
  "周期未配置，不显示逾期状态": "No schedule configured",
  "负责人待登记": "Owner not registered",
  "未设置周期": "No schedule",
  "还没有提交照片": "No photos yet",
  "记录保存后会在这里按时间倒序显示。": "Records appear here, newest first.",
  "台仪器": "instruments",
  "个区域": "areas",
  "条记录": "records",
  "记录哪一类？": "Which record?",
  "两类记录都在同一页查看。": "Both types live on the same page.",
  "打扫完成后拍摄现场照片": "Photograph the area after cleaning",
  "由 Super User 记录维护照片": "Logged by the instrument Super User",

  /* photos */
  "同一服务器上的组员可浏览全部卫生与仪器照片":
    "Everyone on this server can browse duty and equipment photos",
  "还没有照片记录": "No photos yet",
  "提交卫生或仪器维护记录后，组内成员都可以在这里查看。":
    "Once a duty or upkeep record is added, everyone can see it here.",
  "历史照片保存在 Mac Mini；同一访问码成员可查看。仪器照片若曾误选为卫生类型，会标记为“历史记录待归类”，不会改动原记录。":
    "Photos are stored on the Mac Mini and visible to anyone with the access code. Legacy mis-typed records are labelled, never rewritten.",

  /* forum */
  "把想法发上来，大家投票；达到条件就收集起来，用模型转成具体的功能改进":
    "Post an idea, let the group vote, and approved ones become concrete improvements",
  "提个想法": "Post an idea",
  "5 个赞": "5 votes",
  "达到 5 人支持即可实施": "Five supporters is enough",
  "48 小时": "48 hours",
  "发布两天无人反对也自动通过": "No objections in two days also passes",
  "反对优先": "Objections first",
  "有人反对时先讨论，赞数够了再推进": "Discuss objections before proceeding",
  "自动收集": "Auto-collected",
  "通过的想法会进入待实现清单，由模型整理成改动方案":
    "Approved ideas enter a backlog that the model turns into a change plan",
  "可以实施": "Ready to build",
  "征集中": "Collecting feedback",
  "已上线": "Shipped",
  "支持": "Support",
  "反对": "Object",
  "还没有达到条件的想法": "Nothing has passed yet",
  "还没有新想法，点右上角提一个": "No ideas yet — post one from the top right",
  "标记已上线": "Mark shipped",
  "取消已上线": "Unmark shipped",
  "删除这条想法？": "Delete this idea?",
  "支持与反对按设备计票（填过名字则按名字），重复点击即取消；达到条件的想法可通过":
    "Votes are counted per device (or per name if set) and can be toggled; approved ideas can be exported via",
  "值日生": "on duty",

  /* literature dialog */
  "添加文献分析": "Add literature analysis",
  "编辑文献分析": "Edit literature analysis",
  "可以上传 PDF 自动整理，也可以手动填写；PDF 不会保存在服务器上。":
    "Upload a PDF to fill this in automatically, or type it yourself. The PDF is never stored.",
  "上传 PDF 自动整理": "Auto-fill from PDF",
  "原件不保存": "PDF not stored",
  "选一个 PDF，模型会读标题、方法、结论和制备流程；文件只在 Mac Mini 临时存在，分析完立即删除。":
    "Pick a PDF; the model reads title, methods, results and fabrication. The file only exists temporarily on the Mac Mini and is deleted right after.",
  "中文输出": "Chinese",
  "质量优先": "Best quality",
  "速度优先": "Faster",
  "排队中": "Queued",
  "解析中…": "Analysing…",
  "超过 30 MB，已跳过": "Over 30 MB, skipped",
  "可以一次选多个 PDF，模型会逐个读标题、方法、结论和制备流程；文件只在 Mac Mini 临时存在，分析完立即删除。":
    "Pick several PDFs at once; each is read for title, methods, results and fabrication. Files only exist temporarily on the Mac Mini and are deleted right after.",
  "中英对照": "Bilingual",
  "材料方向": "Material system",
  "标题 / 主题": "Title",
  "原文链接（可选）": "Link (optional)",
  "方法 / 策略标签": "Method tags",
  "用顿号或逗号分隔。保存后这些标签可点击，用来筛选同类文献，也会显示在方法频次里。":
    "Separate with commas. Tags become clickable filters and feed the method counts.",
  "列表里默认折叠，点开才显示。": "Collapsed by default in the list.",
  "作者、期刊与制备流程（可选）": "Authors, journal and fabrication (optional)",
  "第一作者": "First author",
  "多个用顿号或逗号分隔，同样可以点击筛选。": "Separate with commas; also clickable filters.",
  "期刊": "Journal",
  "年份": "Year",
  "带隙 (eV)": "Bandgap (eV)",
  "一行一步，统一写成「步骤名称：说明」。工艺参数直接写在说明里（如「转速 4000 rpm、时间 30 s、退火 120 ℃ 10 min」），不要贴 JSON；这样每个体系的格式都一致，也便于横向比较。":
    "One step per line as \"name: description\". Put parameters inline (e.g. 4000 rpm, 30 s, 120 °C for 10 min) instead of JSON so every system reads the same.",
  "关键词": "Keywords",
  "用顿号或逗号分隔；这些词会进入首页词条热度。": "Separate with commas; these feed the trending terms.",
  "保存分析": "Save",
  "取消": "Cancel",

  /* measurement dialog */
  "保存后系统会把条件与原始数据对应起来，并生成趋势反馈。":
    "Saving links the conditions to the raw files and generates a trend note.",
  "记录人": "Recorded by",
  "填写姓名": "Your name",
  "本次测试条件": "Test conditions",
  "例如：锡铅体系，加入分子 B，退火 160 度 15 分钟，测的是第 3 批第 2 片":
    "e.g. Sn-Pb, molecule B added, annealed 160 °C for 15 min, batch 3 device 2",
  "点一下开始说话，说完再点一次结束；录音在 Mac Mini 上转成文字填进上面的框，可边说边改。":
    "Tap to start, tap again to stop. Audio is transcribed on the Mac Mini and filled in above.",
  "语音输入": "Dictate",
  "结束录音": "Stop",
  "正在识别…": "Transcribing…",
  "原始数据（可选）": "Raw data (optional)",
  "最多 3 个文件，单个不超过 8 MB；原件只保存在 Mac Mini。":
    "Up to 3 files, 8 MB each; stored only on the Mac Mini.",
  "保存并分析": "Save and analyse",
  "正在录音，说完再点一次结束": "Recording — tap again to stop",
  "正在把录音转成文字…": "Transcribing…",
  "已转成文字，可直接修改": "Transcribed — feel free to edit",
  "没有识别出内容，请再说一次": "Nothing recognised, please try again",

  /* duty dialog */
  "安排本周值日": "Set this week's duty",
  "排班保存在 Mac Mini，所有组员看到的首页一致。":
    "The roster is stored on the Mac Mini and shown to everyone.",
  "本周值日生": "On duty this week",
  "例如：张三、李四": "e.g. Zhang San, Li Si",
  "多个名字用顿号、逗号或空格分隔。": "Separate names with commas.",
  "负责区域（可选）": "Areas (optional)",
  "下周值日生（可选）": "Next week (optional)",
  "提前安排，下周自动显示": "Schedule ahead; shown next week",
  "保存排班": "Save roster",
  "至少填写本周或下周的值日生。": "Fill in this week or next week.",

  /* common */
  "保存": "Save",
  "保存中…": "Saving…",
  "正在保存…": "Saving…",
  "发布": "Post",
  "正在发布…": "Posting…",
  "正在上传…": "Uploading…",
  "已删除": "Deleted",
  "已删除文献分析": "Analysis deleted",
  "已删除测量记录": "Measurement deleted",
  "文献分析已保存": "Analysis saved",
  "值日排班已更新": "Roster updated",
  "记录已保存，正在生成趋势反馈…": "Saved — generating the trend note…",
  "想法已发布，等大家投票": "Idea posted — waiting for votes",
  "请稍候…": "Please wait…",
  "加载更多": "Load more",
  "全部": "All",
  "删除": "Delete",
  "编辑": "Edit",
  "关闭": "Close",
  "返回协作平台": "Back to collaboration",
  "份 PDF": "PDFs",
  "暂无数据": "No data",
  "暂无": "None",
  "点「+」加入条件，再点一次取消；灰掉的条目在当前条件下没有结果。":
    "Tap + to add a condition, tap again to remove; greyed items have no results under the current filters.",
  "篇 ·": "papers ·",
  "个方向 ·": "systems ·",
  "位通讯": "authors",
  "文献资料库": "Literature library",
  "组内共享 PDF 与已有分析；文献原件保存在 Mac Mini": "Shared PDFs and analyses; originals stay on the Mac Mini",
  "PDF 原件保存于 Mac Mini": "PDFs are stored on the Mac Mini",
  "新上传的 PDF 原件只存放在本地服务端": "New PDFs are stored on the local server only",
  "添加 PDF": "Add PDF",
  "Mac Mini 文献资料库": "Mac Mini literature library",
  "还没有协作文献": "No shared literature yet",
  "添加 PDF 后，组员可通过同一工作台访问 Mac Mini 上的原件。":
    "Once a PDF is added, the group can open it from this workspace.",
  "查看": "View",
  "查看完整方案": "Open full plan",
  "待开始": "Not started",
  "已核对": "Verified",
  "基于现有导入文件": "Based on imported files",
  "数据核对摘要": "Data checklist",
  "曲线点位": "Curve points",
  "正反扫方向": "Scan direction",
  "器件身份": "Device identity",
  "解析范围": "Coverage",
  "当前已接入内容": "Currently connected",
  "当前支持上传、备注与打开，尚未抽取全文": "Upload, annotate and open; full-text parsing not yet enabled",
  "已导入扫描汇总，可视化显示方向范围与中位数": "Scan summary imported; charts show ranges and medians",
  "全部与仪器方向标记一致": "All match the instrument direction markers",
  "四行分组仍待逐组确认": "Four groups still need confirmation",
  "差异小于 0.000006 个百分点": "Difference below 0.000006 pp",
  "叠层器件 JV 样例": "Tandem JV sample",
  "JV 实验数据": "JV measurement data",
  "共享 PDF": "Shared PDFs",
  "Qwen 助手": "Assistant",
  "大语言模型": "Language model",
  "颜色越深 = 同一取值出现越多": "Darker = more frequent",
  "PCE 频率分布": "PCE distribution",
  "PCE 取值频次（全部天数合计）": "PCE frequency (all days)",
  "PCE 按天分列、颜色表示出现频次的散点图": "PCE per day, colour shows frequency",
  "按天分列的 PCE（颜色=出现频次）": "PCE by day (colour = frequency)",
  "已有调研 · v0.2 · 2026 年 10 月": "Study · v0.2 · Oct 2026",
  "来源：工作区已有调研文档": "Source: existing study notes",
  "课题组数据平台落地方案": "Lab data platform plan",
  "调研总结": "Study summary",
  "经课题组中转调用，只发摘要，不上传原始数据": "Calls the group relay with summaries only; raw data never leaves",
  "新上传的 PDF 原件只存放在本地服务端": "New PDFs are stored on the local server only",
  "提交卫生照片": "Submit hygiene photos",
  "提交仪器维护记录": "Submit instrument upkeep",
  "照片和记录会保存到 Mac Mini 本地目录。": "Photos and records are saved to the Mac Mini.",
  "卫生区域": "Hygiene area",
  "维护仪器": "Instrument",
  "维护人 / Super User": "Maintainer / Super User",
  "简要说明": "Notes",
  "例如：已清洁工作台并恢复物品摆放": "e.g. bench cleaned and items put back",
  "例如：清洁腔体、检查密封圈": "e.g. chamber cleaned, seals checked",
  "现场照片": "On-site photos",
  "可选择 1–5 张照片；压缩后上传并保存在 Mac Mini。": "1–5 photos; compressed, uploaded and saved on the Mac Mini.",
  "已选择": "Selected",
  "保存记录": "Save record",
  "填写姓名": "Your name",
  "已经改进并上线": "Shipped and live",
  "打卡一览": "Check-in board",
  "公共区域每周一次 · 仪器每月一次": "Areas weekly · instruments monthly",
  "名称 / 负责人": "Name / owner",
  "本期": "Current",
  "上次打卡": "Last check-in",
  "本期已打卡": "Done this period",
  "本期待打卡": "Due this period",
  "从未打卡": "Never checked in",
  "公共区域": "Public areas",
  "仪器": "Instruments",
  "每周至少打卡 1 次": "At least once a week",
  "每月至少打卡 1 次": "At least once a month",
  "查看记录": "records",
  "打卡记录": "Check-in history",
  "按时间倒序显示该区域或仪器的全部打卡照片，点照片可放大。": "All check-in photos for this area or instrument, newest first. Tap a photo to enlarge.",
  "还没有打卡记录。": "No check-in records yet.",
  "讨论补充": "Discussion",
  "还没有讨论，补充你的意见吧。": "No comments yet — add yours.",
  "发表": "Post",
  "整合讨论为采纳方案": "Merge into adopted plan",
  "采纳方案": "Adopted plan",
  "整合讨论方案": "Merge discussion",
  "把讨论要点整合成最终采纳的修改方案，保存后展示在想法卡片上。": "Merge the discussion into one final plan; it will show on the idea card.",
  "可直接编辑：删掉无关讨论、合并重复意见，形成可执行的最终方案。": "Edit freely: drop off-topic comments, merge duplicates, keep it actionable.",
  "保存为采纳方案": "Save as adopted plan",
  "已保存采纳方案": "Adopted plan saved",
  "讨论已补充": "Comment added",
  "先写点补充意见吧。": "Write a comment first.",
  "补充意见或修改建议…": "Add your comment or suggestion…",
  "你的名字": "Your name",
  "还没有讨论内容，先补充意见再整合。": "Nothing to merge yet — add comments first.",
  "可实施": "Approved",
  "征集中": "Open",
  "已达到实施条件，等待排期": "Meets the bar — waiting to be scheduled",
  "Super User 待登记": "Super User pending",
  "一次最多上传 5 张照片。": "Up to 5 photos per record.",
  "请选用 JPEG、PNG 或 WebP 照片。iPhone 如拍摄 HEIC，请先选择兼容格式。": "Use JPEG, PNG or WebP. On iPhone, convert HEIC first.",
  "单张照片需小于 6 MB，所有照片合计需小于 30 MB。": "Each photo under 6 MB, 30 MB total.",
  "无法处理这张照片，请换一张 JPEG、PNG 或 WebP 图片。": "Cannot read this photo — use JPEG, PNG or WebP.",
  "卫生与维护合并显示": "Hygiene and upkeep merged",
  "未添加说明": "No note",
  "照片加载中…": "Loading photo…",
  "正在载入工作台…": "Loading workspace…",
  "上传前预览": "Preview before upload",
  "连接不到课题组服务。访问码已记住，网络恢复后会自动重连，也可以直接点「连接服务」。": "Cannot reach the lab server. Your code is saved — we retry automatically, or just tap Connect.",
  "文献加载中…": "Loading literature…",
  "七百多条文献分析改为按需加载，只下载一次，之后驻留内存。": "700+ analyses now load on demand — downloaded once, then kept in memory.",
  "文献加载失败，请稍后重试。": "Could not load literature — try again.",
};

const LABDESK_EN_PATTERNS = [
  [/^(\d+) 篇$/, (m) => `${m[1]} papers`],
  [/^(\d+) 个方向$/, (m) => `${m[1]} systems`],
  [/^(\d+) 位通讯$/, (m) => `${m[1]} authors`],
  [/^(\d+) 条$/, (m) => `${m[1]} items`],
  [/^(\d+) 次$/, (m) => `${m[1]}×`],
  [/^(\d+) 份 PDF$/, (m) => `${m[1]} PDFs`],
  [/^(\d+) 条记录$/, (m) => `${m[1]} records`],
  [/^(\d+) 个区域$/, (m) => `${m[1]} areas`],
  [/^(\d+) 台仪器$/, (m) => `${m[1]} instruments`],
  [/^共 (\d+) 条记录 · 按时间从新到旧$/, (m) => `${m[1]} records · newest first`],
  [/^共 (\d+) 条$/, (m) => `${m[1]} total`],
  [/^(\d+) 条卫生照片$/, (m) => `${m[1]} duty photos`],
  [/^(\d+) 条维护照片$/, (m) => `${m[1]} upkeep photos`],
  [/^(\d+) 条文献分析$/, (m) => `${m[1]} analyses`],
  [/^(\d+) 条实验进展$/, (m) => `${m[1]} updates`],
  [/^(\d+) \/ (\d+) 条文献分析$/, (m) => `${m[1]} / ${m[2]} analyses`],
  [/^(\d+) 条等待排期$/, (m) => `${m[1]} waiting`],
  [/^(\d+) 条正在收集意见$/, (m) => `${m[1]} collecting`],
  [/^(\d+) 条已完成$/, (m) => `${m[1]} shipped`],
  [/^(\d+) 条已提交$/, (m) => `${m[1]} submitted`],
  [/^(\d+) 个区域 · (\d+) 台仪器 · (\d+) 条记录$/, (m) => `${m[1]} areas · ${m[2]} instruments · ${m[3]} records`],
  [/^显示 (\d+) 区域 · (\d+) 条卫生记录$/, (m) => `${m[1]} areas · ${m[2]} duty records`],
  [/^当前登记 (\d+) 项$/, (m) => `${m[1]} registered`],
  [/^还有 (\d+) 项$/, (m) => `and ${m[1]} more`],
  [/^(\d+) 张照片$/, (m) => `${m[1]} photos`],
  [/^(\d+) 条照片$/, (m) => `${m[1]} photos`],
  [/^器件制备流程（(\d+) 步）$/, (m) => `Fabrication (${m[1]} steps)`],
  [/^已选 (\d+) · 命中 (\d+)$/, (m) => `${m[1]} selected · ${m[2]} hit`],
  [/^还差 (\d+) 个赞，或 (\d+) 小时后无人反对自动通过$/, (m) => `${m[1]} more votes, or ${m[2]} h without objection`],
  [/^已选 (\d+) 个条件 · (全部满足|任一满足)$/, (m) => `${m[1]} filters · ${m[2] === "全部满足" ? "match all" : "match any"}`],
  [/^方法：(.+)$/, (m) => `Method: ${m[1]}`],
  [/^通讯：(.+)$/, (m) => `Corresponding: ${m[1]}`],
  [/^负责人：(.+)$/, (m) => `Owner: ${m[1]}`],
  [/^一作 (.+) · 通讯 (.+)$/, (m) => `First ${m[1]} · Corresponding ${m[2]}`],
  [/^本周排班 · (.+) 起$/, (m) => `This week from ${m[1]}`],
  [/^(.+) 天前$/, (m) => `${m[1]}d ago`],
  [/^(.+) 小时前$/, (m) => `${m[1]}h ago`],
  [/^云端 (.+)$/, (m) => `Cloud ${m[1]}`],
  [/^正在解析第 (\d+) \/ (\d+) 个：(.+)$/, (m) => `Analysing ${m[1]}/${m[2]}: ${m[3]}`],
  [/^处理完成：成功 (\d+) 篇，失败 (\d+) 篇。失败的可以单独重试，或手动填写。$/, (m) => `Done: ${m[1]} saved, ${m[2]} failed. Retry individually or fill in manually.`],
  [/^已保存：(.+)$/, (m) => `Saved: ${m[1]}`],
  [/^共 (\d+) 篇$/, (m) => `${m[1]} papers`],
  [/^共 (\d+) 份 PDF$/, (m) => `${m[1]} PDFs`],
  [/^(\d+) 类$/, (m) => `${m[1]} kinds`],
  [/^(\d+) 位$/, (m) => `${m[1]}`],
  [/^(\d+) 种$/, (m) => `${m[1]} kinds`],
  [/^(\d+) 个方向$/, (m) => `${m[1]} systems`],
  [/^篇 ·$/, () => "papers ·"],
  [/^个方向 ·$/, () => "systems ·"],
  [/^位通讯$/, () => "authors"],
  [/^原始数据只写入 Mac Mini 私有目录，公网只回传方向性趋势，不显示具体数值。分析由(.+)完成。$/,
    (m) => `Raw files stay in the private Mac Mini folder; only qualitative trends are returned. Analysis by ${m[1]}.`],
  [/^第 (\d+) 组候选正反扫相差 ([\d.]+) 个百分点，值得回查；器件身份和工艺条件尚未确认，不能据此归因。$/,
    (m) => `Group ${m[1]} forward/reverse scans differ by ${m[2]} points — worth rechecking; device identity and process conditions are unconfirmed, so no attribution yet.`],
  [/^(.+) 次扫描 · (.+)$/, (m) => `${m[2]} · ${m[1]} scans`],
  [/^一次最多处理 (\d+) 个 PDF，其余的请再上传一次$/, (m) => `Up to ${m[1]} PDFs at a time; upload the rest in another batch`],
  [/^本地 (.+)$/, (m) => `Local ${m[1]}`],
  [/^在 Mac Mini 本地运行 · (.+)$/, (m) => `Runs locally on the Mac Mini · ${m[1]}`],
  [/^(.+) 点 × (.+) 条扫描$/, (m) => `${m[1]} points × ${m[2]} scans`],
  [/^通道扫描数：(.+)$/, (m) => `Channel scans: ${m[1]}`],
  [/^讨论补充（(\d+)）$/, (m) => `Discussion (${m[1]})`],
  [/^(\d+) 条 · 查看记录$/, (m) => `${m[1]} records`],
  [/^上次 (.+)$/, (m) => `Last ${m[1]}`],
  [/^最近提交 (.+)$/, (m) => `Latest ${m[1]}`],
  [/^还有 (\d+) 人反对，先讨论清楚再推进（需 (\d+) 个赞）$/, (m) => `${m[1]} objections — discuss first (${m[2]} more votes)`],
  [/^共 (\d+) 条 · 完整照片见照片总览$/, (m) => `${m[1]} total · full photos in the Photos tab`],
  [/^已选择 (\d+) 张 · (.+)，将上传到 Mac Mini$/, (m) => `${m[1]} selected · ${m[2]}, uploads to the Mac Mini`],
  [/^(.+) · 打卡记录$/, (m) => `${m[1]} · check-in history`],
  [/^(\d+) 天前整合$/, (m) => `merged ${m[1]} d ago`],
];

let LABDESK_LANG = "zh";

function labdeskGetLang() {
  try {
    const saved = localStorage.getItem(LABDESK_LANG_KEY);
    if (saved === "en" || saved === "zh") return saved;
  } catch (error) { /* private mode */ }
  const nav = (navigator.language || "").toLowerCase();
  return nav.startsWith("zh") ? "zh" : "en";
}

function labdeskTranslate(value) {
  if (LABDESK_LANG !== "en") return value;
  const text = String(value);
  const trimmed = text.trim();
  if (!trimmed) return value;
  if (trimmed.startsWith("#") && trimmed.length > 1) {
    const inner = labdeskTranslate(trimmed.slice(1));
    return inner === trimmed.slice(1) ? value : text.replace(trimmed, "#" + inner);
  }
  if (LABDESK_EN[trimmed]) {
    return text.replace(trimmed, LABDESK_EN[trimmed]);
  }
  if (trimmed.includes(" · ")) {
    const parts = trimmed.split(" · ");
    const translated = parts.map((part) => labdeskTranslate(part));
    if (translated.some((part, index) => part !== parts[index])) {
      return text.replace(trimmed, translated.join(" · "));
    }
  }
  for (const [pattern, render] of LABDESK_EN_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) return text.replace(trimmed, render(match));
  }
  return value;
}

function labdeskLocalize(root) {
  if (!root || LABDESK_LANG !== "en") return;
  document.documentElement.lang = "en";
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || ["SCRIPT", "STYLE", "TEXTAREA"].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
      return node.nodeValue && node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    const translated = labdeskTranslate(node.nodeValue);
    if (translated !== node.nodeValue) node.nodeValue = translated;
  });
  root.querySelectorAll("[placeholder],[title],[aria-label]").forEach((element) => {
    ["placeholder", "title", "aria-label"].forEach((attribute) => {
      const value = element.getAttribute(attribute);
      if (!value) return;
      const translated = labdeskTranslate(value);
      if (translated !== value) element.setAttribute(attribute, translated);
    });
  });
}

function labdeskSetLang(lang) {
  LABDESK_LANG = lang === "en" ? "en" : "zh";
  try { localStorage.setItem(LABDESK_LANG_KEY, LABDESK_LANG); } catch (error) { /* ignore */ }
  document.documentElement.lang = LABDESK_LANG === "en" ? "en" : "zh-CN";
}

LABDESK_LANG = labdeskGetLang();
document.documentElement.lang = LABDESK_LANG === "en" ? "en" : "zh-CN";
