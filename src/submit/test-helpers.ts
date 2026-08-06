import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { descriptionDraftPath } from "../description.ts";
import type { CommandResult, CommandRunner } from "../exec.ts";
import type { Stack } from "../types.ts";

const temporaryDirectories: string[] = [];

function baseForLayer(layerNames: readonly string[], index: number): string {
  if (index === 0) {
    return "main-commit";
  }
  return `${layerNames[index - 1]}-commit`;
}

export async function temporaryDirectory(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "stack-review-submit-"));
  temporaryDirectories.push(path);
  return path;
}

export async function cleanTemporaryDirectories(): Promise<void> {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
}

export function success(stdout = ""): CommandResult {
  return { stdout, stderr: "", exitCode: 0 };
}

export function failure(stderr: string): CommandResult {
  return { stdout: "", stderr, exitCode: 1 };
}

export function commandStartsWith(
  argv: readonly string[],
  prefix: readonly string[],
): boolean {
  return argv.slice(0, prefix.length).join("\0") === prefix.join("\0");
}

export function commandRunner(
  resultFor: (argv: readonly string[]) => CommandResult,
): CommandRunner {
  return (argv) => Promise.resolve(resultFor(argv));
}

export function stack(layerNames: readonly string[]): Stack {
  return {
    trunk: "main",
    layers: layerNames.map((name, index) => ({
      name,
      base: baseForLayer(layerNames, index),
      stats: null,
    })),
  };
}

export function stackViewOutput(value: Stack): string {
  return JSON.stringify({
    trunk: value.trunk,
    branches: value.layers.map((layer) => ({
      name: layer.name,
      base: layer.base,
    })),
  });
}

export async function writeDraft(
  absoluteGitDir: string,
  branchName: string,
  content: string,
): Promise<void> {
  const path = descriptionDraftPath(absoluteGitDir, branchName);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
}
