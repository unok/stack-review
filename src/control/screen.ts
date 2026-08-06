import type { ReviewNoteStore } from "../hunk/index.ts";
import type { ControlScreenState, ControlState } from "./types.ts";

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

  lines.push(
    `  ${"#".padStart(numberWidth)}  ${"branch".padEnd(branchWidth)}  ${"files".padStart(filesWidth)}  ${"TODO".padStart(todoWidth)}  hunk`,
  );
  for (const layer of state.layers) {
    let hunk = "○ closed";
    if (layer.sessionAlive) {
      hunk = "● live";
    }
    lines.push(
      `  ${String(layer.layerNumber).padStart(numberWidth)}  ${layer.layerName.padEnd(branchWidth)}  ${String(layer.fileCount).padStart(filesWidth)}  ${String(layer.noteCount).padStart(todoWidth)}  ${hunk}`,
    );
  }
  lines.push("", REVIEW_COMPLETION_PROMPT);

  return lines.join("\n");
}

export function screenState(
  state: ControlState,
  store: ReviewNoteStore,
): ControlScreenState {
  return {
    repositoryName: state.repositoryName,
    workingTreeStatus: state.workingTreeStatus,
    layers: state.stack.layers.map((layer, index) => {
      const snapshot = store.get(layer.name);
      return {
        layerNumber: index + 1,
        layerName: layer.name,
        fileCount: layer.stats?.fileCount ?? 0,
        noteCount: snapshot?.notes.length ?? 0,
        sessionAlive: snapshot?.sessionAlive ?? true,
      };
    }),
  };
}

export function drawControlScreen(state: ControlScreenState): void {
  process.stdout.write(`\u001b[2J\u001b[H${buildControlScreen(state)}\n`);
}
