export function environmentVariable(name: string): string | undefined {
  const value = process.env[name]
  return value === undefined || value === '' ? undefined : value
}

export function isEnvironmentFlagSet(name: string): boolean {
  return environmentVariable(name) !== undefined
}
