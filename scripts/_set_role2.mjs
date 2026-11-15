import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const token = fs.readFileSync(path.join(root, 'state', 'console-token'), 'utf8').trim();
const headers = { 'x-console-token': token, 'content-type': 'application/json' };
const wanted = process.argv[2] || '艾莉丝';

const set = await fetch('http://127.0.0.1:3100/api/role', {
  method: 'POST',
  headers,
  body: JSON.stringify({ role: wanted }),
});
console.log('set role:', set.status, (await set.text()).slice(0, 300));

const list = await fetch('http://127.0.0.1:3100/api/roles', { headers });
const json = await list.json();
console.log('current:', json.current);
for (const s of json.summaries || []) {
  if (s.name === wanted) console.log('summary:', JSON.stringify(s));
}
