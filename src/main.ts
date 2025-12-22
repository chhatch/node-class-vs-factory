/* eslint-disable no-console */
import path from "path";
import fs from "fs";
import { makeInstances, type Approach } from "./makeInstances";
import { takeHeapSnapshot } from "./snapshot";

interface CliOptions {
  approach: Approach;
  count: number;
}

function printUsage(): void {
  console.log("Usage:");
  console.log(
    "  node --expose-gc dist/main.js --approach class|factory|factory-thin|factory-prototype --count <N>"
  );
}

function parseArgs(argv: string[]): CliOptions | null {
  let approach: Approach | null = null;
  let count: number | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--approach" && i + 1 < argv.length) {
      const val = argv[++i] as Approach;
      if (
        val === "class" ||
        val === "factory" ||
        val === "factory-thin" ||
        val === "factory-prototype"
      ) {
        approach = val;
      }
    } else if (a === "--count" && i + 1 < argv.length) {
      const n = Number(argv[++i]);
      if (Number.isFinite(n) && n > 0) {
        count = Math.floor(n);
      }
    }
  }
  if (!approach || !count) return null;
  return { approach, count };
}

function memorySnapshotLabel(): string {
  const mu = process.memoryUsage();
  return [
    `rss=${(mu.rss / (1024 * 1024)).toFixed(1)}MB`,
    `heapUsed=${(mu.heapUsed / (1024 * 1024)).toFixed(1)}MB`,
    `heapTotal=${(mu.heapTotal / (1024 * 1024)).toFixed(1)}MB`,
    `ext=${(mu.external / (1024 * 1024)).toFixed(1)}MB`,
  ].join(", ");
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts) {
    printUsage();
    process.exitCode = 1;
    return;
  }
  if (typeof gc !== "function") {
    console.warn(
      "Warning: global.gc() not available. Run with: node --expose-gc dist/main.js ..."
    );
  }

  console.log(`Approach: ${opts.approach}, Count: ${opts.count}`);
  console.log(`Before create -> ${memorySnapshotLabel()}`);

  const beforeCreateHeapUsed = process.memoryUsage().heapUsed;
  const instances = makeInstances({
    approach: opts.approach,
    count: opts.count,
  });
  // Touch one method of the last instance to be sure code paths are exercised.
  if (instances.length > 0) {
    instances[instances.length - 1].checksum();
  }

  if (typeof gc === "function") {
    gc();
  }
  const afterCreateHeapUsed = process.memoryUsage().heapUsed;
  console.log(`After create+gc -> ${memorySnapshotLabel()}`);
  console.log(
    "Creation delta (heapUsed):",
    ((afterCreateHeapUsed - beforeCreateHeapUsed) / (1024 * 1024)).toFixed(2),
    "MB"
  );

  const hsFile = path.resolve(
    process.cwd(),
    `heap-${opts.approach}-${opts.count}.heapsnapshot`
  );
  // ensure dir exists (cwd should exist; guard only for path resolution)
  const dir = path.dirname(hsFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  console.log(`Taking heap snapshot -> ${hsFile}`);
  await takeHeapSnapshot(hsFile);
  console.log("Done.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exitCode = 1;
});
