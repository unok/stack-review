import { execFile } from "node:child_process";

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export type CommandRunner = (argv: string[]) => Promise<CommandResult>;

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
