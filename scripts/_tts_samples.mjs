import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const token = fs.readFileSync(path.join(root, 'state', 'console-token'), 'utf8').trim();

const samples = [
  { text: '样本一，我是小肥鱼，这个声音会不会更像洛琪希？', voice: 'Microsoft Huihui Desktop', rate: 0, pitch: 15 },
  { text: '样本二，换了一个音色，你听听哪个更接近。', voice: 'Microsoft Yaoyao', rate: 0, pitch: 10 },
  { text: '样本三，音调再抬高一点，语速稍微放慢。', voice: 'Microsoft Huihui Desktop', rate: -2, pitch: 25 },
];

for (const sample of samples) {
  const res = await fetch('http://127.0.0.1:3100/api/voice/tts', {
    method: 'POST',
    headers: { 'x-console-token': token, 'content-type': 'application/json' },
    body: JSON.stringify(sample),
  });
  const body = await res.text();
  console.log('HTTP', res.status, body.slice(0, 200));
  await new Promise((r) => setTimeout(r, 4000));
}
