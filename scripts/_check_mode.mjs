import { discoverDshSessionCookie } from '../src/dsh-client.js';
import fs from 'node:fs';
import path from 'node:path';

const cfg = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '..', 'config.json'), 'utf8'));
const BASE = cfg.dsh.baseUrl.replace(/\/+$/, '');
const cookie = discoverDshSessionCookie(BASE);
const res = await fetch(`${BASE}/api/settings/describe`, {
  method: 'POST',
  headers: { cookie, 'content-type': 'application/json' },
  body: JSON.stringify({ type: 'client-request', rpcId: 'q1', method: 'settings/describe', payload: { args: {} } }),
});
const json = await res.json();
const ns = (json.result?.value?.namespaces ?? []).find((n) => n.ns === 'qq-mode');
console.log('base', BASE, '-> qq-mode =', JSON.stringify(ns?.value));
