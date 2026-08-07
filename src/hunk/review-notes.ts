import type { CommandRunner } from "../exec.ts";
import type { ReviewNote } from "../types.ts";
import {
  commandFailure,
  isRecord,
  parseJsonObject,
  parseRangeStart,
  requireString,
} from "./helpers.ts";

// hunk に消滅専用の終了コードがないため、実測済みの stderr だけを消滅と判定する。
const MISSING_SESSION_MESSAGES = [
  "No active session matches sessionId",
  "No active Hunk sessions are registered",
];

export interface ReviewNoteFetchResult {
  sessionAlive: boolean;
  notes: ReviewNote[];
}

export function parseReviewNotes(
  output: string,
  layerName: string,
): ReviewNote[] {
  const root = parseJsonObject(output, "hunk session comment list");
  const { comments } = root;
  if (!Array.isArray(comments)) {
    throw new TypeError(
      "hunk session comment list output.comments must be an array",
    );
  }

  return comments.map((comment, index) => {
    const context = `hunk session comment list output.comments[${index}]`;
    if (!isRecord(comment)) {
      throw new TypeError(`${context} must be an object`);
    }

    const newLine = parseRangeStart(comment, "newRange", context);
    if (newLine !== null) {
      return {
        filePath: requireString(comment, "filePath", context),
        line: newLine,
        body: requireString(comment, "body", context),
        layerName,
        side: "new",
      };
    }

    const oldLine = parseRangeStart(comment, "oldRange", context);
    if (oldLine === null) {
      throw new TypeError(`${context} must have newRange or oldRange`);
    }
    return {
      filePath: requireString(comment, "filePath", context),
      line: oldLine,
      body: requireString(comment, "body", context),
      layerName,
      side: "old",
    };
  });
}

export async function fetchReviewNotes(
  run: CommandRunner,
  sessionId: string,
  layerName: string,
): Promise<ReviewNoteFetchResult> {
  const result = await run([
    "hunk",
    "session",
    "comment",
    "list",
    sessionId,
    "--type",
    "user",
    "--json",
  ]);
  if (result.exitCode !== 0) {
    if (
      MISSING_SESSION_MESSAGES.some((message) =>
        result.stderr.includes(message),
      )
    ) {
      return { sessionAlive: false, notes: [] };
    }
    throw commandFailure(
      "hunk session comment list",
      result.stderr,
      result.exitCode,
    );
  }
  return {
    sessionAlive: true,
    notes: parseReviewNotes(result.stdout, layerName),
  };
}
