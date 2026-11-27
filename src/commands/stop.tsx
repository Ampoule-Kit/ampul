import { Text } from 'ink'
import type { CommandDefinition, Invocation } from '../cli/CommandDefinition.ts'
import { allContainerStates } from '../containers/containerState.ts'
import { stopContainer } from '../containers/projectLifecycle.ts'
import type { ContainerEngine } from '../engine/ContainerEngine.ts'
import { Problem } from '../problems/Problem.ts'
import { LogFile } from '../tasks/LogFile.ts'
import { runTasks } from '../ui/runTasks.tsx'
import { printElement } from '../ui/terminal.tsx'
import { colors, symbols } from '../ui/theme.ts'
import { connectToEngine } from './shared/engineConnection.tsx'
import { selectProject } from './shared/projectSelection.tsx'

async function projectsToStop(engine: ContainerEngine, invocation: Invocation): Promise<string[]> {
  const states = await allContainerStates(engine)
  if (invocation.flags.has('all')) {
    return [...states].filter(([, state]) => state === 'running').map(([name]) => name)
  }
  const project = await selectProject({
    invocation,
    engine,
    commandName: 'stop',
    question: 'Which project do you want to stop?',
  })
  if (states.get(project.name) !== 'running') {
    printElement(
      <Text color={colors.muted}>
        {symbols.stopped} {project.name} is not running.
      </Text>,
    )
    return []
  }
  return [project.name]
}

async function run(invocation: Invocation): Promise<number> {
  if (invocation.flags.has('all') && invocation.positionals.length > 0) {
    throw new Problem('ampul stop takes a project name or --all, not both')
  }
  const engine = await connectToEngine(invocation.interactive)
  const names = await projectsToStop(engine, invocation)
  if (names.length === 0) {
    if (invocation.flags.has('all'))
      printElement(<Text color={colors.muted}>No project is running.</Text>)
    return 0
  }
  const result = await runTasks(
    names.map((name) => ({ title: `Stopping ${name}`, run: () => stopContainer(engine, name) })),
    new LogFile('engine', 'stop'),
  )
  if (!result.succeeded) throw result.problem
  printElement(
    <Text>
      <Text color={colors.success}>{symbols.success}</Text> Stopped {names.join(', ')}.{' '}
      <Text color={colors.muted}>Its code and settings are kept; ampul start brings it back.</Text>
    </Text>,
  )
  return 0
}

export const stopCommand: CommandDefinition = {
  name: 'stop',
  summary: 'Stop a project’s container, keeping everything in it',
  arguments: [
    {
      name: 'project',
      required: false,
      description: 'The project to stop. When left out, ampul stop lets you pick one.',
    },
  ],
  flags: [{ name: 'all', short: 'a', description: 'Stop every running project.' }],
  description: [
    'Stops the container, which ends every shell and process in it. Nothing is deleted: the code in ~/home and everything else in the container is still there after ampul start.',
  ],
  examples: [
    { command: 'ampul stop api', explanation: 'Stop the api project.' },
    {
      command: 'ampul stop --all',
      explanation: 'Stop every running project, for example before shutting down.',
    },
  ],
  seeAlso: ['start', 'ls'],
  run,
}
