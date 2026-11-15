# 让 AI 帮你装好这个项目（复制下面整段给 AI）

> 用法：在 DSH / Claude / Cursor 等**有终端权限**的 AI 里，先 `git clone` 并 `cd` 进本仓库，然后把下面「指令」整段发给它。
> 需要你人工做的只有三件：**登录 DSH**、**扫码登录 SnowLuma**、**告诉它你的 QQ 号**。

---

## 指令（复制给 AI）

```
你现在在 omnichat-agent（QQ ↔ DeepSeek Harness 桥接）仓库根目录。请帮我把这个项目配置到可运行，按顺序做，每一步先自检、失败就停下来告诉我原因，不要跳步：

1. 运行 `node scripts/verify-setup.mjs`，把缺的项列出来。
2. 如果缺 Node 依赖，运行 `npm install`（需要 Node 22.13+）。
3. 如果缺 config.json：
   - 先把 config.example.json 复制成 config.json；
   - 问我「你的 QQ 号是多少」，把 ownerQQ 改成我的号；
   - 其他项保持默认（SnowLuma 默认 ws://127.0.0.1:3001、http://127.0.0.1:3000）。
4. 确认 DeepSeek Harness 桌面版已安装并已登录、正在运行；如果没有，告诉我，让我手动打开它。
5. 确认 SnowLuma 已安装并已扫码登录 QQ、OneBot HTTP 3000 与 WS 3001 在监听；没装就告诉我手动装（由于 EULA，桥接不能替你装 SnowLuma）。
6. 运行 `node scripts/setup-dsh.mjs`，把 qq-chat / qq-chat-v2 preset 和 MCP 装进 DSH；成功后提醒我重启一次 DSH。
7. 运行 `start.bat`（Windows）或 `npm start` 启动桥接。
8. 再跑一次 `node scripts/verify-setup.mjs`，确认全部 OK，然后让我在 QQ 上私聊机器人发一句话测试。
9. 遇到「系统服务重启中」「事件流 0 帧」时，等 30 秒让桥接自动重发现，或重启一次 start.bat。

约束：不要修改 .gitignore 里忽略的本地文件；不要把我的 QQ 号、token、聊天记录写进任何会被提交的文件。
```

## AI 会用来自检的脚本

`node scripts/verify-setup.mjs` 会检查：Node 版本、依赖、config.json 与 ownerQQ、DSH 可达性、SnowLuma 端口、preset 是否安装，并输出缺什么、下一步该做什么。

## 需要人工的三件事

| 事项 | 原因 |
|---|---|
| 登录 DeepSeek Harness | 桥接只是客户端，不代登录 |
| 安装/登录 SnowLuma | EULA 禁止桥接代部署，必须你自己装、自己扫码 |
| 提供 QQ 号 | 写进 config.json 的 ownerQQ，决定谁能指挥机器人 |
