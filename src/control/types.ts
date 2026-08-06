import type { PreparedLayerDescription } from "../description.ts";
import type { CommandRunner } from "../exec.ts";
import type { ReviewEnvironment } from "../herdr/index.ts";
import type { Stack, WorkingTreeStatus } from "../types.ts";

export interface ControlState {
  version: 1;
  repositoryRoot: string;
  absoluteGitDir: string;
  repositoryName: string;
  stack: Stack;
  workingTreeStatus: WorkingTreeStatus;
  descriptions: PreparedLayerDescription[];
  environment: ReviewEnvironment;
}

export interface ControlLayerStatus {
  layerNumber: number;
  layerName: string;
  fileCount: number;
  noteCount: number;
  sessionAlive: boolean;
  descriptionFilled: boolean;
}

export interface ControlScreenState {
  repositoryName: string;
  layers: readonly ControlLayerStatus[];
  workingTreeStatus: WorkingTreeStatus;
  orphanDraftBranchNames: readonly string[];
}

export interface ControlModeDependencies {
  run?: CommandRunner;
  waitForReviewEnd?: () => Promise<ReviewEndReason>;
  promptYesNo?: (question: string, defaultValue: boolean) => Promise<boolean>;
}

export type ReviewEndReason = "completed" | "interrupted";

export type ReviewSessionKind = "diff" | "description";
