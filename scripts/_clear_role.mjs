import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const token = fs.readFileSync(path.join(root, 'state', 'console-token'), 'utf8').trim();
const headers = { 'x-console-token': token, 'content-type': 'application/json' };

const res = await fetch('http://127.0.0.1:3100/api/role', {
  method: 'POST',
  headers,
  body: JSON.stringify({}),
});
console.log('clear role:', res.status, (await res.text()).slice(0, 200));

const list = await fetch('http://127.0.0.1:3100/api/roles', { headers });
const json = await list.json();
console.log('current role:', json.current);
