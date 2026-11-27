import { Box, Text, useInput } from 'ink'
import type { ContainerState } from '../../containers/containerState.ts'
import { describeCodeSource } from '../../projects/codeSources.ts'
import type { ProjectSettings } from '../../projects/ProjectSettings.ts'
import { describeForwardedPorts, describeTools } from '../../projects/projectSummary.ts'
import { Description } from '../components/Description.tsx'
import { Header } from '../components/Header.tsx'
import { hintWhen, type KeyHint, KeyHints } from '../components/KeyHints.tsx'
import { useListNavigation } from '../components/useListNavigation.ts'
import { containerStateMarker } from '../containerStateDisplay.ts'
import type { Finish } from '../terminal.tsx'
import { colorOrTerminalDefault, colors, symbols } from '../theme.ts'

export type HomeAction = 'start' | 'stop' | 'rebuild' | 'config' | 'rm' | 'new' | 'quit'

export interface HomeChoice {
  action: HomeAction
  projectName?: string
}

interface HomeScreenProps {
  projects: ProjectSettings[]
  states: Map<string, ContainerState>
  runtimeDescription: string
  finish: Finish<HomeChoice>
}

const actionKeys: Partial<Record<string, HomeAction>> = {
  s: 'stop',
  r: 'rebuild',
  e: 'config',
  x: 'rm',
}

function EmptyState({ finish }: { finish: Finish<HomeChoice> }) {
  useInput((input, key) => {
    if (key.return || input === 'n') finish({ action: 'new' })
    if (key.escape || input === 'q') finish({ action: 'quit' })
  })
  return (
    <Box flexDirection="column">
      <Text>No projects yet.</Text>
      <Text color={colors.muted}>
        A project is a container with your tools, dotfiles and code, ready to work in.
      </Text>
      <KeyHints
        hints={[
          ['enter', 'create your first project'],
          ['q', 'quit'],
        ]}
      />
    </Box>
  )
}

const stopKey = 's'
const stateColumnWidth = 16

function ProjectList({ projects, states, finish }: Omit<HomeScreenProps, 'runtimeDescription'>) {
  const navigation = useListNavigation(projects.length)
  const focusedProject = projects[navigation.focusedIndex]
  const focusedIsRunning =
    focusedProject !== undefined && states.get(focusedProject.name) === 'running'

  useInput((input, key) => {
    if (navigation.handleNavigationKey(input, key) || !focusedProject) return
    const action = actionKeys[input]
    if (key.return) finish({ action: 'start', projectName: focusedProject.name })
    else if (input === 'n') finish({ action: 'new' })
    else if (key.escape || input === 'q') finish({ action: 'quit' })
    else if (action && (input !== stopKey || focusedIsRunning)) {
      finish({ action, projectName: focusedProject.name })
    }
  })

  if (!focusedProject) return null
  const nameWidth = Math.max(...projects.map((project) => project.name.length)) + 3
  const hints: KeyHint[] = [
    ['↑↓', 'move'],
    ['enter', 'connect'],
    ...hintWhen(focusedIsRunning, [stopKey, 'stop']),
    ['e', 'configure'],
    ['r', 'rebuild'],
    ['x', 'remove'],
    ['n', 'new'],
    ['q', 'quit'],
  ]
  return (
    <Box flexDirection="column">
      {projects.map((project, index) => {
        const isFocused = index === navigation.focusedIndex
        const state = states.get(project.name) ?? 'missing'
        return (
          <Box key={project.name}>
            <Text color={colors.accent}>{isFocused ? symbols.pointer : ' '} </Text>
            <Box width={nameWidth}>
              <Text
                bold={isFocused}
                {...colorOrTerminalDefault(isFocused ? colors.accent : undefined)}
              >
                {project.name}
              </Text>
            </Box>
            <Box width={stateColumnWidth}>
              <Text color={state === 'running' ? colors.success : colors.muted}>
                {containerStateMarker(state)}
              </Text>
            </Box>
            <Text color={colors.muted} wrap="truncate-end">
              {describeCodeSource(project.codeSource)}
            </Text>
          </Box>
        )
      })}
      <Description>
        {`Tools: ${describeTools(focusedProject)}\nPorts: ${describeForwardedPorts(focusedProject.name)}`}
      </Description>
      <KeyHints hints={hints} />
    </Box>
  )
}

export function HomeScreen({ projects, states, runtimeDescription, finish }: HomeScreenProps) {
  return (
    <Box flexDirection="column">
      <Header title="Projects" subtitle={runtimeDescription} />
      {projects.length === 0 ? (
        <EmptyState finish={finish} />
      ) : (
        <ProjectList projects={projects} states={states} finish={finish} />
      )}
    </Box>
  )
}
