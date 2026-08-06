import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { runInteractiveCommand } from "./exec.ts";

const temporaryDirectories: string[] = [];
const TEST_EXIT_CODE = 23;
const COMMAND_NOT_FOUND_EXIT_CODE = 127;

async function temporaryDirectory(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "stack-review-exec-"));
  temporaryDirectories.push(path);
  return path;
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("runInteractiveCommand", () => {
  describe("success", () => {
    it("returns the command exit code", async () => {
      await expect(
        runInteractiveCommand([
          process.execPath,
          "--eval",
          `process.exit(${TEST_EXIT_CODE})`,
        ]),
      ).resolves.toBe(TEST_EXIT_CODE);
    });
  });

  describe("failure", () => {
    it("returns 127 and reports the error when the command does not exist", async () => {
      const directory = await temporaryDirectory();
      const command = join(directory, "missing-command");
      const writeError = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);

      await expect(runInteractiveCommand([command])).resolves.toBe(
        COMMAND_NOT_FOUND_EXIT_CODE,
      );
      expect(writeError).toHaveBeenCalledWith(expect.stringContaining(command));
    });

    it("returns 1 for other spawn errors", async () => {
      const directory = await temporaryDirectory();
      const command = join(directory, "not-executable");
      await writeFile(command, "", { mode: 0o600 });
      vi.spyOn(process.stderr, "write").mockImplementation(() => true);

      await expect(runInteractiveCommand([command])).resolves.toBe(1);
    });
  });
});
