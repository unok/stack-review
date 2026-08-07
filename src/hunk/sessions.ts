import type { CommandRunner } from "../exec.ts";
import type { HunkSession } from "../types.ts";
import {
  commandFailure,
  isRecord,
  parseJsonObject,
  requireNonNegativeInteger,
  requireNullableString,
  requireString,
} from "./helpers.ts";

function parseHunkSessions(output: string): HunkSession[] {
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
      repoRoot: requireNullableString(session, "repoRoot", context),
      cwd: requireString(session, "cwd", context),
      title: requireString(session, "title", context),
      fileCount: requireNonNegativeInteger(session, "fileCount", context),
    };
  });
}

function isSessionForRepository(
  session: HunkSession,
  repoRoot: string,
): boolean {
  // file compare セッションには repoRoot がないため、タブ作成時の cwd を使う。
  return (session.repoRoot ?? session.cwd) === repoRoot;
}

function findNewHunkSession(
  before: readonly HunkSession[],
  after: readonly HunkSession[],
  repoRoot: string,
): HunkSession | null {
  const existingIds = new Set(
    before
      .filter((session) => isSessionForRepository(session, repoRoot))
      .map((session) => session.sessionId),
  );
  const added = after.filter(
    (session) =>
      isSessionForRepository(session, repoRoot) &&
      !existingIds.has(session.sessionId),
  );
  if (added.length === 0) {
    return null;
  }
  if (added.length > 1) {
    throw new Error(`expected one new Hunk session, found ${added.length}`);
  }
  return added[0] ?? null;
}

async function listHunkSessions(run: CommandRunner): Promise<HunkSession[]> {
  const result = await run(["hunk", "session", "list", "--json"]);
  if (result.exitCode !== 0) {
    throw commandFailure("hunk session list", result.stderr, result.exitCode);
  }
  return parseHunkSessions(result.stdout);
}

export { findNewHunkSession, listHunkSessions, parseHunkSessions };
