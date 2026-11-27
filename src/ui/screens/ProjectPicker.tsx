import type { ContainerState } from '../../containers/containerState.ts'
import { describeCodeSource } from '../../projects/codeSources.ts'
import type { ProjectSettings } from '../../projects/ProjectSettings.ts'
import { describeForwardedPorts, describeTools } from '../../projects/projectSummary.ts'
import { Question } from '../components/Question.tsx'
import { SelectList } from '../components/SelectList.tsx'
import { containerStateMarker } from '../containerStateDisplay.ts'
import type { Finish } from '../terminal.tsx'

interface ProjectPickerProps {
  title: string
  projects: ProjectSettings[]
  states: Map<string, ContainerState>
  finish: Finish<string | undefined>
}

export function ProjectPicker({ title, projects, states, finish }: ProjectPickerProps) {
  return (
    <Question title={title}>
      <SelectList
        options={projects.map((project) => ({
          value: project.name,
          label: project.name,
          hint: `${containerStateMarker(states.get(project.name) ?? 'missing')}  ${describeCodeSource(project.codeSource)}`,
          description: `Tools: ${describeTools(project)}\nPorts: ${describeForwardedPorts(project.name)}`,
        }))}
        onSelect={finish}
        onCancel={() => finish(undefined)}
        cancelLabel="cancel"
      />
    </Question>
  )
}
