// DSH 桌面端每次重启都会换 Web 端口（实测一天内 62395 → 61164），
// 而桥接的 config.json 里 dsh.baseUrl 写死就会连不上事件流：表现为
// 「连接 DSH 事件流 → 本次收到 0 帧 → 断开」。
//
// 本脚本在桥接启动时跑一次：扫描本机回环监听端口，挑出真正在伺服 DSH 页面的那个
// （DSH 的 index.html 会注入 window.__DSH_BOOT__），不同就写回 config.json。
//
// 两种部署的鉴权形状不同，必须都认：
//   · dsh web（命令行）：根路径匿名可读，直接看 __DSH_BOOT__；
//   · DSH 桌面版：根路径对匿名请求返回 **401**，浏览器带会话 Cookie 才拿得到页面。
//     这里用 src/dsh-client.js 的离线铸造 Cookie 再探一次（与桥接鉴权同一条路）。
//
// 只用 Node 内置能力 + 本仓库的 dsh-client，不引入新依赖。

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { discoverDshSessionCookie } from '../src/dsh-client.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = path.join(ROOT, 'config.json');
const PROBE_TIMEOUT_MS = 900;
const AUTH_PROBE_TIMEOUT_MS = 2500;

function listeningLoopbackPorts() {
  const ports = new Set();
  let out = '';
  try {
    out = execFileSync('netstat', ['-ano'], { encoding: 'utf8', timeout: 15000 });
  } catch {
    return ports;
  }
  for (const line of out.split(/\r?\n/)) {
    const m = /^\s*TCP\s+(127\.0\.0\.1|\[::1\]):(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$/.exec(line);
    if (m) ports.add(Number(m[2]));
  }
  return ports;
}

async function looksLikeDsh(port) {
  const url = `http://127.0.0.1:${port}/`;
  let status = 0;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      headers: { accept: 'text/html' }
    });
    status = res.status;
    if (res.ok) {
      const text = await res.text();
      if (text.includes('__DSH_BOOT__')) return true;
    }
  } catch {
    return false;
  }
  // 桌面版 DSH 的根路径对匿名请求返回 401；用本机签名密钥离线铸造 Cookie 再探一次。
  // 别的 401 服务也会走到这里，但它们的页面不含 __DSH_BOOT__，不会误判。
  if (status !== 401) return false;
  const cookie = discoverDshSessionCookie(url);
  if (!cookie) return false;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(AUTH_PROBE_TIMEOUT_MS),
      headers: { accept: 'text/html', cookie }
    });
    if (!res.ok) return false;
    const text = await res.text();
    return text.includes('__DSH_BOOT__');
  } catch {
    return false;
  }
}

const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
const current = String(cfg.dsh?.baseUrl ?? '');
const currentPort = Number((/:(\d+)\/?$/.exec(current) ?? [])[1] ?? 0) || null;

const candidates = [...listeningLoopbackPorts()].filter((p) => p !== 3100);
const found = [];
for (const port of candidates) {
  if (await looksLikeDsh(port)) found.push(port);
}

if (!found.length) {
  console.log(`[port-sync] 没探测到 DSH 端口，保留 ${current || '(空)'}`);
  process.exit(0);
}

// 若有多个（理论上不该有），优先保留当前已配置的那个
const target = found.includes(currentPort) ? currentPort : found[0];
const nextBase = `http://127.0.0.1:${target}`;

if (nextBase === current) {
  console.log(`[port-sync] DSH 端口未变：${nextBase}`);
  process.exit(0);
}

cfg.dsh = { ...(cfg.dsh ?? {}), baseUrl: nextBase };
fs.writeFileSync(CONFIG, `${JSON.stringify(cfg, null, 2)}\n`, 'utf8');
console.log(`[port-sync] DSH 端口已同步：${current || '(空)'} -> ${nextBase}`);
