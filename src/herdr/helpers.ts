import type { CommandRunner } from "../exec.ts";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseJsonObject(
  output: string,
  context: string,
): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch (error: unknown) {
    throw new TypeError(`${context} output must be valid JSON`, {
      cause: error,
    });
  }

  if (!isRecord(parsed)) {
    throw new TypeError(`${context} output must be an object`);
  }
  return parsed;
}

export function requireRecord(
  record: Record<string, unknown>,
  key: string,
  context: string,
): Record<string, unknown> {
  const value = record[key];
  if (!isRecord(value)) {
    throw new TypeError(`${context}.${key} must be an object`);
  }
  return value;
}

export function requireString(
  record: Record<string, unknown>,
  key: string,
  context: string,
): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${context}.${key} must be a non-empty string`);
  }
  return value;
}

export function commandFailure(
  argv: readonly string[],
  stderr: string,
  exitCode: number,
): Error {
  const detail = stderr.trim();
  let suffix = "";
  if (detail.length > 0) {
    suffix = `: ${detail}`;
  }
  return new Error(`${argv.join(" ")} exited with code ${exitCode}${suffix}`);
}

export async function runSuccessful(
  run: CommandRunner,
  argv: string[],
): Promise<string> {
  const result = await run(argv);
  if (result.exitCode !== 0) {
    throw commandFailure(argv, result.stderr, result.exitCode);
  }
  return result.stdout;
}
