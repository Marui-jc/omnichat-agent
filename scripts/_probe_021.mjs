// 临时探针：核对 DSH 0.2.1-rc.2 上 qq-bridge 依赖的几个写/读契约。
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { NodeApiClient, unwrap, discoverDshSessionCookie } from '../src/dsh-client.js';

const BASE = process.argv[2] || 'http://127.0.0.1:49672';
const cookie = discoverDshSessionCookie(BASE);
async function rpc(e, a) {
  const r = await fetch(`${BASE}/api/${e}`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId: 'x' + Math.random().toString(36).slice(2, 8), method: e, payload: { args: a } }),
  });
  return (await r.json()).result;
}

const st = await rpc('settings/describe', {});
const qqMode = st.value?.namespaces?.find((n) => n.ns === 'qq-mode');
console.log('[1] qq-mode value =', JSON.stringify(qqMode?.value), 'revision =', qqMode?.revision);
const wr = await rpc('settings/update', { ns: 'qq-mode', patch: { mode: qqMode?.value?.mode }, expectedRevision: qqMode?.revision });
console.log('[2] settings/update ok =', wr.ok, wr.ok ? JSON.stringify(wr.value?.value) : JSON.stringify(wr.error));

const api = new NodeApiClient(BASE, undefined, {});
await api.ensureAuth();
const cwd = path.join(os.tmpdir(), 'qq-bridge-probe-021');
fs.rmSync(cwd, { recursive: true, force: true });
fs.mkdirSync(cwd, { recursive: true });
const created = unwrap(await api.sessions.create({ cwd, agentPreset: 'qq-chat-v2' }), 'session.create');
const sessionId = created.sessionId;
console.log('[3] session created with qq-chat-v2 =', sessionId);

try {
  const projections = await api.callUnary('session/projections', { sessionId });
  const values = projections.result?.value?.values;
  console.log('[4] session/projections ok =', projections.result?.ok,
    'inbox keys =', Object.keys(values?.inbox ?? {}),
    'next-turn len =', values?.inbox?.['next-turn']?.length);

  const url = new URL('/api/remote.mux', BASE);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  const baseline = await new Promise((resolve, reject) => {
    const socket = new WebSocket(url, { headers: { cookie: api.cookie } });
    const streamId = randomUUID();
    const timer = setTimeout(() => { try { socket.close(); } catch {} reject(new Error('timeout')); }, 15000);
    socket.addEventListener('open', () => socket.send(JSON.stringify({ type: 'open', streamId, endpoint: 'session/control', payload: { args: {} } })));
    socket.addEventListener('message', (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.streamId !== streamId) return;
      clearTimeout(timer);
      try { socket.close(); } catch {}
      resolve(m);
    });
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('ws error')); });
  });
  const baselineValue = baseline?.payload?.value ?? baseline?.value;
  const pj = baselineValue?.projections ?? {};
  console.log('[5] session/control baseline ok, projections keys =', Object.keys(pj),
    'inbox shape =', Object.keys(pj[sessionId]?.values?.inbox ?? {}));
} finally {
  try { await api.workspace.archiveSession({ sessionId }); console.log('[6] probe session archived'); }
  catch (e) { console.log('[6] archive failed:', e?.message ?? e); }
}
