import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const token = fs.readFileSync(path.join(root, 'state', 'console-token'), 'utf8').trim();
const res = await fetch('http://127.0.0.1:3100/api/voice/tts', {
  method: 'POST',
  headers: { 'x-console-token': token, 'content-type': 'application/json' },
  body: JSON.stringify({ text: process.argv[2] || '测试一下，我是小肥鱼，这是一条语音消息。' }),
});
console.log('HTTP', res.status);
console.log((await res.text()).slice(0, 500));
