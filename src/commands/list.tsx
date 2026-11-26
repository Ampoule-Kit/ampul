import { Box, Text } from 'ink'
import type { CommandDefinition, Invocation } from '../cli/CommandDefinition.js'
import {
  allContainerStates,
  containerStateLabels,
  type ContainerState,
} from '../containers/containerState.js'
import { createEngine, diagnoseEngine } from '../engine/engineReadiness.js'
import { moduleCatalog } from '../modules/moduleCatalog.js'
import { moduleLabels } from '../modules/moduleSelection.js'
import type { Problem } from '../problems/Problem.js'
import { describeCodeSource } from '../projects/codeSources.js'
import { formatPortList } from '../projects/ports.js'
import { listProjects } from '../projects/projectStore.js'
import type { ProjectSettings } from '../projects/ProjectSettings.js'
import { ProblemView } from '../ui/components/ProblemView.js'
import { printElement } from '../ui/terminal.js'
import { colors, symbols } from '../ui/theme.js'
import { withSpinner } from '../ui/withSpinner.js'

interface ProjectRow {
  project: ProjectSettings
  state?: ContainerState
}

const columnGap = 3

async function loadRows(): Promise<{ rows: ProjectRow[]; engineProblem?: Problem }> {
  const projects = listProjects()
  if (projects.length === 0) return { rows: [] }
  const diagnosis = await diagnoseEngine(createEngine())
  if (!diagnosis.ready)
    return { rows: projects.map((project) => ({ project })), engineProblem: diagnosis.problem }
  const states = await allContainerStates(diagnosis.engine)
  return {
    rows: projects.map((project) => ({ project, state: states.get(project.name) ?? 'missing' })),
  }
}

function stateColor(state: ContainerState | undefined): string {
  if (state === 'running') return colors.success
  if (state === 'missing') return colors.warning
  return colors.muted
}

function stateText(state: ContainerState | undefined): string {
  if (!state) return `${symbols.stopped} unknown`
  return `${state === 'running' ? symbols.running : symbols.stopped} ${containerStateLabels[state]}`
}

function ProjectTable({ rows }: { rows: ProjectRow[] }) {
  const nameWidth = Math.max(7, ...rows.map((row) => row.project.name.length)) + columnGap
  const stateWidth = Math.max(...rows.map((row) => stateText(row.state).length)) + columnGap
  const portsText = (project: ProjectSettings) => formatPortList(project.ports) || '–'
  const portsWidth = Math.max(5, ...rows.map((row) => portsText(row.project).length)) + columnGap
  return (
    <Box flexDirection="column">
      <Box>
        <Box width={nameWidth}>
          <Text bold>PROJECT</Text>
        </Box>
        <Box width={stateWidth}>
          <Text bold>STATUS</Text>
        </Box>
        <Box width={portsWidth}>
          <Text bold>PORTS</Text>
        </Box>
        <Text bold>CODE</Text>
      </Box>
      {rows.map(({ project, state }) => (
        <Box key={project.name}>
          <Box width={nameWidth}>
            <Text color={colors.accent}>{project.name}</Text>
          </Box>
          <Box width={stateWidth}>
            <Text color={stateColor(state)}>{stateText(state)}</Text>
          </Box>
          <Box width={portsWidth}>
            <Text>{portsText(project)}</Text>
          </Box>
          <Text wrap="truncate-end">{describeCodeSource(project.codeSource)}</Text>
        </Box>
      ))}
    </Box>
  )
}

function printJson(rows: ProjectRow[]): void {
  const output = rows.map(({ project, state }) => ({
    ...project,
    status: state ?? 'unknown',
    tools: moduleLabels(project.modules, moduleCatalog()),
  }))
  process.stdout.write(JSON.stringify(output, null, 2) + '\n')
}

async function run(invocation: Invocation): Promise<number> {
  const { rows, engineProblem } = await withSpinner('Reading project statuses', loadRows())
  if (invocation.flags.has('json')) {
    printJson(rows)
    return 0
  }
  if (rows.length === 0) {
    printElement(
      <Text>
        No projects yet. Create one with <Text color={colors.accent}>dev new</Text>
      </Text>,
    )
    return 0
  }
  printElement(<ProjectTable rows={rows} />)
  if (engineProblem) printElement(<ProblemView problem={engineProblem} />)
  return 0
}

export const listCommand: CommandDefinition = {
  name: 'ls',
  aliases: ['list'],
  summary: 'List your projects, whether they are running, and where their code comes from',
  arguments: [],
  flags: [{ name: 'json', description: 'Print the projects as JSON, for scripts.' }],
  description: [
    'Shows one line per project: its status (running, stopped, or no container), the ports it forwards and where its code comes from.',
    'When the container engine is not running, the statuses show as unknown and dev ls explains how to start it.',
  ],
  examples: [
    { command: 'dev ls', explanation: 'See every project.' },
    { command: 'dev ls --json | jq -r ".[].name"', explanation: 'Print just the project names.' },
  ],
  seeAlso: ['start', 'new'],
  run,
}
