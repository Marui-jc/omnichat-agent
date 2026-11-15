// 一键自检：这个项目在本机还差什么才能跑起来。
// 不修改任何东西，只输出「已有 / 缺失 / 下一步」。
// 用法：node scripts/verify-setup.mjs

import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
const results = [];
const add = (level, name, detail, next) => results.push({ level, name, detail, next });

function tcpOpen(port, host = '127.0.0.1', timeout = 800) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (ok) => { try { socket.destroy(); } catch {} resolve(ok); };
    socket.setTimeout(timeout);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function loopbackPorts() {
  let out = '';
  try { out = execFileSync('netstat', ['-ano'], { encoding: 'utf8', timeout: 15000 }); } catch { return []; }
  const ports = new Set();
  for (const line of out.split(/\r?\n/)) {
    const m = /^\s*TCP\s+(?:127\.0\.0\.1|\[::1\]):(\d+)\s+\S+\s+LISTENING\s+\d+\s*$/.exec(line);
    if (m) ports.add(Number(m[1]));
  }
  return [...ports];
}

// 1. Node 版本
const major = Number(process.versions.node.split('.')[0]);
const minor = Number(process.versions.node.split('.')[1]);
if (major > 22 || (major === 22 && minor >= 13)) add('ok', 'Node.js', `v${process.versions.node}`);
else add('bad', 'Node.js', `v${process.versions.node} 太低`, '安装 Node 22.13+，或用 DSH 自带运行时');

// 2. 依赖
if (fs.existsSync(path.join(ROOT, 'node_modules', '@snowluma', 'sdk'))) add('ok', 'Node 依赖', '已安装');
else add('bad', 'Node 依赖', '缺 node_modules', '在仓库根目录运行 npm install');

// 3. config.json
const cfgFile = path.join(ROOT, 'config.json');
const cfg = readJson(cfgFile);
if (!cfg) {
  add('bad', 'config.json', '不存在', '复制 config.example.json 为 config.json，并把 ownerQQ 改成你的 QQ 号');
} else if (!cfg.ownerQQ) {
  add('bad', 'config.json', 'ownerQQ 为空', '把 ownerQQ 填成你的 QQ 号，否则所有消息都会被拒绝');
} else {
  add('ok', 'config.json', `ownerQQ=${cfg.ownerQQ}`);
  if (!cfg.snowluma?.wsUrl) add('warn', 'snowluma.wsUrl', '未配置', '一般填 ws://127.0.0.1:3001');
  if (!cfg.snowluma?.httpUrl) add('warn', 'snowluma.httpUrl', '未配置', '一般填 http://127.0.0.1:3000');
}

// 4. DSH 可达性
let dshOk = false;
const baseUrl = String(cfg?.dsh?.baseUrl || '');
if (baseUrl) {
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/`, { signal: AbortSignal.timeout(1500) });
    dshOk = res.status === 200 || res.status === 401;
  } catch {}
}
if (!dshOk) {
  for (const port of loopbackPorts()) {
    if ([3000, 3001, 3100].includes(port)) continue;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(700), headers: { accept: 'text/html' } });
      if (res.ok) {
        const text = await res.text();
        if (text.includes('__DSH_BOOT__')) { dshOk = true; add('ok', 'DSH', `探测到 http://127.0.0.1:${port}`); break; }
      } else if (res.status === 401) {
        // 桌面版 DSH 的根路径对匿名请求返回 401，这是正常特征
        dshOk = true;
        add('ok', 'DSH', `探测到 http://127.0.0.1:${port}（需要登录态）`);
        break;
      }
    } catch {}
  }
}
if (!dshOk && baseUrl) add('warn', 'DSH', `config 里的 ${baseUrl} 当前不可用`, '打开 DeepSeek Harness 并登录；桥接启动时会自动同步端口');
else if (!dshOk) add('bad', 'DSH', '没有探测到运行中的 DSH', '打开 DeepSeek Harness 桌面版并登录');

// 5. SnowLuma 端口
const snowHttp = await tcpOpen(3000);
const snowWs = await tcpOpen(3001);
if (snowHttp && snowWs) add('ok', 'SnowLuma', '3000/3001 在监听');
else add('bad', 'SnowLuma', `HTTP 3000 ${snowHttp ? '通' : '不通'}，WS 3001 ${snowWs ? '通' : '不通'}`, '安装并启动 SnowLuma、扫码登录 QQ，并在 SnowLuma 里开启 OneBot HTTP(3000) 与 WS(3001)');

// 6. DSH 端 bundle（setup-dsh 会把 qq-agent-presets / qq-mode-console 注册进 profile）
let presetInstalled = false;
let presetProfile = '';
try {
  const profilesDir = path.join(HOME, 'profiles');
  for (const name of fs.readdirSync(profilesDir)) {
    const pkgPath = path.join(profilesDir, name, 'package.json');
    const pkg = readJson(pkgPath);
    const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
    if (deps['qq-agent-presets'] && deps['qq-mode-console']) { presetInstalled = true; presetProfile = name; break; }
  }
} catch {}
if (presetInstalled) add('ok', 'DSH preset', `已在 profile「${presetProfile}」注册 qq-agent-presets / qq-mode-console`);
else add('bad', 'DSH preset', 'profile 里还没有注册 qq-agent-presets / qq-mode-console', '运行 node scripts/setup-dsh.mjs（装完后重启一次 DSH）');

// 汇总
const bad = results.filter((r) => r.level === 'bad');
const warn = results.filter((r) => r.level === 'warn');
const icon = { ok: '✅', warn: '⚠️', bad: '❌' };
console.log('\n=== omnichat-agent 环境自检 ===');
for (const r of results) console.log(`${icon[r.level]} ${r.name}: ${r.detail}`);
if (bad.length) {
  console.log('\n下一步：');
  for (const r of bad) console.log(`  - ${r.next}`);
  process.exitCode = 1;
} else if (warn.length) {
  console.log('\n基本就绪，注意上面的 ⚠️ 项。');
} else {
  console.log('\n全部就绪，可以运行 start.bat（Windows）或 npm start。');
}
