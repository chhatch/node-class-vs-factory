# Class vs Factory Memory Comparison (TypeScript/Node)

Compare memory usage when creating many instances via:

- a class with prototype methods
- a factory function that returns per-instance closure methods
- a factory function with thin wrapper methods that delegate to shared logic

Both approaches are run separately. Instances are retained in memory to avoid GC, then a V8 heap snapshot is taken for analysis.

## Requirements

- Node.js 18+ (Node 20+ recommended)
- Yarn

## Install & Build

```bash
yarn
yarn build
```

## Run

Run each approach separately. Always pass `--expose-gc` so `global.gc()` is available.

```bash
# Class-based instances
node --expose-gc dist/main.js --approach class --count 100000

# Factory-based instances
node --expose-gc dist/main.js --approach factory --count 100000

# Factory-thin (delegates heavy logic to shared functions)
node --expose-gc dist/main.js --approach factory-thin --count 100000
```

Output includes quick memory usage info and writes a heap snapshot:

- `heap-class-<count>.heapsnapshot`
- `heap-factory-<count>.heapsnapshot`
- `heap-factory-thin-<count>.heapsnapshot`

You can also use the provided scripts:

```bash
yarn start:class
yarn start:factory
yarn start:factory-thin
```

## CLI

```bash
node --expose-gc dist/main.js --approach class|factory|factory-thin --count <N>
```

## Inspecting the Heap Snapshots

- Open Chrome DevTools > Memory tab > Load the `.heapsnapshot`
- Or use Node/Chromium DevTools (`chrome://inspect`)
- Compare retained sizes and object graphs between the two runs

## Notes

- Methods in both implementations are intentionally long (~20+ LOC) to simulate substantial method bodies.
- The class approach shares a single set of methods via the prototype.
- The factory approach creates a fresh set of closure methods per instance, increasing per-instance memory.
