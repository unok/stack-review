import {
  formatOrphanDraftWarning,
  hasDescriptionContent,
} from "../description.ts";
import type { ReviewNoteStore } from "../hunk/index.ts";
import type {
  ControlScreenState,
  ControlState,
  ReviewSessionKind,
} from "./types.ts";

const HUNK_STATUS_WIDTH = 9;
const REVIEW_COMPLETION_PROMPT = "  全部見終えたら Enter → _";

export function buildControlScreen(state: ControlScreenState): string {
  const numberWidth = Math.max(
    1,
    ...state.layers.map((layer) => String(layer.layerNumber).length),
  );
  const branchWidth = Math.max(
    "branch".length,
    ...state.layers.map((layer) => layer.layerName.length),
  );
  const filesWidth = Math.max(
    "files".length,
    ...state.layers.map((layer) => String(layer.fileCount).length),
  );
  const todoWidth = Math.max(
    "TODO".length,
    ...state.layers.map((layer) => String(layer.noteCount).length),
  );
  const lines = [
    `review: ${state.repositoryName}   ${state.layers.length} layers`,
    "",
  ];

  if (state.workingTreeStatus.hasChanges) {
    lines.push(
      `  警告: 未コミット変更 ${state.workingTreeStatus.changeCount} 件はどのレイヤーにも含まれません。`,
      "",
    );
  }

  if (state.orphanDraftBranchNames.length > 0) {
    lines.push(
      ...formatOrphanDraftWarning(state.orphanDraftBranchNames).split("\n"),
      "",
    );
  }

  lines.push(
    `  ${"#".padStart(numberWidth)}  ${"branch".padEnd(branchWidth)}  ${"files".padStart(filesWidth)}  ${"TODO".padStart(todoWidth)}  hunk      desc`,
  );
  for (const layer of state.layers) {
    let hunk = "○ closed";
    if (layer.sessionAlive) {
      hunk = "● live";
    }
    let descriptionStatus = "空";
    if (layer.descriptionFilled) {
      descriptionStatus = "書済";
    }
    lines.push(
      `  ${String(layer.layerNumber).padStart(numberWidth)}  ${layer.layerName.padEnd(branchWidth)}  ${String(layer.fileCount).padStart(filesWidth)}  ${String(layer.noteCount).padStart(todoWidth)}  ${hunk.padEnd(HUNK_STATUS_WIDTH)} ${descriptionStatus}`,
    );
  }
  lines.push("", REVIEW_COMPLETION_PROMPT);

  return lines.join("\n");
}

export function reviewSessionSnapshotName(
  layerName: string,
  kind: ReviewSessionKind,
): string {
  return `${layerName}:${kind}`;
}

export function buildControlScreenState(
  state: ControlState,
  store: ReviewNoteStore,
  orphanDraftBranchNames: readonly string[] = [],
): ControlScreenState {
  return {
    repositoryName: state.repositoryName,
    workingTreeStatus: state.workingTreeStatus,
    orphanDraftBranchNames,
    layers: state.stack.layers.map((layer, index) => {
      const diffSnapshot = store.get(
        reviewSessionSnapshotName(layer.name, "diff"),
      );
      const descriptionSnapshot = store.get(
        reviewSessionSnapshotName(layer.name, "description"),
      );
      const description = state.descriptions[index];
      if (description === undefined || description.layerName !== layer.name) {
        throw new TypeError(
          `description state for layer "${layer.name}" is missing or out of order`,
        );
      }
      return {
        layerNumber: index + 1,
        layerName: layer.name,
        fileCount: layer.stats?.fileCount ?? 0,
        noteCount:
          (diffSnapshot?.notes.length ?? 0) +
          (descriptionSnapshot?.notes.length ?? 0),
        sessionAlive: diffSnapshot?.sessionAlive ?? true,
        descriptionFilled: hasDescriptionContent(description.draft),
      };
    }),
  };
}

export function drawControlScreen(state: ControlScreenState): void {
  process.stdout.write(`\u001b[2J\u001b[H${buildControlScreen(state)}\n`);
}
