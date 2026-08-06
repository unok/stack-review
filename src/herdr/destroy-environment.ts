import type { CommandRunner } from "../exec.ts";
import { runSuccessful } from "./helpers.ts";

export async function destroyReviewEnvironment(
  run: CommandRunner,
  workspaceId: string,
): Promise<void> {
  await runSuccessful(run, ["herdr", "workspace", "close", workspaceId]);
}
