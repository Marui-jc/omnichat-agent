import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const token = fs.readFileSync(path.join(root, 'state', 'console-token'), 'utf8').trim();
const headers = { 'x-console-token': token, 'content-type': 'application/json' };
const add = Number(process.argv[2]);

const current = await (await fetch('http://127.0.0.1:3100/api/whitelist', { headers })).json();
const privates = [...new Set([...(current.allow?.private ?? []), add].filter((n) => Number.isFinite(Number(n))))];
const body = {
  allow: { private: privates, groups: current.allow?.groups ?? [] },
  deny: current.deny ?? { private: [], groups: [] },
};
const res = await fetch('http://127.0.0.1:3100/api/whitelist', {
  method: 'POST',
  headers,
  body: JSON.stringify(body),
});
console.log('HTTP', res.status);
console.log((await res.text()).slice(0, 400));
