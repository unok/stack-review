const PULL_REQUEST_PATH = /\/pull\/(\d+)\/?$/;

export function parsePullRequestUrl(output: string): {
  number: number;
  url: string;
} {
  const url = output.trim();
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch (error: unknown) {
    throw new TypeError("gh pr output must be a pull request URL", {
      cause: error,
    });
  }
  const match = PULL_REQUEST_PATH.exec(parsed.pathname);
  if (match === null) {
    throw new TypeError("gh pr output must be a pull request URL");
  }
  const number = Number(match[1]);
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new TypeError("pull request number must be a positive integer");
  }
  return { number, url };
}
