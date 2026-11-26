import { Text } from 'ink'
import type { CommandDefinition, Invocation } from '../cli/CommandDefinition.js'
import { allContainerStates } from '../containers/containerState.js'
import { stopContainer } from '../containers/projectLifecycle.js'
import type { ContainerEngine } from '../engine/ContainerEngine.js'
import { Problem } from '../problems/Problem.js'
import { LogFile } from '../tasks/LogFile.js'
import { runTasks } from '../ui/runTasks.js'
import { printElement } from '../ui/terminal.js'
import { colors, symbols } from '../ui/theme.js'
import { connectToEngine } from './shared/engineConnection.js'
import { selectProject } from './shared/projectSelection.js'

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
    throw new Problem('dev stop takes a project name or --all, not both')
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
  if (!result.succeeded && result.problem) throw result.problem
  printElement(
    <Text>
      <Text color={colors.success}>{symbols.success}</Text> Stopped {names.join(', ')}.{' '}
      <Text color={colors.muted}>Its code and settings are kept; dev start brings it back.</Text>
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
      description: 'The project to stop. When left out, dev stop lets you pick one.',
    },
  ],
  flags: [{ name: 'all', short: 'a', description: 'Stop every running project.' }],
  description: [
    'Stops the container, which ends every shell and process in it. Nothing is deleted: the code in ~/Project and everything else in the container is still there after dev start.',
  ],
  examples: [
    { command: 'dev stop api', explanation: 'Stop the api project.' },
    {
      command: 'dev stop --all',
      explanation: 'Stop every running project, for example before shutting down.',
    },
  ],
  seeAlso: ['start', 'ls'],
  run,
}
