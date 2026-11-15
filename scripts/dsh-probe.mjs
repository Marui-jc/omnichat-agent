import fs from 'node:fs';
import net from 'node:net';

// 读取桥接配置里的 DSH 地址，做一次 TCP 探测；只输出 OK / NO，避免中文编码问题。
let baseUrl = '';
try {
  const cfg = JSON.parse(fs.readFileSync(new URL('../config.json', import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
  baseUrl = String(cfg?.dsh?.baseUrl || '');
} catch {
  console.log('NO');
  process.exit(0);
}

let host = '127.0.0.1';
let port = 0;
try {
  const u = new URL(baseUrl);
  host = u.hostname || host;
  port = Number(u.port) || (u.protocol === 'https:' ? 443 : 80);
} catch {
  console.log('NO');
  process.exit(0);
}
if (!port) {
  console.log('NO');
  process.exit(0);
}

const socket = net.connect({ host, port });
socket.setTimeout(2500);
let done = false;
const finish = (result) => {
  if (done) return;
  done = true;
  console.log(result);
  socket.destroy();
  process.exit(0);
};
socket.on('connect', () => finish('OK'));
socket.on('timeout', () => finish('NO'));
socket.on('error', () => finish('NO'));
