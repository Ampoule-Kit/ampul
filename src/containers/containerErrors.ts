const portAlreadyInUsePattern = /address already in use|port is already allocated/i

export function isPortAlreadyInUse(errorOutput: string): boolean {
  return portAlreadyInUsePattern.test(errorOutput)
}

export function outputLines(output: string): string[] {
  return output.trim().split('\n')
}
