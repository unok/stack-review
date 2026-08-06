import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { CommandResult, CommandRunner } from "./exec.ts";

interface DescriptionDraft {
  title: string | null;
  body: string;
}

interface PullRequestDescription {
  number: number;
  title: string;
  body: string;
  url: string;
}

interface PreparedLayerDescription {
  layerName: string;
  draftPath: string;
  baselinePath: string;
  draft: DescriptionDraft;
  pullRequest: PullRequestDescription | null;
}

function encodedBranchName(branchName: string): string {
  if (branchName.length === 0) {
    throw new TypeError("branch name must not be empty");
  }
  return encodeURIComponent(branchName);
}

function descriptionDraftPath(
  absoluteGitDir: string,
  branchName: string,
): string {
  return join(
    absoluteGitDir,
    "stack-review",
    "descriptions",
    `${encodedBranchName(branchName)}.md`,
  );
}

function descriptionBaselinePath(
  absoluteGitDir: string,
  branchName: string,
): string {
  return join(
    absoluteGitDir,
    "stack-review",
    "baseline",
    `${encodedBranchName(branchName)}.md`,
  );
}

function emptyDescriptionTemplate(): string {
  return "# \n";
}

function parseDescriptionDraft(content: string): DescriptionDraft {
  const lineEnd = content.indexOf("\n");
  let firstLine = content;
  if (lineEnd !== -1) {
    firstLine = content.slice(0, lineEnd);
  }
  if (firstLine.endsWith("\r")) {
    firstLine = firstLine.slice(0, -1);
  }
  if (!firstLine.startsWith("# ")) {
    throw new TypeError("draft の 1 行目は '# ' 見出しにしてください");
  }

  const heading = firstLine.slice(2).trim();
  let title: string | null = heading;
  if (heading.length === 0) {
    title = null;
  }
  let body = "";
  if (lineEnd !== -1) {
    body = content.slice(lineEnd + 1);
  }
  return { title, body };
}

function hasDescriptionContent(draft: DescriptionDraft): boolean {
  return draft.title !== null || draft.body.trim().length > 0;
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

async function readOrCreateDescriptionDraft(
  absoluteGitDir: string,
  branchName: string,
): Promise<{ path: string; draft: DescriptionDraft }> {
  const path = descriptionDraftPath(absoluteGitDir, branchName);
  let content: string;
  try {
    content = await readFile(path, "utf8");
  } catch (error: unknown) {
    if (!isMissingFile(error)) {
      throw error;
    }
    content = emptyDescriptionTemplate();
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, "utf8");
  }
  return { path, draft: parseDescriptionDraft(content) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePullRequestViewResult(
  result: CommandResult,
): PullRequestDescription | null {
  if (result.exitCode !== 0) {
    // gh は認証・接続失敗も exit 1 にするため、既知の PR 不在文言だけを握りつぶす。
    if (result.stderr.includes("no pull requests found")) {
      return null;
    }
    const detail = result.stderr.trim();
    let suffix = "";
    if (detail.length > 0) {
      suffix = `: ${detail}`;
    }
    throw new Error(`gh pr view exited with code ${result.exitCode}${suffix}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.stdout);
  } catch (error: unknown) {
    throw new TypeError("gh pr view output must be valid JSON", {
      cause: error,
    });
  }
  if (!isRecord(parsed)) {
    throw new TypeError("gh pr view output must be an object");
  }

  const { number, title, body, url } = parsed;
  if (typeof number !== "number" || !Number.isInteger(number) || number < 1) {
    throw new TypeError("gh pr view output.number must be a positive integer");
  }
  if (typeof title !== "string" || title.length === 0) {
    throw new TypeError("gh pr view output.title must be a non-empty string");
  }
  if (typeof body !== "string") {
    throw new TypeError("gh pr view output.body must be a string");
  }
  if (typeof url !== "string" || url.length === 0) {
    throw new TypeError("gh pr view output.url must be a non-empty string");
  }
  return { number, title, body, url };
}

async function fetchPullRequestDescription(
  run: CommandRunner,
  branchName: string,
): Promise<PullRequestDescription | null> {
  return parsePullRequestViewResult(
    await run([
      "gh",
      "pr",
      "view",
      branchName,
      "--json",
      "number,title,body,url",
    ]),
  );
}

function formatDescriptionBaseline(
  pullRequest: PullRequestDescription | null,
): string {
  if (pullRequest === null) {
    return "";
  }
  return `# ${pullRequest.title}\n${pullRequest.body}`;
}

async function writeDescriptionBaseline(
  absoluteGitDir: string,
  branchName: string,
  pullRequest: PullRequestDescription | null,
): Promise<string> {
  const path = descriptionBaselinePath(absoluteGitDir, branchName);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, formatDescriptionBaseline(pullRequest), "utf8");
  return path;
}

export type {
  DescriptionDraft,
  PreparedLayerDescription,
  PullRequestDescription,
};
export {
  descriptionBaselinePath,
  descriptionDraftPath,
  emptyDescriptionTemplate,
  fetchPullRequestDescription,
  formatDescriptionBaseline,
  hasDescriptionContent,
  parseDescriptionDraft,
  parsePullRequestViewResult,
  readOrCreateDescriptionDraft,
  writeDescriptionBaseline,
};
