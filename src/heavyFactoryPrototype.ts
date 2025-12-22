import type { HeavyThingLike } from "./heavyFactory";
interface State {
  id: number;
  name: string;
  values: number[];
  bias: number;
  scale: number;
  createdAt: number;
  tag: string;
}

/**
 * Factory that returns objects whose methods live on a shared prototype.
 * Instance-specific data is stored in a non-enumerable symbol property.
 */
export function createHeavyThingPrototype(
  id: number,
  name: string,
  values: readonly number[],
  bias: number,
  scale: number,
  tag: string
): HeavyThingLike {
  const state = {
    id,
    name,
    values: Array.from(values),
    bias,
    scale,
    createdAt: Date.now(),
    tag,
  };

  // Methods live on a shared prototype and operate directly on `this` state.
  const methods = {
    checksum,
    normalizeInPlace,
    rollingAverage,
    formatSummary,
    scramble,
    simulate,
  };

  // Create object with shared proto methods, then assign state fields as own props.
  const obj = withPrototype(state, methods);
  return obj;
}

function checksum(this: State): number {
  let hash = 2166136261 >>> 0;
  let running = 0;
  for (let i = 0; i < this.values.length; i++) {
    const raw = this.values[i];
    const transformed = raw * this.scale + this.bias;
    running += transformed;
    hash ^= (transformed * 1000003) | 0;
    hash = Math.imul(hash, 16777619);
    hash >>>= 0;
  }
  hash ^= this.id | 0;
  hash = Math.imul(hash, 16777619) >>> 0;
  hash ^= this.name.length | 0;
  hash = Math.imul(hash, 16777619) >>> 0;
  const ts = this.createdAt | 0;
  hash ^= ts;
  hash = Math.imul(hash, 2246822519) >>> 0;
  for (let i = 0; i < this.tag.length; i++) {
    hash ^= this.tag.charCodeAt(i) | 0;
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

function normalizeInPlace(this: State): void {
  let sum = 0;
  for (let i = 0; i < this.values.length; i++) {
    sum += this.values[i];
  }
  const mean = this.values.length > 0 ? sum / this.values.length : 0;
  let sq = 0;
  for (let i = 0; i < this.values.length; i++) {
    const d = this.values[i] - mean;
    sq += d * d;
  }

  const variance = this.values.length > 1 ? sq / (this.values.length - 1) : 0;
  const std = variance > 0 ? Math.sqrt(variance) : 1;
  const epsilon = 1e-6;
  for (let i = 0; i < this.values.length; i++) {
    const centered = this.values[i] - mean;
    const normalized = centered / (std + epsilon);
    const clamped = Math.max(-8, Math.min(8, normalized));
    this.values[i] = clamped;
  }
  this.bias = this.bias * 0.9 + mean * 0.1;
  this.scale = this.scale * 0.9 + (1 / (std + epsilon)) * 0.1;
}

function rollingAverage(this: State, windowSize: number): number[] {
  const n = this.values.length;
  const w = Math.max(1, Math.min(windowSize | 0, Math.max(1, n)));
  const output = new Array<number>(n);
  let running = 0;
  for (let i = 0; i < n; i++) {
    running += this.values[i];
    if (i >= w) {
      running -= this.values[i - w];
    }
    const count = i + 1 < w ? i + 1 : w;
    output[i] = running / count;
  }
  for (let i = 0; i < n; i++) {
    const v = output[i];
    const adjusted = v * this.scale + this.bias * 0.001;
    output[i] = adjusted;
  }
  return output;
}

function formatSummary(this: State): string {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let sum = 0;
  for (let i = 0; i < this.values.length; i++) {
    const v = this.values[i];
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  const mean = this.values.length ? sum / this.values.length : 0;
  const lines: string[] = [];
  lines.push(`id=${this.id}`);
  lines.push(`name=${this.name}`);
  lines.push(`tag=${this.tag}`);
  lines.push(`len=${this.values.length}`);
  lines.push(`bias=${this.bias.toFixed(6)}`);
  lines.push(`scale=${this.scale.toFixed(6)}`);
  lines.push(`min=${min.toFixed(6)}`);
  lines.push(`max=${max.toFixed(6)}`);
  lines.push(`mean=${mean.toFixed(6)}`);
  const ck = checksum.call(this);
  lines.push(`checksum=${ck}`);
  const decorated = lines.map(
    (s, i) => `${i.toString(16).padStart(2, "0")}|${s}`
  );
  return decorated.join("\n");
}

function scramble(this: State, seed: number): void {
  let x = seed | 0 || 2463534242;
  for (let k = 0; k < 8; k++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    x |= 0;
  }
  for (let i = 0; i < this.values.length; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    x |= 0;
    const rnd = (x >>> 0) / 0xffffffff;
    const v = this.values[i];
    const sign = (x & 1) === 0 ? 1 : -1;
    const delta = sign * (rnd * 0.01 + (i % 7) * 0.0001);
    this.values[i] = v + delta;
  }
  this.bias += ((x & 0xff) - 128) * 1e-6;
  this.scale *= 1 + (((x >>> 8) & 0xff) - 128) * 1e-6;
}

function simulate(this: State, iterations: number): number {
  const steps = Math.max(1, iterations | 0);
  const n = this.values.length;
  if (n === 0) return 0;
  const temp = new Array<number>(n);
  for (let it = 0; it < steps; it++) {
    for (let i = 0; i < n; i++) {
      const left = i > 0 ? this.values[i - 1] : this.values[i];
      const center = this.values[i];
      const right = i + 1 < n ? this.values[i + 1] : this.values[i];
      const target = (left + center + right) / 3;
      const next = center + (target - center) * 0.25;
      temp[i] = next * this.scale + this.bias * 0.0001;
    }
    for (let i = 0; i < n; i++) {
      this.values[i] = temp[i];
    }
  }
  let energy = 0;
  for (let i = 1; i < n; i++) {
    const d = this.values[i] - this.values[i - 1];
    energy += d * d;
  }
  return energy;
}

type AnyMethod = (this: any, ...args: any[]) => unknown;
type MethodMap = Record<PropertyKey, AnyMethod>;

// Turn a union into an intersection
type UnionToIntersection<U> = (
  U extends unknown ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never;

// Intersection of all `this` types across the methods
type ThisFromMethods<M extends MethodMap> = UnionToIntersection<
  ThisParameterType<M[keyof M]>
>;

// Remove `this` from method signatures for the returned value type
type MethodsWithoutThis<M extends MethodMap> = {
  [K in keyof M]: OmitThisParameter<M[K]>;
};

// Helper that enforces: state extends the methods' required `this`
function withPrototype<M extends MethodMap, S extends ThisFromMethods<M>>(
  state: S,
  proto: M
): S & MethodsWithoutThis<M> {
  // Object.setPrototypeOf is slightly more memory efficient but misuse has serious performance implications,
  // so it's best to use Object.assign instead.
  //   return Object.setPrototypeOf(state as object, proto) as any;
  return Object.assign(Object.create(proto), state);
}
