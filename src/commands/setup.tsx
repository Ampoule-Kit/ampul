import { Text } from 'ink'
import type { CommandDefinition, Invocation } from '../cli/CommandDefinition.js'
import { LogFile } from '../tasks/LogFile.js'
import { pluralize } from '../ui/formatting.js'
import { runTasks } from '../ui/runTasks.js'
import { printElement } from '../ui/terminal.js'
import { colors, symbols } from '../ui/theme.js'
import { ensureContainerRunning } from './shared/containerAccess.js'
import { connectToEngine } from './shared/engineConnection.js'
import { setupTask } from './shared/projectBuild.js'
import { selectProject } from './shared/projectSelection.js'

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
  if (!result.succeeded && result.problem) throw result.problem
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
  summary: 'Copy the dotfiles in again and rerun the setup, keeping the container',
  arguments: [
    {
      name: 'project',
      required: false,
      description: 'The project to set up. When left out, dev setup lets you pick one.',
    },
  ],
  flags: [],
  description: [
    'Copies this repo’s dotfiles/ folder into the container and links it into the home folder, then installs the Neovim plugins pinned in lazy-lock.json, the language servers, formatters and treesitter parsers, and links the git and SSH config of this machine.',
    'Nothing else is touched, so ~/Project and running work are safe. Links to dotfiles you deleted are removed. Run it after changing your dotfiles or SSH config.',
    'The dotfiles are built into the dev command, so run the installer again first when you changed them in the repo.',
  ],
  examples: [
    { command: 'dev setup api', explanation: 'Refresh the dotfiles and Neovim setup in api.' },
  ],
  seeAlso: ['rebuild'],
  run,
}
