import type { CommandResult, CommandRunner } from "../exec.ts";
import { parsePullRequestUrl } from "./pull-request-url.ts";
import type {
  SubmitCommandPlan,
  SubmitLayerCommand,
  SubmitResult,
  SubmittedPullRequest,
} from "./types.ts";

function failedResult(
  pullRequests: readonly SubmittedPullRequest[],
  argv: string[],
  result: CommandResult,
): SubmitResult {
  return {
    kind: "failed",
    pullRequests: pullRequests.map((pullRequest) => ({ ...pullRequest })),
    failure: {
      argv: [...argv],
      exitCode: result.exitCode,
      stderr: result.stderr,
    },
  };
}

function submittedPullRequest(
  layer: SubmitLayerCommand,
  result: CommandResult,
  existingUrls: ReadonlyMap<number, string>,
): SubmittedPullRequest {
  if (layer.action === "create") {
    const created = parsePullRequestUrl(result.stdout);
    return {
      layerName: layer.layerName,
      action: "created",
      number: created.number,
      url: created.url,
    };
  }
  const number = layer.pullRequestNumber;
  if (number === null) {
    throw new TypeError(`PR number for layer "${layer.layerName}" is missing`);
  }
  const url = existingUrls.get(number);
  if (url === undefined) {
    throw new TypeError(`PR URL for #${number} is missing`);
  }
  return { layerName: layer.layerName, action: "updated", number, url };
}

export async function executeSubmitPlan(
  run: CommandRunner,
  plan: SubmitCommandPlan,
  existingUrls: ReadonlyMap<number, string>,
): Promise<SubmitResult> {
  const completed: SubmittedPullRequest[] = [];
  const pushResult = await run(plan.push);
  if (pushResult.exitCode !== 0) {
    return failedResult(completed, plan.push, pushResult);
  }
  for (const layer of plan.layers) {
    const result = await run(layer.argv);
    if (result.exitCode !== 0) {
      return failedResult(completed, layer.argv, result);
    }
    completed.push(submittedPullRequest(layer, result, existingUrls));
  }
  const linkResult = await run(plan.link);
  if (linkResult.exitCode !== 0) {
    return failedResult(completed, plan.link, linkResult);
  }
  return { kind: "succeeded", pullRequests: completed };
}
