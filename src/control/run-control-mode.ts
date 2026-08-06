import { unlink } from "node:fs/promises";
import { readOrphanDraftBranchNames } from "../description.ts";
import { runCommand } from "../exec.ts";
import { destroyReviewEnvironment } from "../herdr/index.ts";
import {
  type HunkSessionBinding,
  type ReviewNotePoller,
  ReviewNoteStore,
  startReviewNotePolling,
} from "../hunk/index.ts";
import { formatReviewNotes, saveReviewNotes } from "../notes.ts";
import type { ReviewNote } from "../types.ts";
import { readControlState } from "./control-state.ts";
import {
  buildControlScreenState,
  drawControlScreen,
  reviewSessionSnapshotName,
} from "./screen.ts";
import { buildClaudeSubmitRequest } from "./submit-request.ts";
import { askYesNo, waitForEnterOrInterrupt } from "./terminal.ts";
import type {
  ControlModeDependencies,
  ControlState,
  ReviewEndReason,
} from "./types.ts";

const CLOSE_PROMPT = "レビューワークスペースを閉じますか？";
const INTERRUPTED_MESSAGE =
  "プリフライトレビューを中断したため submit は実行しません。\n";
const CLOSE_MESSAGE = "レビューワークスペースを閉じます。\n";
const KEEP_MESSAGE = "レビューワークスペースを残しました。\n";

const CONTROL_REFRESH_INTERVAL_MS = 2000;

async function removeStateFile(statePath: string): Promise<void> {
  try {
    await unlink(statePath);
  } catch {
    // 状態は読み込み済みなので、削除失敗だけでレビューを止めない。
  }
}

function sessionBindings(state: ControlState): HunkSessionBinding[] {
  return state.environment.layers.flatMap((layer) => [
    {
      layerName: layer.layerName,
      sessionId: layer.sessionId,
      snapshotName: reviewSessionSnapshotName(layer.layerName, "diff"),
    },
    {
      layerName: layer.layerName,
      sessionId: layer.descriptionSessionId,
      snapshotName: reviewSessionSnapshotName(layer.layerName, "description"),
    },
  ]);
}

async function pollOnce(
  poller: ReviewNotePoller,
  recordError: (error: unknown) => void,
): Promise<void> {
  try {
    await poller.pollNow();
  } catch (error: unknown) {
    recordError(error);
  }
}

function reportPollingError(error: unknown): void {
  if (error === null) {
    return;
  }
  let message = String(error);
  if (error instanceof Error) {
    const { message: errorMessage } = error;
    message = errorMessage;
  }
  process.stderr.write(
    `レビューメモの取得中にエラーが発生しました: ${message}\n`,
  );
}

function collectNotes(
  state: ControlState,
  store: ReviewNoteStore,
): ReviewNote[] {
  return state.stack.layers.flatMap((layer) => [
    ...(store.get(reviewSessionSnapshotName(layer.name, "diff"))?.notes ?? []),
    ...(store.get(reviewSessionSnapshotName(layer.name, "description"))
      ?.notes ?? []),
  ]);
}

function reportReviewResult(
  state: ControlState,
  noteCount: number,
  endReason: ReviewEndReason,
): void {
  if (noteCount > 0) {
    process.stdout.write(
      `レビューメモが ${noteCount} 件あります。修正後にもう一度プリフライトレビューしてください。\n`,
    );
    return;
  }
  if (endReason !== "completed") {
    process.stdout.write(INTERRUPTED_MESSAGE);
    return;
  }
  const unfilledDraftCount = state.descriptions.filter(
    (description) => description.draft.title === null,
  ).length;
  process.stdout.write(
    `${buildClaudeSubmitRequest(
      state.repositoryName,
      state.stack.layers.length,
      unfilledDraftCount,
    )}\n`,
  );
}

interface CloseWorkspaceOptions {
  promptYesNo: NonNullable<ControlModeDependencies["promptYesNo"]>;
  run: Parameters<typeof destroyReviewEnvironment>[0];
  workspaceId: string;
}

async function closeWorkspace({
  promptYesNo,
  run,
  workspaceId,
}: CloseWorkspaceOptions): Promise<void> {
  if (await promptYesNo(CLOSE_PROMPT, true)) {
    process.stdout.write(CLOSE_MESSAGE);
    await destroyReviewEnvironment(run, workspaceId);
    return;
  }
  process.stdout.write(KEEP_MESSAGE);
}

async function runControlMode(
  statePath: string,
  dependencies: ControlModeDependencies = {},
): Promise<void> {
  const state = await readControlState(statePath);
  await removeStateFile(statePath);
  const orphanDraftBranchNames = await readOrphanDraftBranchNames(
    state.absoluteGitDir,
    state.stack.layers.map((layer) => layer.name),
  );
  const run = dependencies.run ?? runCommand;
  const waitForReviewEnd =
    dependencies.waitForReviewEnd ?? waitForEnterOrInterrupt;
  const promptYesNo = dependencies.promptYesNo ?? askYesNo;
  const store = new ReviewNoteStore();
  let pollingError: unknown = null;
  const recordPollingError = (error: unknown): void => {
    pollingError = error;
  };
  const poller = startReviewNotePolling(sessionBindings(state), store, run, {
    onError: recordPollingError,
  });

  await pollOnce(poller, recordPollingError);
  drawControlScreen(
    buildControlScreenState(state, store, orphanDraftBranchNames),
  );
  const redrawTimer = globalThis.setInterval(() => {
    drawControlScreen(
      buildControlScreenState(state, store, orphanDraftBranchNames),
    );
  }, CONTROL_REFRESH_INTERVAL_MS);
  const endReason = await waitForReviewEnd();
  globalThis.clearInterval(redrawTimer);
  await pollOnce(poller, recordPollingError);
  poller.stop();
  reportPollingError(pollingError);

  const notes = collectNotes(state, store);
  const markdown = formatReviewNotes(
    state.stack.layers.map((layer) => layer.name),
    notes,
  );
  const saved = await saveReviewNotes(state.absoluteGitDir, markdown);
  process.stdout.write(`\n${markdown}\n保存先: ${saved.latestPath}\n`);
  reportReviewResult(state, notes.length, endReason);
  await closeWorkspace({
    promptYesNo,
    run,
    workspaceId: state.environment.workspaceId,
  });
}

export { CONTROL_REFRESH_INTERVAL_MS, runControlMode };
