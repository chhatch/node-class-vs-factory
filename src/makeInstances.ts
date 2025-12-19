import { HeavyThing } from "./heavyClass";
import { createHeavyThing, type HeavyThingLike } from "./heavyFactory";
import { createHeavyThingThin } from "./heavyFactoryThin";

export type Approach = "class" | "factory" | "factory-thin";

/**
 * Module-level retention array to avoid GC of created instances.
 * Intentionally exported as read-only for visibility in tests if needed.
 */
export const retainedInstances: unknown[] = [];

/**
 * Generate a small, deterministic set of initial numeric values.
 * Kept small (e.g., 64) to avoid excessive allocation while ensuring non-trivial size.
 */
function generateInitialValues(seed: number, length = 64): number[] {
  const values = new Array<number>(length);
  let x = (seed | 0) || 123456789;
  for (let i = 0; i < length; i++) {
    // xorshift32
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    x |= 0;
    const rnd = (x >>> 0) / 0xffffffff;
    // values in a modest range centered near 0
    values[i] = (rnd - 0.5) * 2;
  }
  return values;
}

export interface MakeInstancesOptions {
  readonly approach: Approach;
  readonly count: number;
}

/**
 * Build and retain N instances according to the selected approach.
 * Instances are returned and also stored in a module-level array to avoid GC.
 */
export function makeInstances(options: MakeInstancesOptions): HeavyThingLike[] {
  const { approach, count } = options;
  const out: HeavyThingLike[] = new Array<HeavyThingLike>(count);
  for (let i = 0; i < count; i++) {
    const id = i + 1;
    const name = `obj_${id.toString(16)}`;
    const tag = (i % 3 === 0) ? "alpha" : (i % 3 === 1) ? "beta" : "gamma";
    const values = generateInitialValues(id, 64);
    const bias = (i % 7) * 0.01;
    const scale = 1 + ((i % 5) * 0.01);
    const inst =
      approach === "class"
        ? (new HeavyThing(id, name, values, bias, scale, tag) as unknown as HeavyThingLike)
        : approach === "factory"
        ? createHeavyThing(id, name, values, bias, scale, tag)
        : createHeavyThingThin(id, name, values, bias, scale, tag);
    out[i] = inst;
    retainedInstances.push(inst);
  }
  // Lightly touch the first few instances to discourage aggressive optimization.
  const touchCount = Math.min(10, out.length);
  for (let i = 0; i < touchCount; i++) {
    out[i].checksum();
  }
  return out;
}


