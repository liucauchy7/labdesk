# 参与开发说明

工作台是一个**无第三方依赖**的 Python 服务 + 原生 JS 前端，改完只需要重启服务。

## 1. 本地跑起来

```sh
git clone <仓库地址> labdesk
cd labdesk/app
./dev-server.sh            # 默认 127.0.0.1:8799，访问码 devtoken
```

- 数据目录默认 `/tmp/labdesk-dev`，与线上数据完全隔离，随便折腾；
- 首次启动会生成一个空的 `state.json`，可以自己造几条记录测试；
- 浏览器打开 `http://127.0.0.1:8799/`，输入 `devtoken`。

依赖：Python 3.9+（仅标准库）。语音转写、PDF 解析是可选功能，本地默认关闭，不影响开发。

## 2. 代码结构

| 文件 | 作用 |
|---|---|
| `app/server.py` | 全部接口、鉴权、数据结构 |
| `app/public/app.js` | 前端所有页面渲染与交互 |
| `app/public/index.html` | 页面骨架、导航、图标 |
| `app/public/styles.css` | 样式 |
| `app/public/i18n.js` | 中英文词条 |
| `app/pdf_worker.py` `app/asr_worker.py` | PDF / 语音的可选子进程 |
| `app/android/` `app/ios/` | 移动端外壳工程 |

改完刷新页面即可；改 `server.py` 需要重启 `dev-server.sh`。

## 3. 提交流程

1. 从 `main` 切一个分支：`git checkout -b feature/xxx`；
2. 只提交源码，**不要提交** `storage/`、`android/.tooling/`、任何访问码或真实实验数据（`.gitignore` 已排除）；
3. 提交前自检：
   ```sh
   python3 -c "import ast; ast.parse(open('app/server.py').read())"   # 语法
   ./app/dev-server.sh 8799 &                                          # 起服务
   curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8799/     # 应为 200
   ```
4. 发 Pull Request，说明「改了什么 / 为什么 / 怎么验证」。

## 4. 上线

线上只在这台 Mac Mini 上部署，由管理员执行：

```sh
cd app && ./deploy-macos.sh     # 同步到 runtime 并重启服务
```

部署脚本会：rsync 前端 → 复制 server.py / worker → 重启 launchd 服务 → 等端口就绪。
**提交者不需要、也不应该拿到线上机器的写权限。**

## 5. 安全约定

- 访问码只用于登录，不进入代码和提交历史；
- 数据库 `state.json`、上传的照片/PDF 都在 Mac Mini 的私有目录，仓库里没有；
- 涉及删除的功能一律走回收站，不直接物理删除。
