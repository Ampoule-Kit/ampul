import { Text } from 'ink'
import { yesFlag, type CommandDefinition, type Invocation } from '../cli/CommandDefinition.js'
import {
  removeEveryDevenvContainer,
  removeEveryDevenvImage,
  removeEveryDevenvVolume,
} from '../containers/projectLifecycle.js'
import { deleteAllProjectSettings, listProjectNames } from '../projects/projectStore.js'
import { devenvPaths, displayPath } from '../system/platform.js'
import { LogFile } from '../tasks/LogFile.js'
import { runTasks } from '../ui/runTasks.js'
import { printElement } from '../ui/terminal.js'
import { colors, symbols } from '../ui/theme.js'
import { confirmDestructiveAction } from './shared/confirmation.js'
import { connectToEngine } from './shared/engineConnection.js'

async function run(invocation: Invocation): Promise<number> {
  const engine = await connectToEngine(invocation.interactive)
  const projectNames = listProjectNames()
  await confirmDestructiveAction({
    invocation,
    commandLine: 'dev purge',
    title: 'Purging removes everything devenv created.',
    lost: [
      projectNames.length > 0
        ? `Every project container, with its ~/Project: ${projectNames.join(', ')}`
        : 'Every devenv container',
      'Every devenv image and volume, including the shared package cache',
      `All project settings in ${displayPath(devenvPaths.projects)}`,
    ],
    kept: ['Every folder on this machine', 'This dev command; run the uninstaller to remove it'],
    yesLabel: 'Remove everything',
  })

  const result = await runTasks(
    [
      { title: 'Remove every devenv container', run: () => removeEveryDevenvContainer(engine) },
      { title: 'Remove every devenv image', run: () => removeEveryDevenvImage(engine) },
      { title: 'Remove every devenv volume', run: () => removeEveryDevenvVolume(engine) },
      { title: 'Remove the project settings', run: async () => deleteAllProjectSettings() },
    ],
    new LogFile('engine', 'purge'),
  )
  if (!result.succeeded && result.problem) throw result.problem
  printElement(
    <Text>
      <Text color={colors.success}>{symbols.success}</Text> Removed every devenv container, image,
      volume and project setting.
    </Text>,
  )
  return 0
}

export const purgeCommand: CommandDefinition = {
  name: 'purge',
  summary: 'Remove every devenv container, image, volume and project setting',
  arguments: [],
  flags: [yesFlag],
  description: [
    'Removes everything devenv created in the container engine, including the shared package cache, and deletes all project settings. Folders on this machine are never touched.',
    'Run it before uninstalling devenv if you want nothing left behind.',
  ],
  examples: [{ command: 'dev purge', explanation: 'Remove everything after confirming.' }],
  seeAlso: ['rm'],
  run,
}
