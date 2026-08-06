import type {
  DescriptionDraft,
  PullRequestDescription,
} from "../description.ts";

export interface SubmitLayerState {
  layerName: string;
  draft: DescriptionDraft;
  pullRequest: PullRequestDescription | null;
}

export interface SubmitLayerCommand {
  layerName: string;
  action: "create" | "edit";
  pullRequestNumber: number | null;
  argv: string[];
}

export interface SubmitCommandPlan {
  push: string[];
  layers: SubmitLayerCommand[];
  link: string[];
}

export interface SubmittedPullRequest {
  layerName: string;
  action: "created" | "updated";
  number: number;
  url: string;
}

export interface SubmitOptions {
  onOrphanDrafts?: (branchNames: readonly string[]) => void;
}

export interface SubmitFailure {
  argv: string[];
  exitCode: number;
  stderr: string;
}

export type SubmitResult =
  | { kind: "unfilled"; layerNames: string[] }
  | { kind: "succeeded"; pullRequests: SubmittedPullRequest[] }
  | {
      kind: "failed";
      pullRequests: SubmittedPullRequest[];
      failure: SubmitFailure;
    };
