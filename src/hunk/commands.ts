import { quoteShellArgument } from "../shell.ts";

export function buildHunkDiffArgv(range: string): string[] {
  if (range.length === 0) {
    throw new TypeError("hunk diff range must not be empty");
  }
  return ["hunk", "diff", range];
}

export function buildHunkDiffCommand(range: string): string {
  return buildHunkDiffArgv(range).map(quoteShellArgument).join(" ");
}
