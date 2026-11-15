import { discoverDshSessionCookie } from '../src/dsh-client.js';

const BASE = process.argv[2] || 'http://127.0.0.1:49672';
const cookie = discoverDshSessionCookie(BASE);
console.log('cookie:', cookie ? `${cookie.length} bytes` : 'FAILED');
async function rpc(e, a) {
  const r = await fetch(`${BASE}/api/${e}`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId: 'p' + Math.random().toString(36).slice(2, 8), method: e, payload: { args: a } }),
  });
  return (await r.json()).result;
}
const ap = await rpc('agentPresets/list', {});
console.log('presets:', (ap.value?.presets ?? []).map((p) => p.id).join(', '));
const st = await rpc('settings/describe', {});
console.log('namespaces:', (st.value?.namespaces ?? []).map((n) => n.ns).join(', '));
