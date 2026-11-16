# 换协议端（OneBot v11）指路说明

> 状态：**未实测**。本文只给路径与判据，不保证成功；SnowLuma 已停止分发，本仓库默认流程仍以自备的 SnowLuma 1.14.x 为准。

## 结论先说

桥接不绑定 SnowLuma 的实现，只依赖 **OneBot v11** 协议。理论上任何 OneBot v11 服务端都能接；NapCat 是 OneBot v11 实现，因此**理论可跑**，但本仓库没有在 NapCat 上做过完整回归。

## 可以把包从哪里拿来

官方 Releases 已清空，社区归档仓库：**`XingYunStar/NapCatQQ`**（第三方归档，非官方，自行判断可信度）。

该仓库保留了 NapCat v4.15.0 – v4.18.42 的构建产物，Windows 可用的有：

| 文件 | 说明 |
|---|---|
| `NapCat.Shell.zip` | 基础 Shell 包 |
| `NapCat.Shell.Windows.Node.zip` | 自带 Node 运行时（推荐） |
| `NapCat.Shell.Windows.OneKey.zip` | 一键安装器 |
| `NapCat.Framework.zip` | Framework 形式 |

镜像加速下载（示例，v4.18.42）：

```
https://ghfast.top/https://github.com/XingYunStar/NapCatQQ/releases/download/v4.18.42/NapCat.Shell.Windows.Node.zip
```

> 官方已无 SHA 可对，归档包无法用官方摘要校验；拿到后先自己记录 sha256，别混用多个来源的二进制。

## 接入步骤（按 OneBot v11 通用流程，未逐项验证）

1. 解压归档包，按包内说明启动（一般有 `start.bat` / `launcher`），首次启动按提示登录 QQ（扫码或密码，以 NapCat 实际界面为准）；
2. 在 NapCat 的配置里开启 **OneBot v11 HTTP** 与 **正向/反向 WebSocket**，端口设成 `HTTP 3000`、`WS 3001`（与桥接默认一致，省得改 `config.json`）；
3. 如果设了 accessToken，把它填进桥接 `config.json` 的 `snowluma.accessToken`；
4. 启动桥接（`start.bat`），看日志是否出现 `SnowLuma 已连接`（桥接沿用这个措辞，不区分具体实现）；
5. 用你自己的 QQ 私聊机器人发一句话，确认能收到回复；再进群发一句，确认群消息链路。

## 预期会缺/降级的部分

| 能力 | 桥接里的动作 | 缺了会怎样 |
|---|---|---|
| 「正在输入」状态 | `set_input_status` | 静默失败（有 try/catch），不影响收发 |
| 收藏表情同步 | `fetch_custom_face_detail` | 表情库不更新，`qq_send_sticker` 可能找不到表情 |
| 上游健康信号 | `get_status` / `bot_status` | 只影响控制台的「SnowLuma 上游」告警，不影响发送 |
| 消息段细节 | markdown 段、`sub_type` 等 | 桥接按 SnowLuma 1.14.x 的形状解析，NapCat 字段不同时可能出现内容缺失；需要实测 |

## 风险提示

- 这是**第三方二进制**，且是能登录 QQ 的网关程序：账号安全风险由你自行承担；
- 未实测意味着可能连「私聊收发」都跑不通，不要拿主账号直接试；
- 桥接侧不需要改代码，只改 `config.json` 的 `snowluma.wsUrl` / `httpUrl` / `accessToken`；改完仍可用 `node scripts/verify-setup.mjs` 看端口连通性。
