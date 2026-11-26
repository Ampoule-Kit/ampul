import { Text } from 'ink'
import { yesFlag, type CommandDefinition, type Invocation } from '../cli/CommandDefinition.js'
import { removeContainer, usesInnerContainerEngine } from '../containers/containerCreation.js'
import { removeImage, removeInnerEngineVolume } from '../containers/projectLifecycle.js'
import { deleteProjectSettings, projectSettingsFile } from '../projects/projectStore.js'
import { displayPath } from '../system/platform.js'
import { LogFile } from '../tasks/LogFile.js'
import { runTasks } from '../ui/runTasks.js'
import { printElement } from '../ui/terminal.js'
import { colors, symbols } from '../ui/theme.js'
import { confirmDestructiveAction } from './shared/confirmation.js'
import { connectToEngine } from './shared/engineConnection.js'
import { selectProject } from './shared/projectSelection.js'

async function run(invocation: Invocation): Promise<number> {
  const engine = await connectToEngine(invocation.interactive)
  const project = await selectProject({
    invocation,
    engine,
    commandName: 'rm',
    question: 'Which project do you want to remove?',
  })
  await confirmDestructiveAction({
    invocation,
    commandLine: `dev rm ${project.name}`,
    title: `Removing ${project.name} cannot be undone.`,
    lost: [
      'The container, with everything in ~/Project, including unpushed work',
      'The image',
      ...(usesInnerContainerEngine(project)
        ? ['Images and data of the containers run inside it']
        : []),
      `The settings in ${displayPath(projectSettingsFile(project.name))}`,
    ],
    kept: ['The shared package cache, used by your other projects', 'Every folder on this machine'],
    yesLabel: `Remove ${project.name}`,
  })

  const result = await runTasks(
    [
      { title: 'Remove the container', run: () => removeContainer(engine, project.name) },
      { title: 'Remove the image', run: () => removeImage(engine, project.name) },
      {
        title: 'Remove the inner container data',
        run: () => removeInnerEngineVolume(engine, project.name),
      },
      { title: 'Remove the settings', run: async () => deleteProjectSettings(project.name) },
    ],
    new LogFile(project.name, 'remove'),
  )
  if (!result.succeeded && result.problem) throw result.problem
  printElement(
    <Text>
      <Text color={colors.success}>{symbols.success}</Text> Removed {project.name}.
    </Text>,
  )
  return 0
}

export const removeCommand: CommandDefinition = {
  name: 'rm',
  aliases: ['remove'],
  summary: 'Remove a project: its container, image, data and settings',
  arguments: [
    {
      name: 'project',
      required: false,
      description: 'The project to remove. When left out, dev rm lets you pick one.',
    },
  ],
  flags: [yesFlag],
  description: [
    'Deletes the project’s container (and the code in ~/Project with it), its image, the data of containers that ran inside it, and its settings. The shared package cache and every folder on this machine are kept.',
    'It shows exactly what goes before asking you to confirm.',
  ],
  examples: [
    { command: 'dev rm api', explanation: 'Remove api after confirming.' },
    { command: 'dev rm api --yes', explanation: 'Remove api without asking.' },
  ],
  seeAlso: ['purge', 'ls'],
  run,
}
