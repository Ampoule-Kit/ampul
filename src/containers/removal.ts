import type { ContainerEngine } from '../engine/ContainerEngine.ts'
import { cacheLabel, imageName, innerEngineVolumeName, projectLabel } from './naming.ts'

const ampulLabels = [projectLabel, cacheLabel]

export async function removeImage(engine: ContainerEngine, projectName: string): Promise<void> {
  await engine.capture(['rmi', '--force', imageName(projectName)])
}

export async function removeInnerEngineVolume(
  engine: ContainerEngine,
  projectName: string,
): Promise<void> {
  const volume = innerEngineVolumeName(projectName)
  const { exitCode } = await engine.capture(['volume', 'inspect', volume])
  if (exitCode === 0) await engine.capture(['volume', 'rm', '--force', volume])
}

async function identifiersWithLabel(
  engine: ContainerEngine,
  listCommand: string[],
  label: string,
): Promise<string[]> {
  const { stdout } = await engine.capture([...listCommand, '--quiet', '--filter', `label=${label}`])
  const identifiers = stdout
    .split('\n')
    .map((identifier) => identifier.trim())
    .filter(Boolean)
  return [...new Set(identifiers)]
}

export async function removeEveryAmpulContainer(engine: ContainerEngine): Promise<void> {
  const containerIds = await identifiersWithLabel(engine, ['ps', '--all'], projectLabel)
  if (containerIds.length > 0) await engine.capture(['rm', '--force', ...containerIds])
}

export async function removeEveryAmpulImage(engine: ContainerEngine): Promise<void> {
  for (const label of ampulLabels) {
    const imageIds = await identifiersWithLabel(engine, ['images'], label)
    if (imageIds.length > 0) await engine.capture(['rmi', '--force', ...imageIds])
  }
}

export async function removeEveryAmpulVolume(engine: ContainerEngine): Promise<void> {
  for (const label of ampulLabels) {
    const volumeNames = await identifiersWithLabel(engine, ['volume', 'ls'], label)
    if (volumeNames.length > 0) await engine.capture(['volume', 'rm', '--force', ...volumeNames])
  }
}
