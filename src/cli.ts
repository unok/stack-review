#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { ControlState } from "./control/index.ts";
import { runControlMode } from "./control/index.ts";
import { runCommand } from "./exec.ts";
import {
  createReviewEnvironment,
  destroyReviewEnvironment,
} from "./herdr/index.ts";
import {
  getRepositoryPaths,
  getStackView,
  getWorkingTreeStatus,
  populateLayerStats,
  prepareLayerDescriptions,
} from "./repo.ts";
import { quoteShellArgument } from "./shell.ts";

const HELP = `Usage: stack-review [--control <state-file>]

Options:
  --control <state-file>  control タブを開始する
  -h, --help              このヘルプを表示する
`;

type CliArguments =
  | { mode: "default" }
  | { mode: "control"; statePath: string }
  | { mode: "help" };

function parseArguments(argv: readonly string[]): CliArguments {
  const [firstArgument, secondArgument] = argv;
  if (argv.length === 0) {
    return { mode: "default" };
  }
  if (
    argv.length === 1 &&
    (firstArgument === "--help" || firstArgument === "-h")
  ) {
    return { mode: "help" };
  }
  if (argv.length === 2 && firstArgument === "--control") {
    const statePath = secondArgument;
    if (statePath === undefined || statePath.length === 0) {
      throw new TypeError("--control には状態ファイルのパスが必要です");
    }
    return { mode: "control", statePath };
  }
  throw new TypeError(`不明な引数です: ${argv.join(" ")}`);
}

function buildControlCommand(
  executablePath: string,
  statePath: string,
): string {
  return [executablePath, "--control", statePath]
    .map(quoteShellArgument)
    .join(" ");
}

async function writeControlState(
  absoluteGitDir: string,
  state: ControlState,
): Promise<string> {
  const directory = join(absoluteGitDir, "stack-review");
  await mkdir(directory, { recursive: true });
  const path = join(directory, `control-${process.pid}.json`);
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  return path;
}

async function startControlTab(
  executablePath: string,
  state: ControlState,
): Promise<void> {
  const statePath = await writeControlState(state.absoluteGitDir, state);
  const result = await runCommand([
    "herdr",
    "pane",
    "run",
    state.environment.controlPaneId,
    buildControlCommand(executablePath, statePath),
  ]);
  if (result.exitCode === 0) {
    return;
  }
  const detail = result.stderr.trim();
  let suffix = "";
  if (detail.length > 0) {
    suffix = `: ${detail}`;
  }
  throw new Error(
    `control タブの起動に失敗しました（終了コード ${result.exitCode}）${suffix}`,
  );
}

async function runDefaultMode(executablePath: string): Promise<void> {
  const repository = await getRepositoryPaths(runCommand);
  const stackView = await getStackView(runCommand);
  if (stackView.kind === "not-in-stack") {
    throw new Error(stackView.message);
  }

  const workingTreeStatus = await getWorkingTreeStatus(runCommand);
  if (workingTreeStatus.hasChanges) {
    process.stderr.write(
      `警告: 未コミット変更 ${workingTreeStatus.changeCount} 件はどのレイヤーにも含まれません。\n`,
    );
  }
  const layers = await populateLayerStats(runCommand, stackView.stack.layers);
  const stack = { ...stackView.stack, layers };
  const descriptions = await prepareLayerDescriptions(
    runCommand,
    repository.absoluteGitDir,
    layers,
  );
  const repositoryName = basename(repository.topLevel);
  const environment = await createReviewEnvironment(
    runCommand,
    repository.topLevel,
    repositoryName,
    layers,
    descriptions,
  );

  try {
    const state: ControlState = {
      version: 1,
      repositoryRoot: repository.topLevel,
      absoluteGitDir: repository.absoluteGitDir,
      repositoryName,
      stack,
      workingTreeStatus,
      descriptions,
      environment,
    };
    await startControlTab(executablePath, state);
  } catch (error: unknown) {
    try {
      await destroyReviewEnvironment(runCommand, environment.workspaceId);
    } catch {
      // 起動失敗の原因を失わないため、後始末のエラーは上書きしない。
    }
    throw error;
  }
}

async function main(
  argv: readonly string[] = process.argv.slice(2),
): Promise<void> {
  const arguments_ = parseArguments(argv);
  if (arguments_.mode === "help") {
    process.stdout.write(HELP);
    return;
  }
  if (arguments_.mode === "control") {
    await runControlMode(resolve(arguments_.statePath));
    return;
  }

  const [, invokedPath] = process.argv;
  if (invokedPath === undefined) {
    throw new Error("実行ファイルのパスを取得できませんでした");
  }
  await runDefaultMode(resolve(invokedPath));
}

const [, invokedPath] = process.argv;
if (
  invokedPath !== undefined &&
  pathToFileURL(realpathSync(resolve(invokedPath))).href === import.meta.url
) {
  await main().catch((error: unknown) => {
    let message = String(error);
    if (error instanceof Error) {
      const { message: errorMessage } = error;
      message = errorMessage;
    }
    process.stderr.write(`stack-review: ${message}\n`);
    process.exitCode = 1;
  });
}

export { buildControlCommand, main };
