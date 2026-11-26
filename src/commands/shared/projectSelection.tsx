import type { Invocation } from '../../cli/CommandDefinition.js'
import { allContainerStates } from '../../containers/containerState.js'
import type { ContainerEngine } from '../../engine/ContainerEngine.js'
import { Problem, UserCancelled } from '../../problems/Problem.js'
import { listProjects, loadProject } from '../../projects/projectStore.js'
import type { ProjectSettings } from '../../projects/ProjectSettings.js'
import { AnsweredQuestion } from '../../ui/components/Question.js'
import { ProjectPicker } from '../../ui/screens/ProjectPicker.js'
import { showInteractiveScreen } from '../../ui/terminal.js'

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
  if (projects.length === 0) throw noProjectsYet()
  if (!invocation.interactive) {
    throw new Problem(`dev ${commandName} needs a project name`, {
      explanation: `The projects are: ${projects.map((project) => project.name).join(', ')}.`,
      fixes: [
        { description: 'Name the project', command: `dev ${commandName} ${projects[0]!.name}` },
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
