export function buildReviewWorkspaceLabel(repositoryName: string): string {
  if (repositoryName.length === 0) {
    throw new TypeError("repository name must not be empty");
  }
  return `review: ${repositoryName}`;
}

export function buildLayerTabLabel(
  layerNumber: number,
  branchName: string,
): string {
  if (!Number.isInteger(layerNumber) || layerNumber < 1) {
    throw new TypeError("layer number must be a positive integer");
  }
  if (branchName.length === 0) {
    throw new TypeError("branch name must not be empty");
  }
  return `${layerNumber} ${branchName}`;
}

export function buildLayerDescriptionTabLabel(
  layerNumber: number,
  branchName: string,
): string {
  return `${buildLayerTabLabel(layerNumber, branchName)} desc`;
}
