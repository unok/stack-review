export interface DiffStats {
  fileCount: number;
  additions: number;
  deletions: number;
  binaryFileCount: number;
}

export interface Layer {
  name: string;
  base: string;
  stats: DiffStats | null;
}

export interface Stack {
  trunk: string;
  layers: Layer[];
}

export interface HunkSession {
  sessionId: string;
  repoRoot: string;
  title: string;
  fileCount: number;
}

export interface ReviewNote {
  filePath: string;
  line: number;
  body: string;
  layerName: string;
  side: "new" | "old";
}

export interface WorkingTreeStatus {
  hasChanges: boolean;
  changeCount: number;
}

export type StackViewResult =
  | { kind: "stack"; stack: Stack }
  | { kind: "not-in-stack"; branch: string; message: string };
