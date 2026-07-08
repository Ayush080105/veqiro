import { spawn } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const runFfmpeg = (args: string[]): Promise<void> =>
  new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-2000)}`));
    });
  });

/**
 * Concatenate MP4 buffers (in order) into one MP4 buffer. Tries a fast stream-copy
 * concat first (works when the inputs share codec/resolution, which segments generated
 * by the same model call do); falls back to a re-encoding concat if that fails.
 */
export const concatVideos = async (buffers: Buffer[]): Promise<Buffer> => {
  if (buffers.length === 1) return buffers[0];

  const dir = await mkdtemp(path.join(tmpdir(), "maya-video-merge-"));
  try {
    const inputPaths = await Promise.all(
      buffers.map(async (buf, i) => {
        const p = path.join(dir, `part-${i}.mp4`);
        await writeFile(p, buf);
        return p;
      })
    );
    const listPath = path.join(dir, "concat-list.txt");
    const listContent = inputPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
    await writeFile(listPath, listContent);

    const outputPath = path.join(dir, "output.mp4");

    try {
      await runFfmpeg(["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outputPath]);
    } catch {
      // Fallback: re-encode when stream copy fails (e.g. minor codec parameter mismatch).
      await runFfmpeg([
        "-y", "-f", "concat", "-safe", "0", "-i", listPath,
        "-c:v", "libx264", "-c:a", "aac", outputPath,
      ]);
    }

    return await readFile(outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};
