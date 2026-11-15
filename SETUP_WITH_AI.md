# 让 AI 帮你装好 omnichat-agent（可执行 runbook）

> 给 AI 执行者：严格按顺序做，**失败即停、不跳步**。每步执行后必须核对“预期输出”，不通过就按“失败动作”处理。
> 需要人做的只有三件：登录 DSH、扫码登录 SnowLuma、提供自己的 QQ 号。
> 本文只使用仓库里真实存在的命令与文件；标注「需核实」的地方表示脚本当前没有该能力，不要按猜测执行。

## 0. 给 AI 的硬约束（先读）

- **先 clone 再执行**：`git clone https://github.com/Marui-jc/omnichat-agent`，`cd omnichat-agent`，再按本文往下做；不要假设当前已在仓库根，也不要凭空创建文件。
- **禁止代替人做隐私操作**：不要登录 DSH、不要安装/登录 SnowLuma、不要代填 QQ 号；到这三处必须停下问人。
- **不要编造**：命令、参数、配置项、路径一律以仓库内文件为准；不确定就打开 `scripts/*.mjs`、`start.bat`、`config.example.json` 确认，确认不了就写「需核实」并停下。
- **报错原文回报**：失败时贴完整报错（含执行的命令与退出码），不要只说“失败了”。
- **完成后汇报**：Node / DSH / SnowLuma 实际版本、profile 名、实际改过的文件、启动方式；有任何一步没通过就如实说明，禁止报成功。

---

## 1. 开工前检查表（Preflight）

| 检查项 | 怎么查 | 通过标准 | 不通过时怎么办 |
|---|---|---|---|
| Node ≥ 22.13 | `node -v` | `v22.13.0` 或更高 | 停下问人：装 Node 22.13+，或让用户改用 DSH 自带运行时 |
| 仓库已 clone 且目录正确 | `pwd`，确认存在 `package.json`、`start.bat`、`scripts/verify-setup.mjs` | 三个文件都存在 | 停下问人：确认已在 omnichat-agent 仓库根目录 |
| DSH 已安装、已登录、正在运行 | 检查 `http://127.0.0.1:3080` 是否可达（`config.example.json` 的默认值）；桌面版实际端口可能不同，以 `node scripts/verify-setup.mjs` 的 DSH 行为准 | 输出包含 `✅ DSH`（根路径 401 也算可达） | 停下问人：打开 DeepSeek Harness 桌面版并登录（AI 不代登录） |
| SnowLuma 已安装、已扫码登录 QQ | 看 SnowLuma 窗口是否显示 QQ 在线；或自检输出 `✅ SnowLuma` | 输出包含 `✅ SnowLuma` | 停下问人：安装 SnowLuma 并扫码（EULA 限制，AI 不代装） |
| OneBot HTTP 3000 / WS 3001 在监听 | `netstat -ano \| findstr ":3000 :3001"`，或自检 `✅ SnowLuma` | 3000 与 3001 都出现 `LISTENING` | 停下问人：在 SnowLuma 里开启 OneBot HTTP(3000) 与 WS(3001) |
| 3000/3001 没有被别的进程占用 | 同一条 `netstat`，看占用 PID：`tasklist /FI "PID eq <pid>"` | 占用者就是 SnowLuma | 停下问人：先处理占用进程，不要改本仓库默认端口 |
| config.json 是否存在 | `dir config.json`（或自检 `config.json` 一项） | 文件存在且 `ownerQQ` 非空 | 按第 2 节第 3 步生成，并让用户自己填 QQ 号 |

---

## 2. 分步流程

### 2.1 自检

| 命令 | 预期输出 | 失败动作 | 是否需人工 |
|---|---|---|---|
| `node scripts/verify-setup.mjs` | 六项检查各一行，末尾给出「下一步」或「全部就绪」 | 按输出逐项处理；若脚本本身报错，停下问人 | 否 |

### 2.2 安装依赖

| 命令 | 预期输出 | 失败动作 | 是否需人工 |
|---|---|---|---|
| `npm install` | 结束无 `npm ERR!`，且 `node_modules\@snowluma\sdk` 存在 | 重试一次；仍失败按第 3 节四类状态判断，再按故障排查第 1 条 | 否 |

### 2.3 生成 config.json

| 命令 | 预期输出 | 失败动作 | 是否需人工 |
|---|---|---|---|
| `copy config.example.json config.json` | 出现 `config.json` | 重试一次；仍失败停下问人（权限） | 否 |
| 让用户提供 QQ 号，把 `ownerQQ` 改为该号码 | `config.json` 里 `"ownerQQ"` 是用户给的号码 | 停下问人：必须由用户提供，AI 不代填 | **是** |

> 默认端口不要改：`snowluma.wsUrl=ws://127.0.0.1:3001`、`snowluma.httpUrl=http://127.0.0.1:3000`、`dsh.baseUrl=http://127.0.0.1:3080`。桌面版 DSH 每次启动端口会变，`start.bat` 里的 `scripts/dsh-port-sync.mjs` 会自动同步 `dsh.baseUrl`。

### 2.4 确认 DSH

| 命令 | 预期输出 | 失败动作 | 是否需人工 |
|---|---|---|---|
| `node scripts/verify-setup.mjs`，看 `DSH` 一行 | `✅ DSH: 探测到 http://127.0.0.1:<port>`（`config.example.json` 默认是 `3080`；桌面版根路径返回 401 也算探测成功） | 停下问人：打开并登录 DSH；如果 DSH 已在运行仍探测不到，按故障排查第 4 条 | **是**（登录） |

### 2.5 确认 SnowLuma

| 命令 | 预期输出 | 失败动作 | 是否需人工 |
|---|---|---|---|
| 自检 `SnowLuma` 一行；或 `netstat -ano \| findstr ":3000 :3001"` | `✅ SnowLuma: 3000/3001 在监听` | 停下问人：安装/启动 SnowLuma 并扫码；端口没开按故障排查第 5 条 | **是**（扫码） |

### 2.6 安装 DSH 端 preset / MCP

| 命令 | 预期输出 | 失败动作 | 是否需人工 |
|---|---|---|---|
| 先确认 profile 名：`dir %USERPROFILE%\.dsh\profiles` | 至少有一个目录（桌面版通常是 `desktop`） | 停下问人：确认 DSH 已初始化过 | 否 |
| `node scripts/setup-dsh.mjs <profile>`（例如 `node scripts/setup-dsh.mjs desktop`） | 出现 `[setup-dsh] Done.`，且自动执行 `dsh plugin --profile <profile> install` 后打印 `OK` 或退出码 0 | 重试一次；仍失败按故障排查第 6 条 | 否 |
| 重启 DSH | DSH 重新打开后配置生效 | 停下问人：手动完全退出 DSH 再打开 | **是** |

> 注意：`setup-dsh.mjs` 的 profile 是**位置参数**（源码 `process.argv[2]`），不是 `--profile`；不传时默认 **web**，桌面版必须显式传 `desktop`（或你实际存在的目录名）。传错 profile 等于没装。
> **装完必须重启 DSH**：不重启的话 DSH 仍加载旧的 preset/MCP，QQ 会话里会出现工具不存在、或根本走不到 `qq-chat-v2`。
> 非 Windows：把 `%USERPROFILE%` 换成 `$HOME`，把 `start.bat` 换成 `npm start`，其余命令不变。

### 2.7 启动桥接

| 命令 | 预期输出 | 失败动作 | 是否需人工 |
|---|---|---|---|
| `start.bat`（或 `npm start`） | 日志出现 `桥接已启动`、`DSH 已就绪（模式: reserved2）`、`SnowLuma 已连接` | 按故障排查第 4/5/6 条；仍不行停下问人 | 否 |
| 看 `start.bat` 退出码 | `0`/正常继续；**`2` 表示已有另一个桥接窗口在跑** | 关掉旧窗口，不要重复启动 | 否 |

> `start.bat` 自己会：检查 node → `scripts/harden-state-acl.mjs` → **循环执行 `dsh-port-sync` + `node src/bridge.js`**；桥接退出后 5 秒自动重启（`goto loop`）。

### 2.8 验收

| 命令 | 预期输出 | 失败动作 | 是否需人工 |
|---|---|---|---|
| `node scripts/verify-setup.mjs` | 全部 `✅`，或只剩可接受的 ⚠️ | 按输出处理 | 否 |
| 打开 `http://127.0.0.1:3100`（控制台） | 页面能打开 | 按故障排查第 6 条 | 否 |
| 让用户在 QQ 私聊机器人发一句话 | QQ 收到回复；桥接日志出现发送记录 | 停下问人：贴日志，按第 7 节排查 | **是**（发消息） |

---

## 3. 自检脚本语义（verify-setup.mjs）

脚本输出每项以 `✅ / ⚠️ / ❌` 开头，AI 必须按 **detail 文本**区分四类状态，不能一律当“缺依赖”：

| 状态 | 脚本里的典型输出 | AI 应该做什么 |
|---|---|---|
| **缺失** | `❌ config.json: 不存在`、`❌ Node 依赖: 缺 node_modules`、`❌ DSH preset: profile 里还没有注册 qq-agent-presets / qq-mode-console` | 按第 2 节对应小题补齐（复制 config / npm install / 跑 setup-dsh） |
| **不可达** | `❌ DSH: 没有探测到运行中的 DSH`、`⚠️ DSH: config 里的 http://… 当前不可用`、`❌ SnowLuma: HTTP 3000 不通，WS 3001 不通` | 先确认服务是否在运行、端口是否正确，再决定是否让用户启动/登录；不要为此重装依赖 |
| **权限错误** | 脚本**当前不会单独输出权限错误**（需核实：脚本只做读路径与端口探测，不检测 ACL/写入权限）。若上游命令报 `Access is denied` / `Permission denied`，按“权限错误”处理 | 停下问人，按第 7 节第 1/3 条给用户具体命令；不要反复重试 |
| **版本不匹配** | `❌ Node.js: vX.Y.Z 太低` | 让用户升级 Node 到 22.13+，或改用 DSH 自带运行时；不要跳过 |

---

## 4. 幂等与回滚

| 事实 | 说明 |
|---|---|
| `setup-dsh.mjs` 可重复执行 | 是。junction 已指向本仓库则跳过；profile 里已有的同名字段不重复添加；`state/mode.json` 已存在则保持不动 |
| 写 preset / cordis patch 前是否备份 | 会备份：被覆盖的 profile `cordis.patch.yml` 先复制为 `<profile>\cordis.patch.yml.bak-<ISO时间戳>`（`:`/`.` 替换为 `-`）；每个文件**保留最近 5 份，超过时按时间戳淘汰最旧**（源码 `backupBeforeOverwrite(file, keep = 5)`） |
| profile `package.json` 是否备份 | **不备份**。写前手动复制：`copy %USERPROFILE%\.dsh\profiles\<profile>\package.json %USERPROFILE%\.dsh\profiles\<profile>\package.json.manual-bak` |
| 写坏了怎么恢复 | 1) 用 `<profile>\cordis.patch.yml.bak-*` 里最近一份覆盖回 `cordis.patch.yml`；2) 用 `<profile>\package.json.manual-bak` 覆盖回 `package.json`；3) 重新执行 `node scripts/setup-dsh.mjs <profile>`；4) 重启 DSH |
| `state/mode.json` | 只在不存在时创建为 `{"mode":"reserved2"}`；不存在自动备份机制，删掉会丢当前模式，需要重新设置 |

---

## 5. 安全与权限边界

- **`ownerQQ` 由用户自己填**：AI 不代填、不读取用户 QQ 号写进任何会被提交的文件。
- **MCP / preset 授予桥接的能力**：通过 `mcp-snowluma` 暴露 QQ 动作的安全子集（查状态/读未读与最近消息/发消息/发表情/等），**不含**本地文件、命令执行、进程管理；群聊/私聊范围由 `config.json` 的 `allow` / `deny` 白名单决定。
- **聊天记录**：桥接只把当前会话的未读/最近消息投递给 DSH；`state/` 下保存会话状态与历史归档，属于本地隐私，**已在 `.gitignore` 中忽略**。
- **不要动**：`.gitignore` 忽略的 `config.json`、`state/`、`audio/`、`docs/` 等本地文件；不要把 QQ 号、token、聊天记录写进任何会被提交的文件。
- 控制台 `127.0.0.1:3100` 只监听本机，不要改成公网可访问。

---

## 6. 验收标准（可观测）

| 判据 | 具体特征 |
|---|---|
| 桥接日志成功 | 出现 `SnowLuma 已连接`；出现 `DSH 已就绪（模式: reserved2）`；事件流帧数 **> 0**（日志不再反复 `本次收到 0 帧`） |
| DSH 自检返回 OK | `node scripts/verify-setup.mjs` 的 `DSH` 与 `DSH preset` 两项都是 `✅`，末尾为 `全部就绪` |
| QQ 收到机器人回复 | 用户私聊机器人后，QQ 里出现一条**机器人发出的文本**；控制台「最近活动」有对应发送记录 |
| 控制台可访问 | 浏览器打开 `http://127.0.0.1:3100` 能加载；浏览器控制台/日志里**没有 `ECONNREFUSED`** |

失败时按顺序先看：桥接窗口日志（找 `0 帧`/`ECONNREFUSED`）→ `node scripts/verify-setup.mjs` → `netstat -ano \| findstr ":3000 :3001"` → DSH 页面是否登录。

---

## 7. 故障排查分支

| 现象 | 先查什么 | 怎么修 |
|---|---|---|
| 1. `npm install` 失败 | 报错类型：网络（`ETIMEDOUT`/`ECONNRESET`）、Node 版本、权限（`EACCES`/`Access is denied`） | 网络：重试一次，仍失败停下问人换源；版本：升级 Node 22.13+；权限：停下问人，不要用管理员权限反复重装 |
| 2. Node 版本不够 | `node -v` 与 `node scripts/verify-setup.mjs` 的 `❌ Node.js` | 安装 Node 22.13+，或把 DSH 自带 runtime 的 `node.exe` 目录放到 PATH 最前 |
| 3. 端口被占用 | `netstat -ano \| findstr ":3000 :3001"` 拿到 PID，再 `tasklist /FI "PID eq <pid>"` | 占用者不是 SnowLuma：停下问人处理占用进程；**不要改默认端口**（桥接与文档都按 3000/3001 约定） |
| 4. DSH 可达但未登录 | 检查 `http://127.0.0.1:3080`（或 `verify-setup` 探测到的端口）是否要求登录；`verify-setup` 的 DSH 项显示 `（需要登录态）` | 让用户登录 DSH；登录后重跑自检 |
| 5. SnowLuma 未监听 | 3000/3001 的 `netstat`、SnowLuma 窗口是否显示在线 | 让用户启动 SnowLuma、扫码登录，并在设置里开启 OneBot HTTP/WS；不要由 AI 代装 |
| 6. 事件流 0 帧（日志反复 `连上 → 0 帧 → 断开`） | 确认 DSH 是否刚重启、端口是否变了 | 等 ~30 秒，桥接会自行重发现 DSH 并重建客户端；仍不行：完全退出 DSH 再启动，然后重跑 `start.bat`；仍失败停下问人 |
| 7. 装了 preset 但 QQ 没反应 | `verify-setup` 的 `DSH preset` 项；确认 `setup-dsh.mjs` 传的 profile 名正确 | 用正确 profile 重跑 `node scripts/setup-dsh.mjs <profile>`，重启 DSH；再不行按第 6 条检查桥接连接 |

---

## 8. 给用户的一句话入口

> 克隆 `https://github.com/Marui-jc/omnichat-agent`，cd 进去，把本文件整段发给 AI，并告诉它你的 QQ 号；DSH 登录和 SnowLuma 扫码这两步它会停下来等你。
