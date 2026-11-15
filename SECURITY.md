# 安全说明

## 仓库里不应该出现的东西

- 访问码（`LAB_APP_TOKEN` / `access-code` 文件内容）
- 任何 API key（模型中转、DeepSeek、DashScope 等）
- `storage/` 下的数据：测量记录、照片、文献 PDF、`state.json`
- 部署机器上的 `launchd` plist、`.env`

这些都由 `.gitignore` 排除；**如果误提交过，请立刻轮换对应的密钥，并视为已泄露。**

## 数据在哪里

实验室数据只保存在 Mac Mini 的私有目录：

```
~/Library/Application Support/NingLab/LabDesk/data
```

仓库里只有代码。协作者 clone 仓库拿到的是代码，不是数据；线上部署也只能在 Mac Mini 上执行 `deploy-macos.sh`。

## 报告问题

发现仓库里出现敏感信息、或接口有越权风险，请在群里直接联系仓库所有者，不要开公开 issue。
