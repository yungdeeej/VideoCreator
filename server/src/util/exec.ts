import { spawn } from "node:child_process";

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * Spawn a process and capture output. Rejects on non-zero exit unless
 * `allowFailure` is set. `onStderr` streams stderr lines (used to parse
 * ffmpeg progress).
 */
export function run(
  cmd: string,
  args: string[],
  opts: { onStderr?: (chunk: string) => void; allowFailure?: boolean } = {},
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => {
      const s = d.toString();
      stderr += s;
      opts.onStderr?.(s);
    });

    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      const result: RunResult = { code: code ?? -1, stdout, stderr };
      if (code === 0 || opts.allowFailure) resolve(result);
      else
        reject(
          new Error(
            `${cmd} exited with code ${code}\n${stderr.slice(-2000)}`,
          ),
        );
    });
  });
}
