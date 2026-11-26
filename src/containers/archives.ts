import { Readable } from 'node:stream'
import { create as createTarStream } from 'tar'
import type { ContainerEngine } from '../engine/ContainerEngine.ts'
import { containerName, containerUser } from './naming.ts'

const extractIntoFreshFolderScript =
  'rm -rf "$1" && mkdir -p "$1" && tar --warning=no-unknown-keyword -xf - -C "$1"'

export function archiveOf(directory: string, entries: string[] = ['.']): Readable {
  return Readable.from(createTarStream({ cwd: directory, portable: true, follow: false }, entries))
}

export async function replaceContainerFolder(
  engine: ContainerEngine,
  projectName: string,
  containerFolder: string,
  archive: Readable,
): Promise<{ exitCode: number; errorOutput: string }> {
  let errorOutput = ''
  const exitCode = await engine.stream(
    [
      'exec',
      '--interactive',
      '--user',
      containerUser(),
      containerName(projectName),
      'bash',
      '-c',
      extractIntoFreshFolderScript,
      'extract',
      containerFolder,
    ],
    {
      input: archive,
      onOutput: (chunk) => {
        errorOutput += chunk
      },
    },
  )
  return { exitCode, errorOutput }
}
