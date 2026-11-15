// 下载开放授权表情（Twemoji, CC-BY 4.0）到本地图库，并写入 state/stickers.json。
//
// 版权：Twemoji 图形由 Twitter 以 CC-BY 4.0 发布，允许转载/修改，需署名。
// 素材来源：https://github.com/jdecked/twemoji （CC-BY 4.0）
// 本脚本只下载固定清单，不抓取任何网站内容。

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(import.meta.dirname, '..');
const STATE = path.join(ROOT, 'state');
const ASSETS = path.join(STATE, 'sticker-assets');
const STORE = path.join(STATE, 'stickers.json');
const CDN = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/';

const EMOJI = [
  ['1f602', '笑哭', '笑到不行，最常用', ['笑', '哈哈']],
  ['1f600', '开心', '咧嘴笑', ['开心', '笑']],
  ['1f60a', '微笑', '温柔地笑一下', ['微笑']],
  ['1f604', '大笑', '眯眼大笑', ['笑', '开心']],
  ['1f622', '哭', '掉眼泪', ['哭', '难过']],
  ['1f62d', '嚎哭', '放声大哭', ['大哭']],
  ['1f621', '生气', '气鼓鼓', ['生气']],
  ['1f624', '哼', '不服气，哼一声', ['不服', '哼']],
  ['1f914', '思考', '摸着下巴想', ['思考', '疑问']],
  ['1f644', '无语', '翻白眼，表示无语', ['无语', '白眼']],
  ['1f612', '无奈', '无奈脸', ['无奈']],
  ['1f62e', '惊讶', '有点吃惊', ['惊讶']],
  ['1f631', '震惊', '被吓到了', ['震惊']],
  ['1f628', '害怕', '瑟瑟发抖', ['害怕', '抖']],
  ['1f634', '困', '困了想睡', ['困', '睡觉']],
  ['1f971', '打哈欠', '好困啊', ['困']],
  ['1f44d', '赞', '点赞，可以', ['赞', '好']],
  ['1f44f', '鼓掌', '鼓掌叫好', ['鼓掌', '好']],
  ['1f64f', '拜托', '合掌拜托', ['拜托', '求']],
  ['1f64c', '举手', '举手报名', ['举手', '我来']],
  ['1f4aa', '加油', '肌肉，加油', ['加油', '努力']],
  ['1f91d', '握手', '成交', ['握手', '成交']],
  ['2764', '心', '比心', ['心', '爱']],
  ['1f494', '心碎', '心碎了', ['心碎', '难过']],
  ['1f525', '火', '太强了', ['牛', '火']],
  ['2728', '闪', '闪闪发光', ['闪', '亮']],
  ['1f389', '庆祝', '撒花庆祝', ['庆祝', '撒花']],
  ['1f923', '笑抽', '笑到打滚', ['笑死']],
  ['1f60f', '得意', '得意的笑', ['得意']],
  ['1f609', '眨眼', '你懂的', ['暗示', '眨眼']],
  ['1f480', '骷髅', '笑死了', ['笑死']],
  ['1f921', '小丑', '小丑竟是我自己', ['自嘲', '小丑']],
  ['1f928', '嫌弃', '一脸嫌弃', ['嫌弃']],
  ['1f63a', '猫猫笑', '猫猫在笑', ['猫', '笑']],
  ['1f436', '狗头', '狗头保命', ['狗头', '保命']],
  ['1f60e', '酷', '戴墨镜，酷', ['酷']],
];

fs.mkdirSync(ASSETS, { recursive: true });

function readStore() {
  try {
    const text = fs.readFileSync(STORE, 'utf8').replace(/^\ufeff/, '');
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const existing = readStore().filter((e) => !String(e?.id || '').startsWith('local:'));
const now = new Date().toISOString();
const added = [];

for (const [cp, desc, note, tags] of EMOJI) {
  const file = `${cp}.png`;
  const out = path.join(ASSETS, file);
  try {
    if (!fs.existsSync(out) || fs.statSync(out).size < 200) {
      const res = await fetch(CDN + file, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 200 || buf[0] !== 0x89 || buf[1] !== 0x50) throw new Error('不是 PNG');
      fs.writeFileSync(out, buf);
    }
    const bytes = fs.readFileSync(out);
    added.push({
      id: `local:${cp}`,
      resId: `local:${cp}`,
      url: '',
      localFile: file,
      credit: 'Twemoji (CC-BY 4.0) github.com/jdecked/twemoji',
      md5: crypto.createHash('md5').update(bytes).digest('hex').toUpperCase(),
      desc,
      localNote: note,
      tags,
      usage: '',
      source: 'manual',
      useCount: 0,
      lastUsedAt: 0,
      lastContext: '',
      createdAt: now,
      updatedAt: now,
    });
    console.log('ok', cp, desc, bytes.length + 'B');
  } catch (error) {
    console.log('skip', cp, desc, error.message);
  }
}

const merged = [...existing, ...added];
fs.writeFileSync(STORE, JSON.stringify(merged, null, 2), 'utf8');
fs.writeFileSync(
  path.join(ASSETS, 'CREDITS.txt'),
  '表情图形来自 Twemoji（https://github.com/jdecked/twemoji），\n以 CC-BY 4.0 许可发布，详见 https://creativecommons.org/licenses/by/4.0/\n',
  'utf8'
);
console.log(`DONE 写入 ${added.length} 个本地表情，库内共 ${merged.length} 条`);
