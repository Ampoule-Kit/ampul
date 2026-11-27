import { Text } from 'ink'
import type { CommandDefinition, Invocation } from '../cli/CommandDefinition.ts'
import { ampulPaths, displayPath } from '../system/platform.ts'
import { LogFile } from '../tasks/LogFile.ts'
import { pluralize } from '../text/prose.ts'
import { runTasks } from '../ui/runTasks.tsx'
import { printElement } from '../ui/terminal.tsx'
import { colors, symbols } from '../ui/theme.ts'
import { ensureContainerRunning } from './shared/containerAccess.tsx'
import { connectToEngine } from './shared/engineConnection.tsx'
import { setupTask } from './shared/projectBuild/buildTasks.ts'
import { selectProject } from './shared/projectSelection.tsx'

async function run(invocation: Invocation): Promise<number> {
  const engine = await connectToEngine(invocation.interactive)
  const project = await selectProject({
    invocation,
    engine,
    commandName: 'setup',
    question: 'Which project do you want to set up again?',
  })
  await ensureContainerRunning(engine, project)
  const result = await runTasks([setupTask(engine, project)], new LogFile(project.name, 'setup'))
  if (!result.succeeded) throw result.problem
  printElement(
    <Text>
      <Text color={result.warnings.length > 0 ? colors.warning : colors.success}>
        {result.warnings.length > 0 ? symbols.warning : symbols.success}
      </Text>{' '}
      Setup finished
      {result.warnings.length > 0 ? ` with ${pluralize(result.warnings.length, 'warning')}` : ''}.
    </Text>,
  )
  return 0
}

export const setupCommand: CommandDefinition = {
  name: 'setup',
  summary: 'Copy your dotfiles in again and rerun the setup, keeping the container',
  arguments: [
    {
      name: 'project',
      required: false,
      description: 'The project to set up. When left out, ampul setup lets you pick one.',
    },
  ],
  flags: [],
  description: [
    `Copies your dotfiles from ${displayPath(ampulPaths.dotfiles)} into the container and links each file into the home folder at the same place, so dotfiles/.bashrc becomes ~/.bashrc. It then runs each tool’s own setup script (modules/<tool>/setup.sh), and links the git and SSH config of this machine.`,
    'Nothing else is touched, so ~/home and running work are safe. Links to dotfiles you deleted are removed. Run it after changing your dotfiles or your SSH config.',
    'Adding or removing a tool needs ampul config, then ampul rebuild.',
  ],
  examples: [{ command: 'ampul setup api', explanation: 'Refresh the dotfiles in api.' }],
  seeAlso: ['rebuild'],
  run,
}
