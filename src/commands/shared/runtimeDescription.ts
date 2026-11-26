import type { ContainerEngine } from '../../engine/ContainerEngine.ts'

export async function describeRuntime(engine: ContainerEngine): Promise<string> {
  return `${engine.displayName} ${await engine.clientVersion()} · ${engine.selection.reason}`
}
