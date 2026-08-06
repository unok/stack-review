import type { CommandRunner } from "../exec.ts";
import type { HunkSession } from "../types.ts";
import {
  commandFailure,
  isRecord,
  parseJsonObject,
  requireNonNegativeInteger,
  requireString,
} from "./helpers.ts";

export function parseHunkSessions(output: string): HunkSession[] {
  const root = parseJsonObject(output, "hunk session list");
  const { sessions } = root;
  if (!Array.isArray(sessions)) {
    throw new TypeError("hunk session list output.sessions must be an array");
  }

  return sessions.map((session, index) => {
    const context = `hunk session list output.sessions[${index}]`;
    if (!isRecord(session)) {
      throw new TypeError(`${context} must be an object`);
    }
    return {
      sessionId: requireString(session, "sessionId", context),
      repoRoot: requireString(session, "repoRoot", context),
      title: requireString(session, "title", context),
      fileCount: requireNonNegativeInteger(session, "fileCount", context),
    };
  });
}

export function findNewHunkSession(
  before: readonly HunkSession[],
  after: readonly HunkSession[],
  repoRoot: string,
): HunkSession | null {
  const existingIds = new Set(
    before
      .filter((session) => session.repoRoot === repoRoot)
      .map((session) => session.sessionId),
  );
  const added = after.filter(
    (session) =>
      session.repoRoot === repoRoot && !existingIds.has(session.sessionId),
  );
  if (added.length === 0) {
    return null;
  }
  if (added.length > 1) {
    throw new Error(`expected one new Hunk session, found ${added.length}`);
  }
  return added[0] ?? null;
}

export async function listHunkSessions(
  run: CommandRunner,
): Promise<HunkSession[]> {
  const result = await run(["hunk", "session", "list", "--json"]);
  if (result.exitCode !== 0) {
    throw commandFailure("hunk session list", result.stderr, result.exitCode);
  }
  return parseHunkSessions(result.stdout);
}
