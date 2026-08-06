import { mkdir, rename, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { ReviewNote } from "./types.ts";

interface SaveReviewNotesOptions {
  now?: () => Date;
}

interface SavedReviewNotes {
  latestPath: string;
  historyPath: string | null;
}

const LINE_BREAK_PATTERN = /\r?\n/;
const TIMESTAMP_PUNCTUATION_PATTERN = /[-:.]/g;

function indentBody(body: string): string {
  return body
    .split(LINE_BREAK_PATTERN)
    .map((line) => `  ${line}`)
    .join("\n");
}

function formatReviewNotes(
  layerNames: readonly string[],
  notes: readonly ReviewNote[],
): string {
  if (notes.length === 0) {
    return "# レビューメモ\n\n0 件です。\n";
  }

  const sections = layerNames.flatMap((layerName) => {
    const layerNotes = notes.filter((note) => note.layerName === layerName);
    if (layerNotes.length === 0) {
      return [];
    }

    const entries = layerNotes.map(
      (note) => `- \`${note.filePath}:${note.line}\`\n${indentBody(note.body)}`,
    );
    return [`## ${layerName}\n\n${entries.join("\n\n")}`];
  });

  const knownLayers = new Set(layerNames);
  const unlistedLayerNames = Array.from(
    new Set(
      notes
        .map((note) => note.layerName)
        .filter((layerName) => !knownLayers.has(layerName)),
    ),
  );
  for (const layerName of unlistedLayerNames) {
    const entries = notes
      .filter((note) => note.layerName === layerName)
      .map(
        (note) =>
          `- \`${note.filePath}:${note.line}\`\n${indentBody(note.body)}`,
      );
    sections.push(`## ${layerName}\n\n${entries.join("\n\n")}`);
  }

  return `# レビューメモ\n\n${sections.join("\n\n")}\n`;
}

function formatReviewNoteTimestamp(date: Date): string {
  return date.toISOString().replaceAll(TIMESTAMP_PUNCTUATION_PATTERN, "");
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function saveReviewNotes(
  absoluteGitDir: string,
  markdown: string,
  options: SaveReviewNotesOptions = {},
): Promise<SavedReviewNotes> {
  const notesDirectory = join(absoluteGitDir, "stack-review");
  const latestPath = join(notesDirectory, "latest.md");
  await mkdir(notesDirectory, { recursive: true });

  let historyPath: string | null = null;
  if (await pathExists(latestPath)) {
    const historyDirectory = join(notesDirectory, "history");
    await mkdir(historyDirectory, { recursive: true });
    const now = options.now ?? (() => new Date());
    historyPath = join(
      historyDirectory,
      `${formatReviewNoteTimestamp(now())}.md`,
    );
    await rename(latestPath, historyPath);
  }

  await writeFile(latestPath, markdown, { encoding: "utf8", mode: 0o600 });
  return { latestPath, historyPath };
}

export type { SavedReviewNotes, SaveReviewNotesOptions };
export { formatReviewNotes, formatReviewNoteTimestamp, saveReviewNotes };
