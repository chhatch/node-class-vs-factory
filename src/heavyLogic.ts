export interface ThinState {
  id: number;
  name: string;
  values: number[];
  bias: number;
  scale: number;
  createdAt: number;
  tag: string;
}

export function doChecksum(state: ThinState): number {
  let hash = 2166136261 >>> 0; // FNV-1a base
  let running = 0;
  for (let i = 0; i < state.values.length; i++) {
    const raw = state.values[i];
    const transformed = raw * state.scale + state.bias;
    running += transformed;
    hash ^= (transformed * 1000003) | 0;
    hash = Math.imul(hash, 16777619);
    hash >>>= 0;
  }
  hash ^= state.id | 0;
  hash = Math.imul(hash, 16777619) >>> 0;
  hash ^= state.name.length | 0;
  hash = Math.imul(hash, 16777619) >>> 0;
  const ts = state.createdAt | 0;
  hash ^= ts;
  hash = Math.imul(hash, 2246822519) >>> 0;
  for (let i = 0; i < state.tag.length; i++) {
    hash ^= state.tag.charCodeAt(i) | 0;
    hash = (hash + ((hash << 13) | 0)) >>> 0;
    hash ^= hash >>> 7;
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 2246822507) >>> 0;
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 3266489909) >>> 0;
  hash ^= hash >>> 16;
  return hash | 0;
}

export function doNormalizeInPlace(state: ThinState): void {
  let sum = 0;
  for (let i = 0; i < state.values.length; i++) {
    sum += state.values[i];
  }
  const mean = state.values.length > 0 ? sum / state.values.length : 0;
  let sq = 0;
  for (let i = 0; i < state.values.length; i++) {
    const d = state.values[i] - mean;
    sq += d * d;
  }
  const variance = state.values.length > 1 ? sq / (state.values.length - 1) : 0;
  const std = variance > 0 ? Math.sqrt(variance) : 1;
  const epsilon = 1e-6;
  for (let i = 0; i < state.values.length; i++) {
    const centered = state.values[i] - mean;
    const normalized = centered / (std + epsilon);
    const clamped = Math.max(-8, Math.min(8, normalized));
    state.values[i] = clamped;
  }
  state.bias = state.bias * 0.9 + mean * 0.1;
  state.scale = state.scale * 0.9 + (1 / (std + epsilon)) * 0.1;
}

export function doRollingAverage(state: ThinState, windowSize: number): number[] {
  const n = state.values.length;
  const w = Math.max(1, Math.min(windowSize | 0, Math.max(1, n)));
  const output = new Array<number>(n);
  let running = 0;
  for (let i = 0; i < n; i++) {
    running += state.values[i];
    if (i >= w) {
      running -= state.values[i - w];
    }
    const count = i + 1 < w ? i + 1 : w;
    output[i] = running / count;
  }
  for (let i = 0; i < n; i++) {
    const v = output[i];
    const adjusted = v * state.scale + state.bias * 0.001;
    output[i] = adjusted;
  }
  return output;
}

export function doFormatSummary(state: ThinState): string {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let sum = 0;
  for (let i = 0; i < state.values.length; i++) {
    const v = state.values[i];
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  const mean = state.values.length ? sum / state.values.length : 0;
  const lines: string[] = [];
  lines.push(`id=${state.id}`);
  lines.push(`name=${state.name}`);
  lines.push(`tag=${state.tag}`);
  lines.push(`len=${state.values.length}`);
  lines.push(`bias=${state.bias.toFixed(6)}`);
  lines.push(`scale=${state.scale.toFixed(6)}`);
  lines.push(`min=${min.toFixed(6)}`);
  lines.push(`max=${max.toFixed(6)}`);
  lines.push(`mean=${mean.toFixed(6)}`);
  const ck = doChecksum(state);
  lines.push(`checksum=${ck}`);
  const decorated = lines.map((s, i) => `${i.toString(16).padStart(2, "0")}|${s}`);
  return decorated.join("\n");
}

export function doScramble(state: ThinState, seed: number): void {
  let x = (seed | 0) || 2463534242;
  for (let k = 0; k < 8; k++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    x |= 0;
  }
  for (let i = 0; i < state.values.length; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    x |= 0;
    const rnd = (x >>> 0) / 0xffffffff;
    const v = state.values[i];
    const sign = (x & 1) === 0 ? 1 : -1;
    const delta = sign * (rnd * 0.01 + (i % 7) * 0.0001);
    state.values[i] = v + delta;
  }
  state.bias += ((x & 0xff) - 128) * 1e-6;
  state.scale *= 1 + (((x >>> 8) & 0xff) - 128) * 1e-6;
}

export function doSimulate(state: ThinState, iterations: number): number {
  const steps = Math.max(1, iterations | 0);
  const n = state.values.length;
  if (n === 0) return 0;
  const temp = new Array<number>(n);
  for (let it = 0; it < steps; it++) {
    for (let i = 0; i < n; i++) {
      const left = i > 0 ? state.values[i - 1] : state.values[i];
      const center = state.values[i];
      const right = i + 1 < n ? state.values[i + 1] : state.values[i];
      const target = (left + center + right) / 3;
      const next = center + (target - center) * 0.25;
      temp[i] = next * state.scale + state.bias * 0.0001;
    }
    for (let i = 0; i < n; i++) {
      state.values[i] = temp[i];
    }
  }
  let energy = 0;
  for (let i = 1; i < n; i++) {
    const d = state.values[i] - state.values[i - 1];
    energy += d * d;
  }
  return energy;
}


