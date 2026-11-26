import { Text } from 'ink'
import type { CommandDefinition, Invocation } from '../cli/CommandDefinition.ts'
import { printElement } from '../ui/terminal.tsx'
import { colors, symbols } from '../ui/theme.ts'
import { ensureContainerRunning, openShell } from './shared/containerAccess.tsx'
import { connectToEngine } from './shared/engineConnection.tsx'
import { selectProject } from './shared/projectSelection.tsx'

async function run(invocation: Invocation): Promise<number> {
  const engine = await connectToEngine(invocation.interactive)
  const project = await selectProject({
    invocation,
    engine,
    commandName: 'start',
    question: 'Which project do you want to work on?',
  })
  const outcome = await ensureContainerRunning(engine, project)

  if (invocation.flags.has('detach') || !invocation.interactive) {
    printElement(
      <Text>
        <Text color={colors.success}>{symbols.success}</Text> {project.name} is{' '}
        {outcome === 'started' ? 'started' : 'already running'}.{' '}
        <Text color={colors.muted}>
          Connect with <Text color={colors.accent}>dev start {project.name}</Text>
        </Text>
      </Text>,
    )
    return 0
  }
  return openShell(engine, project)
}

export const startCommand: CommandDefinition = {
  name: 'start',
  aliases: ['enter'],
  summary: 'Start a project and open a shell in it',
  arguments: [
    {
      name: 'project',
      required: false,
      description: 'The project to start. When left out, dev start lets you pick one.',
    },
  ],
  flags: [
    {
      name: 'detach',
      short: 'd',
      description: 'Only start the container; do not open a shell.',
    },
  ],
  description: [
    'Starts the project’s container when it is stopped, then opens a bash login shell in ~/Project. Run it again from another terminal to open a second shell in the same container.',
    'Leaving the shell (exit or ctrl+d) keeps the container running, so servers and builds you started in the background carry on. Stop it with dev stop.',
    'When the container engine is not running, dev start offers to start it, for example the Podman machine on macOS.',
  ],
  examples: [
    { command: 'dev start api', explanation: 'Start api if needed and open a shell in it.' },
    { command: 'dev start', explanation: 'Pick a project from the list, then open a shell in it.' },
    { command: 'dev start -d api', explanation: 'Start api in the background without connecting.' },
  ],
  seeAlso: ['stop', 'ls'],
  run,
}
