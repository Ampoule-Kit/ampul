import { Text } from 'ink'
import { type CommandDefinition, type Invocation, yesFlag } from '../cli/CommandDefinition.ts'
import {
  removeEveryAmpulContainer,
  removeEveryAmpulImage,
  removeEveryAmpulVolume,
} from '../containers/removal.ts'
import { deleteAllProjectSettings, listProjectNames } from '../projects/projectStore.ts'
import { ampulPaths, displayPath } from '../system/platform.ts'
import { LogFile } from '../tasks/LogFile.ts'
import { runTasks } from '../ui/runTasks.tsx'
import { printElement } from '../ui/terminal.tsx'
import { colors, symbols } from '../ui/theme.ts'
import { confirmDestructiveAction } from './shared/confirmation.tsx'
import { connectToEngine } from './shared/engineConnection.tsx'

async function run(invocation: Invocation): Promise<number> {
  const engine = await connectToEngine(invocation.interactive)
  const projectNames = listProjectNames()
  await confirmDestructiveAction({
    invocation,
    commandLine: 'ampul purge',
    title: 'Purging removes everything ampul created.',
    lost: [
      projectNames.length > 0
        ? `Every project container, with its ~/Project: ${projectNames.join(', ')}`
        : 'Every ampul container',
      'Every ampul image and volume, including the shared package cache',
      `All project settings in ${displayPath(ampulPaths.projects)}`,
    ],
    kept: ['Every folder on this machine', 'This ampul command; run the uninstaller to remove it'],
    yesLabel: 'Remove everything',
  })

  const result = await runTasks(
    [
      { title: 'Remove every ampul container', run: () => removeEveryAmpulContainer(engine) },
      { title: 'Remove every ampul image', run: () => removeEveryAmpulImage(engine) },
      { title: 'Remove every ampul volume', run: () => removeEveryAmpulVolume(engine) },
      { title: 'Remove the project settings', run: deleteAllProjectSettings },
    ],
    new LogFile('engine', 'purge'),
  )
  if (!result.succeeded) throw result.problem
  printElement(
    <Text>
      <Text color={colors.success}>{symbols.success}</Text> Removed every ampul container, image,
      volume and project setting.
    </Text>,
  )
  return 0
}

export const purgeCommand: CommandDefinition = {
  name: 'purge',
  summary: 'Remove every ampul container, image, volume and project setting',
  arguments: [],
  flags: [yesFlag],
  description: [
    'Removes everything ampul created in the container engine, including the shared package cache, and deletes all project settings. Folders on this machine are never touched.',
    'Run it before uninstalling ampul if you want nothing left behind.',
  ],
  examples: [{ command: 'ampul purge', explanation: 'Remove everything after confirming.' }],
  seeAlso: ['rm'],
  run,
}
