import type { ContainerEngine } from '../../src/engine/ContainerEngine.ts'
import { createEngine } from '../../src/engine/engineReadiness.ts'

export async function requireRunningEngine(): Promise<ContainerEngine> {
  const engine = createEngine()
  const { reachable } = await engine.reachability()
  if (!reachable) {
    throw new Error(
      `The ${engine.displayName} engine is not running. Run 'ampul doctor' to see how to start it.`,
    )
  }
  return engine
}
