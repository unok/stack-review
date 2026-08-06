import type { PreparedLayerDescription } from "./description.ts";
import {
  fetchPullRequestDescription,
  readOrCreateDescriptionDraft,
  writeDescriptionBaseline,
} from "./description.ts";
import type { CommandRunner } from "./exec.ts";
import {
  layerRevisionRange,
  parseNumstat,
  parsePorcelainStatus,
  parseStackView,
} from "./stack.ts";
import type { Layer, StackViewResult, WorkingTreeStatus } from "./types.ts";

interface RepositoryPaths {
  topLevel: string;
  absoluteGitDir: string;
}

function commandFailure(
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

async function runSuccessful(
  run: CommandRunner,
  argv: string[],
): Promise<string> {
  const result = await run(argv);
  if (result.exitCode !== 0) {
    throw commandFailure(argv, result.stderr, result.exitCode);
  }
  return result.stdout;
}

async function getRepositoryPaths(
  run: CommandRunner,
): Promise<RepositoryPaths> {
  const topLevel = await runSuccessful(run, [
    "git",
    "rev-parse",
    "--show-toplevel",
  ]);
  const absoluteGitDir = await runSuccessful(run, [
    "git",
    "rev-parse",
    "--absolute-git-dir",
  ]);

  return {
    topLevel: topLevel.trim(),
    absoluteGitDir: absoluteGitDir.trim(),
  };
}

async function getStackView(run: CommandRunner): Promise<StackViewResult> {
  const argv = ["gh", "stack", "view", "--json"];
  const result = await run(argv);
  if (result.exitCode === 0) {
    return parseStackView(result.stdout);
  }

  try {
    const parsed = parseStackView(result.stderr);
    if (parsed.kind === "not-in-stack") {
      return parsed;
    }
  } catch {
    // gh の通常エラーは JSON ではないため、元の終了コードと stderr を使う。
  }
  throw commandFailure(argv, result.stderr, result.exitCode);
}

function populateLayerStats(
  run: CommandRunner,
  layers: readonly Layer[],
): Promise<Layer[]> {
  return Promise.all(
    layers.map(async (layer) => {
      const range = layerRevisionRange(layer);
      const output = await runSuccessful(run, [
        "git",
        "diff",
        "--numstat",
        range,
      ]);
      return { ...layer, stats: parseNumstat(output) };
    }),
  );
}

async function getWorkingTreeStatus(
  run: CommandRunner,
): Promise<WorkingTreeStatus> {
  const output = await runSuccessful(run, ["git", "status", "--porcelain"]);
  return parsePorcelainStatus(output);
}

function prepareLayerDescriptions(
  run: CommandRunner,
  absoluteGitDir: string,
  layers: readonly Layer[],
): Promise<PreparedLayerDescription[]> {
  return Promise.all(
    layers.map(async (layer) => {
      const [{ path: draftPath, draft }, pullRequest] = await Promise.all([
        readOrCreateDescriptionDraft(absoluteGitDir, layer.name),
        fetchPullRequestDescription(run, layer.name),
      ]);
      const baselinePath = await writeDescriptionBaseline(
        absoluteGitDir,
        layer.name,
        pullRequest,
      );
      return {
        layerName: layer.name,
        draftPath,
        baselinePath,
        draft,
        pullRequest,
      };
    }),
  );
}

export type { RepositoryPaths };
export {
  getRepositoryPaths,
  getStackView,
  getWorkingTreeStatus,
  populateLayerStats,
  prepareLayerDescriptions,
};
