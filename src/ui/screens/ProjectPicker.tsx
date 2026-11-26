import { containerStateLabels, type ContainerState } from '../../containers/containerState.js'
import { describeCodeSource } from '../../projects/codeSources.js'
import { describePorts, describeTools } from '../../projects/projectSummary.js'
import type { ProjectSettings } from '../../projects/ProjectSettings.js'
import { Question } from '../components/Question.js'
import { SelectList } from '../components/SelectList.js'
import type { Finish } from '../terminal.js'
import { symbols } from '../theme.js'

interface ProjectPickerProps {
  title: string
  projects: ProjectSettings[]
  states: Map<string, ContainerState>
  finish: Finish<string | undefined>
}

export function stateMarker(state: ContainerState | undefined): string {
  if (state === 'running') return `${symbols.running} running`
  if (!state) return `${symbols.stopped} unknown`
  return `${symbols.stopped} ${containerStateLabels[state]}`
}

export function ProjectPicker({ title, projects, states, finish }: ProjectPickerProps) {
  return (
    <Question title={title}>
      <SelectList
        options={projects.map((project) => ({
          value: project.name,
          label: project.name,
          hint: `${stateMarker(states.get(project.name) ?? 'missing')}  ${describeCodeSource(project.codeSource)}`,
          description: `Tools: ${describeTools(project)}\nPorts: ${describePorts(project.ports)}`,
        }))}
        onSelect={finish}
        onCancel={() => finish(undefined)}
        cancelLabel="cancel"
      />
    </Question>
  )
}
