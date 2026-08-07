import { createInterface } from "node:readline";

import type { ReviewEndReason } from "./types.ts";

export function waitForEnterOrInterrupt(): Promise<ReviewEndReason> {
  return new Promise((resolve) => {
    const input = process.stdin;
    const wasRaw = input.isRaw;
    let finished = false;

    const finish = (reason: ReviewEndReason): void => {
      if (finished) {
        return;
      }
      finished = true;
      input.off("data", onData);
      process.off("SIGINT", onInterrupt);
      if (input.isTTY) {
        input.setRawMode(wasRaw);
      }
      input.pause();
      resolve(reason);
    };
    const onInterrupt = (): void => finish("interrupted");
    const onData = (chunk: Buffer | string): void => {
      const text = chunk.toString();
      if (text.includes("\u0003")) {
        finish("interrupted");
      } else if (text.includes("\n") || text.includes("\r")) {
        finish("completed");
      }
    };

    process.once("SIGINT", onInterrupt);
    input.on("data", onData);
    if (input.isTTY) {
      input.setRawMode(true);
    }
    input.resume();
  });
}

export function askYesNo(
  question: string,
  defaultValue: boolean,
  input: NodeJS.ReadableStream = process.stdin,
  output: NodeJS.WritableStream = process.stdout,
): Promise<boolean> {
  const readline = createInterface({
    input,
    output,
  });

  return new Promise((resolve) => {
    let answered = false;
    const finish = (answer: boolean): void => {
      if (answered) {
        return;
      }
      answered = true;
      readline.close();
      resolve(answer);
    };

    readline.once("SIGINT", () => finish(false));
    let suffix = "[y/N]";
    if (defaultValue) {
      suffix = "[Y/n]";
    }
    readline.question(`${question} ${suffix} `, (answer) => {
      const normalized = answer.trim().toLowerCase();
      if (normalized.length === 0) {
        finish(defaultValue);
        return;
      }
      finish(
        normalized === "y" || normalized === "yes" || normalized === "はい",
      );
    });
  });
}
