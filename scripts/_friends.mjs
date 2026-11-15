import fs from 'node:fs';
const cfg = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const token = cfg.snowluma.accessToken;
const res = await fetch('http://127.0.0.1:3000/get_friend_list', {
  method: 'POST',
  headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  body: '{}',
});
const json = await res.json();
const list = json.data || [];
console.log('status', res.status, 'friends', list.length);
for (const f of list) console.log(' -', f.user_id, f.nickname || f.remark || '');
