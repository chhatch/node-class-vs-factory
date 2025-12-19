import fs from "fs";
import inspector from "inspector";
import type { HeapProfiler } from "inspector";

/**
 * Take a V8 heap snapshot and write it to a file.
 * Uses Node's inspector HeapProfiler APIs and streams chunks to disk.
 * @param filePath - Output .heapsnapshot path
 */
export async function takeHeapSnapshot(filePath: string): Promise<void> {
  const session = new inspector.Session();
  session.connect();

  const output = fs.createWriteStream(filePath, { encoding: "utf8" });
  const onChunk = (m: any) => {
    const chunk: unknown = m?.chunk ?? m?.params?.chunk;
    if (typeof chunk === "string") {
      output.write(chunk);
    } else if (chunk instanceof Uint8Array || Buffer.isBuffer(chunk)) {
      output.write(chunk);
    }
  };
  session.on("HeapProfiler.addHeapSnapshotChunk", onChunk);

  // Ensure HeapProfiler is enabled so events are emitted on all Node versions.
  await new Promise<void>((resolve, reject) => {
    session.post("HeapProfiler.enable", (err) =>
      err ? reject(err) : resolve()
    );
  });

  await new Promise<void>((resolve, reject) => {
    session.post(
      "HeapProfiler.takeHeapSnapshot",
      { reportProgress: false },
      (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });

  // Cleanup listeners and close out stream
  session.off("HeapProfiler.addHeapSnapshotChunk", onChunk);
  await new Promise<void>((resolve) => output.end(resolve));
  await new Promise<void>((resolve, reject) => {
    session.post("HeapProfiler.disable", (err) =>
      err ? reject(err) : resolve()
    );
  });
  session.disconnect();
}
