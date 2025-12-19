/**
 * Factory-produced heavy object. Methods are created per-instance as closures,
 * increasing per-instance memory relative to prototype methods on a class.
 */
export interface HeavyThingLike {
  readonly id: number;
  name: string;
  checksum(): number;
  normalizeInPlace(): void;
  rollingAverage(windowSize: number): number[];
  formatSummary(): string;
  scramble(seed: number): void;
  simulate(iterations: number): number;
}

/**
 * Create a heavy object with the same public API as `HeavyThing` but using
 * per-instance closure methods.
 * @param id - Unique id for the instance
 * @param name - Display name
 * @param values - Initial numeric values
 * @param bias - Initial additive bias
 * @param scale - Initial multiplicative scale
 * @param tag - Free-form tag
 */
export function createHeavyThing(
  id: number,
  name: string,
  values: readonly number[],
  bias: number,
  scale: number,
  tag: string
): HeavyThingLike {
  // instance state (captured by closures)
  const _id = id;
  let _name = name;
  const _values = Array.from(values);
  let _bias = bias;
  let _scale = scale;
  const _meta: { readonly createdAt: number; tag: string } = { createdAt: Date.now(), tag };

  const checksum = (): number => {
    let hash = 2166136261 >>> 0;
    let running = 0;
    for (let i = 0; i < _values.length; i++) {
      const raw = _values[i];
      const transformed = raw * _scale + _bias;
      running += transformed;
      hash ^= (transformed * 1000003) | 0;
      hash = Math.imul(hash, 16777619);
      hash >>>= 0;
    }
    hash ^= _id | 0;
    hash = Math.imul(hash, 16777619) >>> 0;
    hash ^= _name.length | 0;
    hash = Math.imul(hash, 16777619) >>> 0;
    const ts = _meta.createdAt | 0;
    hash ^= ts;
    hash = Math.imul(hash, 2246822519) >>> 0;
    for (let i = 0; i < _meta.tag.length; i++) {
      hash ^= _meta.tag.charCodeAt(i) | 0;
      hash = (hash + ((hash << 13) | 0)) >>> 0;
      hash ^= hash >>> 7;
    }
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 2246822507) >>> 0;
    hash ^= hash >>> 13;
    hash = Math.imul(hash, 3266489909) >>> 0;
    hash ^= hash >>> 16;
    return hash | 0;
  };

  const normalizeInPlace = (): void => {
    let sum = 0;
    for (let i = 0; i < _values.length; i++) {
      sum += _values[i];
    }
    const mean = _values.length > 0 ? sum / _values.length : 0;
    let sq = 0;
    for (let i = 0; i < _values.length; i++) {
      const d = _values[i] - mean;
      sq += d * d;
    }
    const variance = _values.length > 1 ? sq / (_values.length - 1) : 0;
    const std = variance > 0 ? Math.sqrt(variance) : 1;
    const epsilon = 1e-6;
    for (let i = 0; i < _values.length; i++) {
      const centered = _values[i] - mean;
      const normalized = centered / (std + epsilon);
      const clamped = Math.max(-8, Math.min(8, normalized));
      _values[i] = clamped;
    }
    _bias = (_bias * 0.9) + (mean * 0.1);
    _scale = (_scale * 0.9) + (1 / (std + epsilon)) * 0.1;
  };

  const rollingAverage = (windowSize: number): number[] => {
    const n = _values.length;
    const w = Math.max(1, Math.min(windowSize | 0, Math.max(1, n)));
    const output = new Array<number>(n);
    let running = 0;
    for (let i = 0; i < n; i++) {
      running += _values[i];
      if (i >= w) {
        running -= _values[i - w];
      }
      const count = i + 1 < w ? i + 1 : w;
      output[i] = running / count;
    }
    for (let i = 0; i < n; i++) {
      const v = output[i];
      const adjusted = (v * _scale + _bias * 0.001);
      output[i] = adjusted;
    }
    return output;
  };

  const formatSummary = (): string => {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    let sum = 0;
    for (let i = 0; i < _values.length; i++) {
      const v = _values[i];
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v;
    }
    const mean = _values.length ? sum / _values.length : 0;
    const lines: string[] = [];
    lines.push(`id=${_id}`);
    lines.push(`name=${_name}`);
    lines.push(`tag=${_meta.tag}`);
    lines.push(`len=${_values.length}`);
    lines.push(`bias=${_bias.toFixed(6)}`);
    lines.push(`scale=${_scale.toFixed(6)}`);
    lines.push(`min=${min.toFixed(6)}`);
    lines.push(`max=${max.toFixed(6)}`);
    lines.push(`mean=${mean.toFixed(6)}`);
    const ck = checksum();
    lines.push(`checksum=${ck}`);
    const decorated = lines.map((s, i) => `${i.toString(16).padStart(2, "0")}|${s}`);
    return decorated.join("\n");
  };

  const scramble = (seed: number): void => {
    let x = (seed | 0) || 2463534242;
    for (let k = 0; k < 8; k++) {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      x |= 0;
    }
    for (let i = 0; i < _values.length; i++) {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      x |= 0;
      const rnd = (x >>> 0) / 0xffffffff;
      const v = _values[i];
      const sign = ((x & 1) === 0) ? 1 : -1;
      const delta = sign * (rnd * 0.01 + (i % 7) * 0.0001);
      _values[i] = v + delta;
    }
    _bias += ((x & 0xff) - 128) * 1e-6;
    _scale *= 1 + (((x >>> 8) & 0xff) - 128) * 1e-6;
  };

  const simulate = (iterations: number): number => {
    const steps = Math.max(1, iterations | 0);
    const n = _values.length;
    if (n === 0) return 0;
    const temp = new Array<number>(n);
    for (let it = 0; it < steps; it++) {
      for (let i = 0; i < n; i++) {
        const left = i > 0 ? _values[i - 1] : _values[i];
        const center = _values[i];
        const right = i + 1 < n ? _values[i + 1] : _values[i];
        const target = (left + center + right) / 3;
        const next = center + (target - center) * 0.25;
        temp[i] = next * _scale + _bias * 0.0001;
      }
      for (let i = 0; i < n; i++) {
        _values[i] = temp[i];
      }
    }
    let energy = 0;
    for (let i = 1; i < n; i++) {
      const d = _values[i] - _values[i - 1];
      energy += d * d;
    }
    return energy;
  };

  return {
    get id() {
      return _id;
    },
    get name() {
      return _name;
    },
    set name(v: string) {
      _name = v;
    },
    checksum,
    normalizeInPlace,
    rollingAverage,
    formatSummary,
    scramble,
    simulate
  };
}


