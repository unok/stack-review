const UNQUOTED_SHELL_ARGUMENT_PATTERN = /^[A-Za-z0-9_@%+=:,./-]+$/;

export function quoteShellArgument(argument: string): string {
  if (UNQUOTED_SHELL_ARGUMENT_PATTERN.test(argument)) {
    return argument;
  }
  return `'${argument.replaceAll("'", `'"'"'`)}'`;
}
