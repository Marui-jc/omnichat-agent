import fs from 'node:fs';
import path from 'node:path';
import { synthesizeSpeechToWav, readWavInfo } from '../src/voice-tts.js';

const outDir = path.resolve(import.meta.dirname, '..', 'state', 'tts');
const wav = await synthesizeSpeechToWav('测试一下，我是小肥鱼，这是一条语音消息。', {
  voice: 'Microsoft Huihui Desktop',
  rate: 0,
  volume: 100,
  outDir,
});
const info = readWavInfo(wav);
console.log('file:', wav);
console.log('info:', JSON.stringify(info));
console.log('size KB:', (fs.statSync(wav).size / 1024).toFixed(1));
