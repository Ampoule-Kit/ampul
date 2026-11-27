import path from 'node:path'
import type { ContainerEngine } from '../engine/ContainerEngine.ts'
import { recommendedMachineMemoryMebibytes } from '../engine/podmanMachine.ts'
import { Problem, type ProblemFix } from '../problems/Problem.ts'
import type { ProjectSettings } from '../projects/ProjectSettings.ts'
import { displayPath, homeDirectory, isMacOS, isWindows } from '../system/platform.ts'
import { outputLines } from './containerErrors.ts'

const unsharedFolderPattern =
  /statfs|mounts denied|not shared from the host|not known to docker|mount source path|bind source path/i
const permissionDeniedPattern = /permission denied/i

function isInsideHomeFolder(folder: string): boolean {
  return folder === homeDirectory || folder.startsWith(homeDirectory + path.sep)
}

function isNetworkFolder(folder: string): boolean {
  return folder.startsWith('\\\\')
}

export function folderSharingWarning(folder: string): string | undefined {
  if (isMacOS && !isInsideHomeFolder(folder)) {
    return 'Outside your home folder, so Podman or Docker may need to be told to share it.'
  }
  if (isWindows && isNetworkFolder(folder)) {
    return 'On a network drive, which Podman and Docker cannot reach. Use a folder on a local drive.'
  }
  return undefined
}

export function unsharedFoldersIn(errorOutput: string, folders: string[]): string[] {
  const namedFolders = folders.filter((folder) => errorOutput.includes(folder))
  if (unsharedFolderPattern.test(errorOutput)) {
    return namedFolders.length > 0 ? namedFolders : folders
  }
  return permissionDeniedPattern.test(errorOutput) ? namedFolders : []
}

const podmanMachineDefaultShares = [homeDirectory, '/private', '/var/folders']

function topLevelFolder(folder: string): string {
  return `/${folder.split('/')[1] ?? ''}`
}

function sharingFixes(engine: ContainerEngine, folders: string[]): ProblemFix[] {
  const shownFolders = folders.map(displayPath).join(', ')
  if (isMacOS && engine.runtime === 'podman') {
    const sharedFolders = new Set([...podmanMachineDefaultShares, ...folders.map(topLevelFolder)])
    const volumes = [...sharedFolders].map((folder) => `--volume ${folder}:${folder}`).join(' ')
    return [
      { description: `Move ${shownFolders} into your home folder, which Podman always shares` },
      {
        description:
          'Or set the Podman machine up again so it shares these folders too. This deletes the images and containers in it, so rebuild each project afterwards',
        command: `podman machine rm --force && podman machine init --memory ${recommendedMachineMemoryMebibytes} ${volumes} --now`,
      },
    ]
  }
  if (isMacOS) {
    return [
      {
        description: `Open Docker Desktop, go to Settings, Resources, File sharing, add ${shownFolders}, and click Apply & restart`,
      },
      { description: 'Using Colima? Add the folders under mounts', command: 'colima start --edit' },
    ]
  }
  if (isWindows) {
    return [
      {
        description: `Move ${shownFolders} to a drive that is part of this computer, such as C:, rather than a network or removable drive`,
      },
    ]
  }
  return [
    {
      description: `Make sure you can open ${shownFolders} and every folder above it`,
      command: `ls -ld ${folders.join(' ')}`,
    },
  ]
}

function sharingExplanation(engine: ContainerEngine, folders: string[]): string {
  if (isMacOS || isWindows) {
    return `${engine.displayName} runs containers in a virtual machine, which only sees the folders it shares with this computer.`
  }
  return `${engine.displayName} could not open ${folders.length === 1 ? 'the folder' : 'the folders'}.`
}

export function unsharedFoldersProblem(
  engine: ContainerEngine,
  project: ProjectSettings,
  folders: string[],
  errorOutput = '',
): Problem {
  const shownFolders = folders.map(displayPath).join(', ')
  return new Problem(`The container cannot see ${shownFolders}`, {
    explanation: sharingExplanation(engine, folders),
    outputTail: errorOutput ? outputLines(errorOutput) : [],
    fixes: [
      ...sharingFixes(engine, folders),
      { description: 'Or mount a different folder', command: `ampul config ${project.name}` },
      { description: 'Then try again', command: `ampul rebuild ${project.name}` },
    ],
  })
}
