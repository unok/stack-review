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

export function buildHunkFileDiffArgv(
  leftPath: string,
  rightPath: string,
): string[] {
  if (leftPath.length === 0 || rightPath.length === 0) {
    throw new TypeError("hunk diff file paths must not be empty");
  }
  return ["hunk", "diff", leftPath, rightPath];
}

export function buildHunkFileDiffCommand(
  leftPath: string,
  rightPath: string,
): string {
  return buildHunkFileDiffArgv(leftPath, rightPath)
    .map(quoteShellArgument)
    .join(" ");
}
