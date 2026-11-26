import type { Invocation } from '../../cli/CommandDefinition.ts'
import { allContainerStates } from '../../containers/containerState.ts'
import type { ContainerEngine } from '../../engine/ContainerEngine.ts'
import { Problem } from '../../problems/Problem.ts'
import { UserCancelled } from '../../problems/UserCancelled.ts'
import type { ProjectSettings } from '../../projects/ProjectSettings.ts'
import { listProjects, loadProject } from '../../projects/projectStore.ts'
import { AnsweredQuestion } from '../../ui/components/Question.tsx'
import { ProjectPicker } from '../../ui/screens/ProjectPicker.tsx'
import { showInteractiveScreen } from '../../ui/terminal.tsx'

interface ProjectSelectionRequest {
  invocation: Invocation
  engine: ContainerEngine
  commandName: string
  question: string
}

function noProjectsYet(): Problem {
  return new Problem('There are no projects yet', {
    fixes: [{ description: 'Create your first one', command: 'dev new' }],
  })
}

export async function selectProject({
  invocation,
  engine,
  commandName,
  question,
}: ProjectSelectionRequest): Promise<ProjectSettings> {
  const [name] = invocation.positionals
  if (name) return loadProject(name)

  const projects = listProjects()
  const [firstProject] = projects
  if (!firstProject) throw noProjectsYet()
  if (!invocation.interactive) {
    throw new Problem(`dev ${commandName} needs a project name`, {
      explanation: `The projects are: ${projects.map((project) => project.name).join(', ')}.`,
      fixes: [
        { description: 'Name the project', command: `dev ${commandName} ${firstProject.name}` },
      ],
    })
  }

  const states = await allContainerStates(engine)
  const chosen = await showInteractiveScreen<string | undefined>(
    (finish) => (
      <ProjectPicker title={question} projects={projects} states={states} finish={finish} />
    ),
    (result) => (result ? <AnsweredQuestion title="Project" answer={result} /> : null),
  )
  if (!chosen) throw new UserCancelled()
  return loadProject(chosen)
}
