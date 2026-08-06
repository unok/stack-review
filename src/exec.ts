import { execFile, spawn } from "node:child_process";

const COMMAND_NOT_FOUND_EXIT_CODE = 127;
const SPAWN_ERROR_EXIT_CODE = 1;

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export type CommandRunner = (argv: string[]) => Promise<CommandResult>;

export interface InteractiveCommandOptions {
  cwd?: string;
}

export const runCommand: CommandRunner = (argv) => {
  const [command, ...args] = argv;
  if (command === undefined) {
    return Promise.reject(new TypeError("command argv must not be empty"));
  }

  return new Promise((resolve) => {
    execFile(command, args, { encoding: "utf8" }, (error, stdout, stderr) => {
      if (error === null) {
        resolve({ stdout, stderr, exitCode: 0 });
        return;
      }

      let errorOutput = stderr;
      if (errorOutput.length === 0) {
        errorOutput = error.message;
      }

      let exitCode = -1;
      if (typeof error.code === "number") {
        exitCode = error.code;
      }

      resolve({ stdout, stderr: errorOutput, exitCode });
    });
  });
};

export function runInteractiveCommand(
  argv: string[],
  options: InteractiveCommandOptions = {},
): Promise<number> {
  const [command, ...args] = argv;
  if (command === undefined) {
    return Promise.reject(new TypeError("command argv must not be empty"));
  }

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: "inherit",
    });
    let settled = false;

    child.once("error", (error) => {
      if (!settled) {
        settled = true;
        process.stderr.write(`${error.message}\n`);
        if ("code" in error && error.code === "ENOENT") {
          resolve(COMMAND_NOT_FOUND_EXIT_CODE);
          return;
        }
        resolve(SPAWN_ERROR_EXIT_CODE);
      }
    });
    child.once("close", (exitCode) => {
      if (!settled) {
        settled = true;
        resolve(exitCode ?? -1);
      }
    });
  });
}
