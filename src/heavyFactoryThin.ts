import type { HeavyThingLike } from "./heavyFactory";
import {
  type ThinState,
  doChecksum,
  doNormalizeInPlace,
  doRollingAverage,
  doFormatSummary,
  doScramble,
  doSimulate,
} from "./heavyLogic";

/**
 * Factory that returns objects with very small wrapper methods delegating
 * to shared heavy logic functions. The heavy logic is not recreated per instance.
 */
export function createHeavyThingThin(
  id: number,
  name: string,
  values: readonly number[],
  bias: number,
  scale: number,
  tag: string
): HeavyThingLike {
  const state: ThinState = {
    id,
    name,
    values: Array.from(values),
    bias,
    scale,
    createdAt: Date.now(),
    tag,
  };

  return {
    get id() {
      return state.id;
    },
    get name() {
      return state.name;
    },
    set name(v: string) {
      state.name = v;
    },
    checksum: () => doChecksum(state),
    normalizeInPlace: () => doNormalizeInPlace(state),
    rollingAverage: (windowSize: number) => doRollingAverage(state, windowSize),
    formatSummary: () => doFormatSummary(state),
    scramble: (seed: number) => doScramble(state, seed),
    simulate: (iterations: number) => doSimulate(state, iterations),
  };
}
