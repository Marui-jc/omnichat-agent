// 离线 TTS：用 Windows 自带的 SAPI（System.Speech）把文字合成成 WAV。
//
// 为什么走 PowerShell：
//   · 桥接是纯 JS，没有 .NET 绑定；System.Speech 只能从 .NET 侧调用。
//   · 本机没有 ffmpeg/ffprobe，但 SnowLuma 自己会把 WAV 转成 SILK，所以只要能出声就行。
//   · spawn 用 stdio: 'ignore'（不是 pipe）：DSH 的受限沙箱里 pipe stdio 会直接 EPERM，
//     而 SAPI 是把音频写进文件、不需要 stdout，正好可用。
//
// 输出路径由调用方给（一般是 state/tts/），文件名带时间戳+随机后缀，便于清理。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

export const DEFAULT_TTS_VOICE = 'Microsoft Huihui Desktop';

const POWERSHELL = 'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';

/** PowerShell 单引号字符串转义：内部单引号写成两个单引号。 */
function psQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** SSML 文本转义。 */
function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * 把配置里的 pitch 归一成 SSML 的百分比字符串。
 * 数字按"相对默认音高的百分比"理解（15 → '+15%'）；字符串原样透传（如 '+20%'、'-5%'）。
 * 空值/0 返回 null，表示不加 prosody（走普通 Speak）。
 */
function normalizePitch(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return null;
    return /^[+-]?\d+(\.\d+)?%$/.test(s) ? s : null;
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return null;
  const clamped = Math.max(-50, Math.min(50, Math.round(n)));
  return `${clamped > 0 ? '+' : ''}${clamped}%`;
}

/**
 * 把文字合成成 WAV 文件，返回文件绝对路径。
 *
 * @param {string} text 要念的内容
 * @param {{ voice?: string, rate?: number, volume?: number, pitch?: number|string, outDir?: string, timeoutMs?: number }} options
 *        rate：SAPI 语速，-10..10（0 = 默认）；volume：0..100；
 *        pitch：音高偏移，数字按百分比（如 15 = +15%），或直接传 '+15%' 这样的 SSML 值。
 */
export async function synthesizeSpeechToWav(text, options = {}) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) throw new Error('TTS 文本为空');
  const voice = String(options.voice || DEFAULT_TTS_VOICE);
  const rate = Math.max(-10, Math.min(10, Math.trunc(Number(options.rate) || 0)));
  const volume = Math.max(0, Math.min(100, Math.trunc(Number.isFinite(Number(options.volume)) ? Number(options.volume) : 100)));
  const timeoutMs = Math.max(5000, Number(options.timeoutMs) || 30000);
  const pitch = normalizePitch(options.pitch);

  const dir = options.outDir ? path.resolve(options.outDir) : path.join(os.tmpdir(), 'qq-bridge-tts');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `tts-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.wav`);

  const speakLine = pitch
    // SSML 里必须转义 XML 特殊字符；pitch 走 prosody，语速仍用 SAPI 的 Rate
    ? `$s.SpeakSsml(${psQuote(`<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN"><prosody pitch="${pitch}">${xmlEscape(clean)}</prosody></speak>`)})`
    : `$s.Speak(${psQuote(clean)})`;

  const script = [
    'Add-Type -AssemblyName System.Speech',
    '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
    // 指定音色失败时别整体失败：系统里没有这个音色就用默认音色
    `try { $s.SelectVoice(${psQuote(voice)}) } catch { }`,
    `$s.Rate = ${rate}`,
    `$s.Volume = ${volume}`,
    `$s.SetOutputToWaveFile(${psQuote(file)})`,
    speakLine,
    '$s.Dispose()',
  ].join('\r\n');

  // -EncodedCommand 传 UTF-16LE base64：绕开引号/换行/中文在命令行里的转义问题
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  await new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(POWERSHELL, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], {
        stdio: 'ignore',
        windowsHide: true,
      });
    } catch (error) {
      reject(new Error(`TTS 启动失败：${error?.message ?? error}`));
      return;
    }
    const timer = setTimeout(() => {
      try { child.kill(); } catch {}
      reject(new Error('TTS 合成超时'));
    }, timeoutMs);
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(new Error(`TTS 启动失败：${error?.message ?? error}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`TTS 进程退出码 ${code}`));
    });
  });

  let size = 0;
  try { size = fs.statSync(file).size; } catch {}
  if (!size) throw new Error('TTS 没有产出音频文件（可能没装中文语音）');
  return file;
}

/**
 * 用外部 F5-TTS（克隆音色）合成：调用 python 脚本，产出一个 24kHz WAV。
 * 每次调用都是独立进程：模型加载 ~1.5s + 推理 3~6s（GPU）。
 *
 * @param {string} text
 * @param {{ python: string, script: string, packages?: string, outDir?: string, device?: string,
 *           refAudio?: string, refTextFile?: string, timeoutMs?: number }} options
 */
export async function synthesizeWithF5(text, options = {}) {
  // provider 切换：tts.f5.provider === 'cosyvoice' 时走 CosyVoice3 常驻服务，
  // F5 的旧逻辑保留但不再执行。
  if (options.provider === 'cosyvoice') return synthesizeWithCosyVoice(text, options);
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) throw new Error('TTS 文本为空');
  const python = options.python;
  const script = options.script;
  if (!python || !script) throw new Error('F5 TTS 未配置（tts.f5.python / tts.f5.script）');
  if (!fs.existsSync(python)) throw new Error(`F5 TTS 的 python 不存在：${python}`);
  if (!fs.existsSync(script)) throw new Error(`F5 TTS 脚本不存在：${script}`);

  const dir = options.outDir ? path.resolve(options.outDir) : path.join(os.tmpdir(), 'qq-bridge-tts');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const textFile = path.join(dir, `tts-text-${stamp}.txt`);
  const out = path.join(dir, `tts-${stamp}.wav`);
  fs.writeFileSync(textFile, clean, 'utf8');

  const args = [script, '--text-file', textFile, '--out', out];
  if (options.refAudio) args.push('--ref', options.refAudio);
  if (options.refTextFile) args.push('--ref-text-file', options.refTextFile);
  if (options.device) args.push('--device', options.device);
  if (options.speed) args.push('--speed', String(options.speed));
  if (options.pauseMode) args.push('--pause-mode', String(options.pauseMode));
  if (options.maxSegmentChars) args.push('--max-segment-chars', String(options.maxSegmentChars));
  if (options.secPerChar) args.push('--sec-per-char', String(options.secPerChar));
  if (options.cfgStrength) args.push('--cfg-strength', String(options.cfgStrength));
  if (options.pauseWords) args.push('--pause-words', String(options.pauseWords));

  const env = { ...process.env, PYTHONIOENCODING: 'utf-8' };
  if (options.packages) env.PYTHONPATH = options.packages;
  const timeoutMs = Math.max(30000, Number(options.timeoutMs) || 180000);

  await new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(python, args, { stdio: 'ignore', windowsHide: true, env });
    } catch (error) {
      reject(new Error(`F5 TTS 启动失败：${error?.message ?? error}`));
      return;
    }
    const timer = setTimeout(() => {
      try { child.kill(); } catch {}
      reject(new Error('F5 TTS 合成超时'));
    }, timeoutMs);
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(new Error(`F5 TTS 启动失败：${error?.message ?? error}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      fs.rmSync(textFile, { force: true });
      if (code === 0) resolve();
      else reject(new Error(`F5 TTS 进程退出码 ${code}`));
    });
  });

  let size = 0;
  try { size = fs.statSync(out).size; } catch {}
  if (!size) throw new Error('F5 TTS 没有产出音频文件');
  return out;
}

/**
 * 读 WAV 头，算时长/体积。TTS 产物是我们自己生成的，不需要 ffprobe 也知道格式。
 * 返回 { ok, bytes, seconds, byteRate, reason? }
 */
export function readWavInfo(file) {
  let buf;
  try { buf = fs.readFileSync(file); } catch (error) {
    return { ok: false, reason: `读取失败：${error?.message ?? error}` };
  }
  if (buf.length < 44 || buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WAVE') {
    return { ok: false, reason: '不是合法的 WAV 文件' };
  }
  let offset = 12;
  let byteRate = 0;
  let dataSize = 0;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('latin1', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === 'fmt ' && offset + 8 + 16 <= buf.length) {
      byteRate = buf.readUInt32LE(offset + 8 + 8); // fmt: format(2) channels(2) sampleRate(4) byteRate(4)
    } else if (id === 'data') {
      dataSize = Math.min(size, Math.max(0, buf.length - (offset + 8)));
      break;
    }
    offset += 8 + size + (size % 2);
  }
  if (!byteRate) return { ok: false, reason: 'WAV 缺少 fmt 块' };
  return { ok: true, bytes: buf.length, seconds: dataSize / byteRate, byteRate };
}

// ── CosyVoice3 常驻服务（FP16，约 3GB 显存，空闲自动退出） ─────────────────
// 服务由桥接按需拉起：先探 /health，不在就 spawn，再轮询到 ready。

const COSY_PORT = 3210;
let cosySpawnedAt = 0;

async function cosyHealth(baseUrl, timeoutMs = 1500) {
  try {
    const res = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function cosyBase(options) {
  if (options.serverUrl) return String(options.serverUrl).replace(/\/+$/, '');
  return `http://127.0.0.1:${options.port || COSY_PORT}`;
}

function spawnCosyServer(options) {
  const root = options.root;
  const python = options.python;
  const script = options.script;
  if (!root || !python || !script) throw new Error('CosyVoice 服务未配置（root / python / script）');
  const env = {
    ...process.env,
    PYTHONPATH: [options.packages, root, path.join(root, 'third_party', 'Matcha-TTS'), options.pkgs]
      .filter(Boolean)
      .join(';'),
    PYTHONIOENCODING: 'utf-8'
  };
  const args = [script, '--port', String(options.port || COSY_PORT), '--idle', String(options.idleSeconds || 600)];
  const proc = spawn(python, args, { cwd: root, env, detached: true, stdio: 'ignore', windowsHide: true });
  proc.unref();
  cosySpawnedAt = Date.now();
}

async function ensureCosyServer(options) {
  const base = cosyBase(options);
  let health = await cosyHealth(base, 1200);
  if (health && health.ready) return base;
  if (!health || !health.ready) {
    // 已有进程在加载中就别重复拉起（网络连通但 ready=false）
    if (!health) spawnCosyServer(options);
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      health = await cosyHealth(base, 2000);
      if (health && health.ready) return base;
    }
  }
  throw new Error('CosyVoice 服务启动超时（90s）');
}

/**
 * 调 CosyVoice3 常驻服务合成一句，返回 wav 路径。
 * @param {string} text
 * @param {{ serverUrl?: string, port?: number, root?: string, python?: string, script?: string,
 *           packages?: string, pkgs?: string, idleSeconds?: number, outDir?: string,
 *           refAudio?: string, refTextFile?: string, timeoutMs?: number, speed?: number }} options
 */
export async function synthesizeWithCosyVoice(text, options = {}) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) throw new Error('TTS 文本为空');
  const dir = options.outDir ? path.resolve(options.outDir) : path.join(os.tmpdir(), 'qq-bridge-tts');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const out = path.join(dir, `cosy-${stamp}.wav`);
  const base = await ensureCosyServer(options);
  const res = await fetch(`${base}/tts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      text: clean,
      out,
      speed: options.speed ?? 1.0,
      ...(options.instruct ? { instruct: String(options.instruct) } : {}),
      ref: options.refAudio || undefined,
      ref_text_file: options.refTextFile || undefined
    }),
    signal: AbortSignal.timeout(options.timeoutMs || 180000)
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload.ok) {
    throw new Error(`CosyVoice 合成失败：${payload.error || `HTTP ${res.status}`}`);
  }
  return payload.file || out;
}
