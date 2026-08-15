export function firebaseQueryKey(
  functionName: string,
  args: Record<string, unknown>,
) {
  return `${functionName}:${JSON.stringify(args)}`;
}
