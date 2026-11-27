import type { CommandDefinition, Invocation } from '../cli/CommandDefinition.ts'
import { containerState } from '../containers/containerState.ts'
import { containerName } from '../containers/naming.ts'
import type { ContainerEngine } from '../engine/ContainerEngine.ts'
import { Problem } from '../problems/Problem.ts'
import { UserCancelled } from '../problems/UserCancelled.ts'
import { projectNameFormatProblem } from '../projects/projectNames.ts'
import { projectExists, saveProject } from '../projects/projectStore.ts'
import { emptyDraft, settingsFromDraft } from '../ui/projectForm/ProjectDraft.ts'
import {
  ProjectForm,
  type ProjectFormResult,
  ProjectFormSummary,
} from '../ui/projectForm/ProjectForm.tsx'
import { showInteractiveScreen } from '../ui/terminal.tsx'
import { connectToEngine } from './shared/engineConnection.tsx'
import { buildProject } from './shared/projectBuild/buildProject.tsx'
import { describeRuntime } from './shared/runtimeDescription.ts'

function validateGivenName(name: string): void {
  const formatProblem = projectNameFormatProblem(name)
  if (formatProblem)
    throw new Problem(`'${name}' cannot be a project name`, { explanation: formatProblem })
  if (projectExists(name)) {
    throw new Problem(`A project named '${name}' already exists`, {
      fixes: [
        { description: 'Change its settings instead', command: `ampul config ${name}` },
        { description: 'Or pick another name', command: 'ampul new' },
      ],
    })
  }
}

async function requireFreeContainerName(engine: ContainerEngine, name: string): Promise<void> {
  if ((await containerState(engine, name)) === 'missing') return
  throw new Problem(`A container named ${containerName(name)} already exists`, {
    explanation: 'It has no ampul settings, so it was probably left behind by an earlier install.',
    fixes: [
      { description: 'Remove it', command: `${engine.runtime} rm -f ${containerName(name)}` },
      { description: 'Or pick another name', command: 'ampul new' },
    ],
  })
}

function requireTerminal(): Problem {
  return new Problem('ampul new needs an interactive terminal', {
    explanation:
      'It asks a few questions about the project, and no terminal is attached to answer them.',
    fixes: [{ description: 'Run it in a terminal window', command: 'ampul new' }],
  })
}

async function run(invocation: Invocation): Promise<number> {
  if (!invocation.interactive) throw requireTerminal()
  const [givenName] = invocation.positionals
  if (givenName) validateGivenName(givenName)

  const engine = await connectToEngine(true)
  const runtimeDescription = await describeRuntime(engine)
  const askForName = !givenName

  const result = await showInteractiveScreen<ProjectFormResult | undefined>(
    (finish) => (
      <ProjectForm
        initialDraft={emptyDraft(givenName)}
        askForName={askForName}
        review={{ mode: 'new', runtimeDescription }}
        finish={finish}
      />
    ),
    (answer) =>
      answer ? <ProjectFormSummary draft={answer.draft} askForName={askForName} /> : null,
  )
  if (!result) throw new UserCancelled()

  const project = settingsFromDraft(result.draft)
  await requireFreeContainerName(engine, project.name)
  saveProject(project)
  return buildProject(engine, project, true)
}

export const newProjectCommand: CommandDefinition = {
  name: 'new',
  summary: 'Create a project container, answering a few questions on the way',
  arguments: [
    {
      name: 'name',
      required: false,
      description: 'The project name. When left out, ampul new suggests one from the code.',
    },
  ],
  flags: [],
  description: [
    'Opens a short guided form: where the code comes from (git repositories to clone, folders on this machine to mount, or your whole home folder passed through), the project name, the tools it gets, and the ports this machine should reach. It shows what is about to happen before anything is built.',
    'It then builds the image, creates the container, copies your dotfiles and each tool’s config in, sets up the tools, git and SSH, and clones or mounts the code into ~/home. Every step shows its progress, and the full output is kept in a log file.',
    'Repositories that need a password or passphrase are cloned afterwards in the terminal, where git can ask for it.',
    'Cloned repositories live only in the container. Push your work before ampul rebuild or ampul rm, which both throw them away. Mounted folders stay on this machine.',
  ],
  examples: [
    { command: 'ampul new', explanation: 'Create a project, choosing everything in the form.' },
    { command: 'ampul new api', explanation: 'Create a project called api.' },
  ],
  seeAlso: ['start', 'config', 'rebuild'],
  run,
}
