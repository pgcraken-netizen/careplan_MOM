"use client";

/*
 * 音声をブラウザ内で 16kHz・モノラルに変換し、短い WAV に分割する。
 * Vercel の関数は 1 リクエスト 4.5MB までなので、90 秒（約 2.9MB）ずつ送る。
 * 元の音声ファイルはサーバーに保存しない。
 */

const RATE = 16000;
export const CHUNK_SEC = 90;

export interface Chunk {
  index: number;
  offset: number; // 秒
  duration: number;
  wav: Blob;
}

export async function decodeToMono16k(file: Blob): Promise<Float32Array> {
  const buf = await file.arrayBuffer();
  const Ctx: typeof AudioContext =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  let ctx: AudioContext;
  try {
    ctx = new Ctx({ sampleRate: RATE });
  } catch {
    ctx = new Ctx();
  }
  try {
    const audio = await ctx.decodeAudioData(buf);
    if (audio.sampleRate === RATE && audio.numberOfChannels === 1) return audio.getChannelData(0).slice();
    // 16kHz モノラルへ変換
    const length = Math.ceil(audio.duration * RATE);
    const off = new OfflineAudioContext(1, length, RATE);
    const src = off.createBufferSource();
    src.buffer = audio;
    src.connect(off.destination);
    src.start();
    const rendered = await off.startRendering();
    return rendered.getChannelData(0).slice();
  } finally {
    ctx.close().catch(() => {});
  }
}

function encodeWav(samples: Float32Array): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buffer);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true);
  v.setUint32(28, RATE * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, "data");
  v.setUint32(40, samples.length * 2, true);
  let o = 44;
  for (let i = 0; i < samples.length; i++, o += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export function splitChunks(samples: Float32Array): Chunk[] {
  const size = CHUNK_SEC * RATE;
  const chunks: Chunk[] = [];
  for (let i = 0, idx = 0; i < samples.length; i += size, idx++) {
    const part = samples.subarray(i, Math.min(samples.length, i + size));
    if (part.length < RATE * 0.5) continue; // 0.5 秒未満は捨てる
    chunks.push({ index: idx, offset: i / RATE, duration: part.length / RATE, wav: encodeWav(part) });
  }
  return chunks;
}

export function durationOf(samples: Float32Array) {
  return samples.length / RATE;
}
