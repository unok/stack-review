const SHELL_SAFE_ARGUMENT = /^[A-Za-z0-9_@%+=:,./-]+$/;

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

export function requireNonNegativeInteger(
  record: Record<string, unknown>,
  key: string,
  context: string,
): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new TypeError(`${context}.${key} must be a non-negative integer`);
  }
  return value;
}

export function parseRangeStart(
  record: Record<string, unknown>,
  key: "newRange" | "oldRange",
  context: string,
): number | null {
  const value = record[key];
  if (value === undefined) {
    return null;
  }
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    value.some(
      (line) => typeof line !== "number" || !Number.isInteger(line) || line < 1,
    )
  ) {
    throw new TypeError(`${context}.${key} must be a positive integer pair`);
  }
  const [start, end] = value as [number, number];
  if (start > end) {
    throw new TypeError(`${context}.${key} start must not be after its end`);
  }
  return start;
}

export function commandFailure(
  command: string,
  stderr: string,
  exitCode: number,
): Error {
  const detail = stderr.trim();
  let suffix = "";
  if (detail.length > 0) {
    suffix = `: ${detail}`;
  }
  return new Error(`${command} exited with code ${exitCode}${suffix}`);
}

export function quoteShellArgument(argument: string): string {
  if (SHELL_SAFE_ARGUMENT.test(argument)) {
    return argument;
  }
  return `'${argument.replaceAll("'", `'"'"'`)}'`;
}
