import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8'));
const token = cfg.snowluma.accessToken;
const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

async function call(action, body) {
  const res = await fetch(`http://127.0.0.1:3000/${action}`, { method: 'POST', headers, body: JSON.stringify(body) });
  return res.json();
}

const target = Number(process.argv[2] || 2430418834);
const json = await call('get_friend_msg_history', { user_id: target, count: 10 });
console.log('status:', json.status, json.retcode);
const msgs = json.data?.messages ?? json.data ?? [];
for (const m of msgs.slice(-10)) {
  const text = (m.message ?? []).map((s) => s.data?.text ?? `[${s.type}]`).join('');
  console.log(`${m.sender?.user_id} -> ${text}`);
}
