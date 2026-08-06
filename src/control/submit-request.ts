export function buildClaudeSubmitRequest(
  repositoryName: string,
  layerCount: number,
  unfilledDraftCount: number,
): string {
  if (repositoryName.length === 0) {
    throw new TypeError("repository name must not be empty");
  }
  if (!Number.isInteger(layerCount) || layerCount < 1) {
    throw new TypeError("layer count must be a positive integer");
  }
  if (
    !Number.isInteger(unfilledDraftCount) ||
    unfilledDraftCount < 0 ||
    unfilledDraftCount > layerCount
  ) {
    throw new TypeError("unfilled draft count is out of range");
  }

  let request = "stack-review の draft を書いてから submit して";
  let heading = "── draft が未記入です ──";
  let draftStatus = `draft 未記入 ${unfilledDraftCount} 件`;
  if (unfilledDraftCount === 0) {
    request = "stack-review の submit を実行して";
    heading = "── submit の準備ができました ──";
    draftStatus = "draft 全てあり";
  }
  return [
    heading,
    "",
    "下の一行を Claude に渡してください:",
    "",
    `  ${request}`,
    `  （${repositoryName} / ${layerCount} layers / ${draftStatus}）`,
  ].join("\n");
}
