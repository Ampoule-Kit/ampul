import { Box, Text, useInput } from 'ink'
import { useState } from 'react'
import type { ContainerState } from '../../containers/containerState.js'
import { describeCodeSource } from '../../projects/codeSources.js'
import { describePorts, describeTools } from '../../projects/projectSummary.js'
import type { ProjectSettings } from '../../projects/ProjectSettings.js'
import { Description } from '../components/Description.js'
import { Header } from '../components/Header.js'
import { KeyHints, type KeyHint } from '../components/KeyHints.js'
import type { Finish } from '../terminal.js'
import { colors, symbols } from '../theme.js'
import { stateMarker } from './ProjectPicker.js'

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

const actionKeys: Record<string, HomeAction> = {
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

function ProjectList({ projects, states, finish }: Omit<HomeScreenProps, 'runtimeDescription'>) {
  const [focusedIndex, setFocusedIndex] = useState(0)
  const focused = projects[focusedIndex]!
  const focusedIsRunning = states.get(focused.name) === 'running'

  useInput((input, key) => {
    if (key.upArrow || input === 'k') {
      setFocusedIndex((index) => (index - 1 + projects.length) % projects.length)
    } else if (key.downArrow || input === 'j') {
      setFocusedIndex((index) => (index + 1) % projects.length)
    } else if (key.return) {
      finish({ action: 'start', projectName: focused.name })
    } else if (input === 'n') {
      finish({ action: 'new' })
    } else if (key.escape || input === 'q') {
      finish({ action: 'quit' })
    } else if (actionKeys[input] && (input !== 's' || focusedIsRunning)) {
      finish({ action: actionKeys[input], projectName: focused.name })
    }
  })

  const nameWidth = Math.max(...projects.map((project) => project.name.length)) + 3
  const hints: KeyHint[] = [
    ['↑↓', 'move'],
    ['enter', 'connect'],
    ...(focusedIsRunning ? ([['s', 'stop']] as KeyHint[]) : []),
    ['e', 'configure'],
    ['r', 'rebuild'],
    ['x', 'remove'],
    ['n', 'new'],
    ['q', 'quit'],
  ]
  return (
    <Box flexDirection="column">
      {projects.map((project, index) => {
        const isFocused = index === focusedIndex
        const state = states.get(project.name)
        return (
          <Box key={project.name}>
            <Text color={colors.accent}>{isFocused ? symbols.pointer : ' '} </Text>
            <Box width={nameWidth}>
              <Text bold={isFocused} color={isFocused ? colors.accent : undefined}>
                {project.name}
              </Text>
            </Box>
            <Box width={16}>
              <Text color={state === 'running' ? colors.success : colors.muted}>
                {stateMarker(state)}
              </Text>
            </Box>
            <Text color={colors.muted} wrap="truncate-end">
              {describeCodeSource(project.codeSource)}
            </Text>
          </Box>
        )
      })}
      <Description>
        {`Tools: ${describeTools(focused)}\nPorts: ${describePorts(focused.ports)}`}
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
