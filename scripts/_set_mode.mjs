import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const token = fs.readFileSync(path.join(root, 'state', 'console-token'), 'utf8').trim();
const res = await fetch('http://127.0.0.1:3100/api/mode', {
  method: 'POST',
  headers: { 'x-console-token': token, 'content-type': 'application/json' },
  body: JSON.stringify({ mode: process.argv[2] || 'chat' }),
});
const text = await res.text();
console.log('HTTP', res.status);
console.log(text.slice(0, 600));
