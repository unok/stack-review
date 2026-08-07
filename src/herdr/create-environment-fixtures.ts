import { descriptions, layers, repositoryRoot } from "./test-helpers.ts";

const TAB_CREATE_PREFIX = [
  "herdr",
  "tab",
  "create",
  "--workspace",
  "wB",
  "--cwd",
  repositoryRoot,
  "--no-focus",
  "--label",
];
const LIST_SESSIONS_COMMAND = ["hunk", "session", "list", "--json"];

export const expectedCreateEnvironmentCommands: string[][] = [
  [
    "herdr",
    "workspace",
    "create",
    "--cwd",
    repositoryRoot,
    "--no-focus",
    "--label",
    "review: stack-review",
  ],
  ["herdr", "tab", "rename", "wB:t1", "control"],
  ...layers.flatMap((layer, index) => {
    const layerNumber = index + 1;
    return [
      [...TAB_CREATE_PREFIX, `${layerNumber} ${layer.name} desc`],
      [...TAB_CREATE_PREFIX, `${layerNumber} ${layer.name}`],
    ];
  }),
  ...layers.flatMap((layer, index) => {
    const description = descriptions[index];
    if (description === undefined) {
      throw new TypeError(`description for layer "${layer.name}" is missing`);
    }
    const descriptionPaneNumber = index * 2 + 2;
    const diffPaneNumber = descriptionPaneNumber + 1;
    return [
      LIST_SESSIONS_COMMAND,
      [
        "herdr",
        "pane",
        "run",
        `wB:p${descriptionPaneNumber}`,
        `hunk diff ${description.baselinePath} ${description.draftPath}`,
      ],
      LIST_SESSIONS_COMMAND,
      LIST_SESSIONS_COMMAND,
      [
        "herdr",
        "pane",
        "run",
        `wB:p${diffPaneNumber}`,
        `hunk diff ${layer.base}..${layer.name}`,
      ],
      LIST_SESSIONS_COMMAND,
    ];
  }),
  ["herdr", "workspace", "focus", "wB"],
  ["herdr", "tab", "focus", "wB:t1"],
];
