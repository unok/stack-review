import type {
  DiffStats,
  Layer,
  StackViewResult,
  WorkingTreeStatus,
} from "./types.ts";

const NOT_IN_STACK_PATTERN = /current branch "([^"]+)" is not part of a stack/;
const LINE_SEPARATOR_PATTERN = /\r?\n/;
const NUMSTAT_LINE_PATTERN = /^([0-9]+|-)\t([0-9]+|-)\t(.+)$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(
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

function parseStackObject(input: unknown): StackViewResult {
  if (!isRecord(input)) {
    throw new TypeError("stack view output must be an object");
  }

  const trunk = requireString(input, "trunk", "stack");
  const { branches } = input;
  if (!Array.isArray(branches)) {
    throw new TypeError("stack.branches must be an array");
  }

  const layers = branches.map((branch, index): Layer => {
    if (!isRecord(branch)) {
      throw new TypeError(`stack.branches[${index}] must be an object`);
    }

    return {
      name: requireString(branch, "name", `stack.branches[${index}]`),
      base: requireString(branch, "base", `stack.branches[${index}]`),
      stats: null,
    };
  });

  return { kind: "stack", stack: { trunk, layers } };
}

export function parseStackView(input: string | object): StackViewResult {
  if (typeof input !== "string") {
    return parseStackObject(input);
  }

  const notInStack = NOT_IN_STACK_PATTERN.exec(input);
  if (notInStack !== null) {
    return {
      kind: "not-in-stack",
      branch: notInStack[1],
      message: input.trim(),
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch (error: unknown) {
    throw new TypeError(
      "stack view output is neither JSON nor a not-in-stack error",
      {
        cause: error,
      },
    );
  }
  return parseStackObject(parsed);
}

export function layerRevisionRange(layer: Layer): string {
  return `${layer.base}..${layer.name}`;
}

export function parseNumstat(output: string): DiffStats {
  let fileCount = 0;
  let additions = 0;
  let deletions = 0;
  let binaryFileCount = 0;

  const lines = output
    .split(LINE_SEPARATOR_PATTERN)
    .filter((line) => line.length > 0);
  for (const line of lines) {
    const match = NUMSTAT_LINE_PATTERN.exec(line);
    if (match === null) {
      throw new TypeError(`invalid numstat line: ${line}`);
    }

    const [, added, deleted] = match;
    const isBinary = added === "-" && deleted === "-";
    if ((added === "-") !== (deleted === "-")) {
      throw new TypeError(`invalid numstat line: ${line}`);
    }

    fileCount += 1;
    if (isBinary) {
      binaryFileCount += 1;
    } else {
      additions += Number(added);
      deletions += Number(deleted);
    }
  }

  return { fileCount, additions, deletions, binaryFileCount };
}

export function parsePorcelainStatus(output: string): WorkingTreeStatus {
  const changeCount = output
    .split(LINE_SEPARATOR_PATTERN)
    .filter((line) => line.length > 0).length;
  return { hasChanges: changeCount > 0, changeCount };
}
