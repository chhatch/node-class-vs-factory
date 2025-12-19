/**
 * Represents a heavy object implemented as a class with prototype methods.
 * Methods are intentionally long (20+ lines each) to simulate substantial logic while
 * avoiding large per-call allocations. The class form ensures methods live on the prototype
 * and are shared across instances.
 */
export class HeavyThing {
  /** Unique identifier for the instance. */
  public readonly id: number;
  /** Human-friendly name of the instance. */
  public name: string;
  /** Numeric values used by computations. */
  private readonly values: number[];
  /** Linear transform bias applied by some methods. */
  private bias: number;
  /** Linear transform scale applied by some methods. */
  private scale: number;
  /** Misc metadata not used for heavy allocations. */
  private readonly meta: { readonly createdAt: number; tag: string };

  /**
   * Create a new `HeavyThing`.
   * @param id - Unique id for the instance
   * @param name - Display name
   * @param values - Initial numeric values (kept small to avoid heavy allocations)
   * @param bias - Initial additive bias
   * @param scale - Initial multiplicative scale
   * @param tag - Free-form tag for grouping
   */
  constructor(
    id: number,
    name: string,
    values: readonly number[],
    bias: number,
    scale: number,
    tag: string
  ) {
    this.id = id;
    this.name = name;
    this.values = Array.from(values);
    this.bias = bias;
    this.scale = scale;
    this.meta = { createdAt: Date.now(), tag };
  }

  /**
   * Compute a stable checksum across values incorporating bias and scale.
   * The implementation is deliberately verbose to increase method body size.
   * @returns A 32-bit integer checksum.
   */
  public checksum(): number {
    let hash = 2166136261 >>> 0; // FNV-1a base
    let running = 0;
    // Step 1: combine scaled and biased values
    for (let i = 0; i < this.values.length; i++) {
      const raw = this.values[i];
      const transformed = raw * this.scale + this.bias;
      running += transformed;
      // fold into hash
      hash ^= (transformed * 1000003) | 0;
      hash = Math.imul(hash, 16777619);
      hash >>>= 0;
    }
    // Step 2: incorporate id and name length
    hash ^= this.id | 0;
    hash = Math.imul(hash, 16777619) >>> 0;
    hash ^= this.name.length | 0;
    hash = Math.imul(hash, 16777619) >>> 0;
    // Step 3: mix metadata timestamp and tag chars
    const ts = this.meta.createdAt | 0;
    hash ^= ts;
    hash = Math.imul(hash, 2246822519) >>> 0;
    for (let i = 0; i < this.meta.tag.length; i++) {
      hash ^= this.meta.tag.charCodeAt(i) | 0;
      hash = (hash + ((hash << 13) | 0)) >>> 0;
      hash ^= hash >>> 7;
    }
    // Step 4: final avalanche
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 2246822507) >>> 0;
    hash ^= hash >>> 13;
    hash = Math.imul(hash, 3266489909) >>> 0;
    hash ^= hash >>> 16;
    return hash | 0;
  }

  /**
   * Normalize values in place using mean and standard deviation, with guards against
   * degenerate variance. Updates internal bias/scale heuristically.
   */
  public normalizeInPlace(): void {
    // mean
    let sum = 0;
    for (let i = 0; i < this.values.length; i++) {
      sum += this.values[i];
    }
    const mean = this.values.length > 0 ? sum / this.values.length : 0;
    // variance
    let sq = 0;
    for (let i = 0; i < this.values.length; i++) {
      const d = this.values[i] - mean;
      sq += d * d;
    }
    const variance = this.values.length > 1 ? sq / (this.values.length - 1) : 0;
    const std = variance > 0 ? Math.sqrt(variance) : 1;
    // normalize and apply small smoothing to avoid denormals
    const epsilon = 1e-6;
    for (let i = 0; i < this.values.length; i++) {
      const centered = this.values[i] - mean;
      const normalized = centered / (std + epsilon);
      // gentle clamp to [-8, 8]
      const clamped = Math.max(-8, Math.min(8, normalized));
      // write back
      (this.values as number[])[i] = clamped;
    }
    // update bias/scale heuristically to track normalization history
    this.bias = (this.bias * 0.9) + (mean * 0.1);
    this.scale = (this.scale * 0.9) + (1 / (std + epsilon)) * 0.1;
  }

  /**
   * Compute a rolling average over the internal values with the provided window size.
   * Produces a new array but remains modest in size (same length as values).
   * @param windowSize - Size of the moving window (>=1)
   * @returns Moving averages
   */
  public rollingAverage(windowSize: number): number[] {
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
    // add tiny transformation to avoid constant folding
    for (let i = 0; i < n; i++) {
      const v = output[i];
      const adjusted = (v * this.scale + this.bias * 0.001);
      output[i] = adjusted;
    }
    return output;
  }

  /**
   * Produce a formatted summary string of the current state.
   * The lengthy body adds a series of small computations to keep the method sizable.
   * @returns Summary string
   */
  public formatSummary(): string {
    // stats
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
    // build lines
    const lines: string[] = [];
    lines.push(`id=${this.id}`);
    lines.push(`name=${this.name}`);
    lines.push(`tag=${this.meta.tag}`);
    lines.push(`len=${this.values.length}`);
    lines.push(`bias=${this.bias.toFixed(6)}`);
    lines.push(`scale=${this.scale.toFixed(6)}`);
    lines.push(`min=${min.toFixed(6)}`);
    lines.push(`max=${max.toFixed(6)}`);
    lines.push(`mean=${mean.toFixed(6)}`);
    // append small checksum details
    const ck = this.checksum();
    lines.push(`checksum=${ck}`);
    // few decorative transforms
    const decorated = lines.map((s, i) => `${i.toString(16).padStart(2, "0")}|${s}`);
    return decorated.join("\n");
  }

  /**
   * Scramble internal values using a xorshift32-based PRNG seeded by the input.
   * @param seed - Seed value
   */
  public scramble(seed: number): void {
    let x = (seed | 0) || 2463534242;
    // run a number of PRNG rounds to decorrelate seeds
    for (let k = 0; k < 8; k++) {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      x |= 0;
    }
    for (let i = 0; i < this.values.length; i++) {
      // xorshift
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      x |= 0;
      const rnd = (x >>> 0) / 0xffffffff;
      const v = this.values[i];
      // small perturbations
      const sign = ((x & 1) === 0) ? 1 : -1;
      const delta = sign * (rnd * 0.01 + (i % 7) * 0.0001);
      (this.values as number[])[i] = v + delta;
    }
    // tweak bias/scale slightly to reflect scramble
    this.bias += ((x & 0xff) - 128) * 1e-6;
    this.scale *= 1 + (((x >>> 8) & 0xff) - 128) * 1e-6;
  }

  /**
   * Run a small simulation that iteratively relaxes values toward their neighborhood mean.
   * Returns a compact energy metric.
   * @param iterations - Number of iterations to perform
   * @returns energy metric
   */
  public simulate(iterations: number): number {
    const steps = Math.max(1, iterations | 0);
    const n = this.values.length;
    if (n === 0) return 0;
    // local buffer to avoid large allocations
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
        (this.values as number[])[i] = temp[i];
      }
    }
    // compute energy as sum of squared diffs
    let energy = 0;
    for (let i = 1; i < n; i++) {
      const d = this.values[i] - this.values[i - 1];
      energy += d * d;
    }
    return energy;
  }
}


