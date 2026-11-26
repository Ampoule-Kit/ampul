import type { ContainerEngine } from '../../engine/ContainerEngine.js'

export async function describeRuntime(engine: ContainerEngine): Promise<string> {
  return `${engine.displayName} ${await engine.clientVersion()} · ${engine.selection.reason}`
}
