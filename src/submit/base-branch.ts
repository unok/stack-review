export function baseBranchForLayer(
  trunk: string,
  layerNames: readonly string[],
  layerIndex: number,
): string {
  if (trunk.length === 0) {
    throw new TypeError("trunk must not be empty");
  }
  if (
    !Number.isInteger(layerIndex) ||
    layerIndex < 0 ||
    layerIndex >= layerNames.length
  ) {
    throw new RangeError("layer index is out of range");
  }
  if (layerIndex === 0) {
    return trunk;
  }
  return layerNames[layerIndex - 1] as string;
}
