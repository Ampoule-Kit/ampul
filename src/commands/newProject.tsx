import type { CommandDefinition, Invocation } from '../cli/CommandDefinition.js'
import { containerState } from '../containers/containerState.js'
import { containerName } from '../containers/naming.js'
import type { ContainerEngine } from '../engine/ContainerEngine.js'
import { Problem, UserCancelled } from '../problems/Problem.js'
import { projectNameFormatProblem } from '../projects/projectNames.js'
import { projectExists, saveProject } from '../projects/projectStore.js'
import { emptyDraft, settingsFromDraft } from '../ui/projectForm/ProjectDraft.js'
import {
  ProjectForm,
  ProjectFormSummary,
  type ProjectFormResult,
} from '../ui/projectForm/ProjectForm.js'
import { showInteractiveScreen } from '../ui/terminal.js'
import { connectToEngine } from './shared/engineConnection.js'
import { buildProject } from './shared/projectBuild.js'
import { describeRuntime } from './shared/runtimeDescription.js'

function validateGivenName(name: string): void {
  const formatProblem = projectNameFormatProblem(name)
  if (formatProblem)
    throw new Problem(`'${name}' cannot be a project name`, { explanation: formatProblem })
  if (projectExists(name)) {
    throw new Problem(`A project named '${name}' already exists`, {
      fixes: [
        { description: 'Change its settings instead', command: `dev config ${name}` },
        { description: 'Or pick another name', command: 'dev new' },
      ],
    })
  }
}

async function requireFreeContainerName(engine: ContainerEngine, name: string): Promise<void> {
  if ((await containerState(engine, name)) === 'missing') return
  throw new Problem(`A container named ${containerName(name)} already exists`, {
    explanation: 'It has no devenv settings, so it was probably left behind by an earlier install.',
    fixes: [
      { description: 'Remove it', command: `${engine.runtime} rm -f ${containerName(name)}` },
      { description: 'Or pick another name', command: 'dev new' },
    ],
  })
}

function requireTerminal(): Problem {
  return new Problem('dev new needs an interactive terminal', {
    explanation:
      'It asks a few questions about the project, and no terminal is attached to answer them.',
    fixes: [{ description: 'Run it in a terminal window', command: 'dev new' }],
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
      description: 'The project name. When left out, dev new suggests one from the code.',
    },
  ],
  flags: [],
  description: [
    'Opens a short guided form: where the code comes from (git repositories to clone, or a folder on this machine to copy), the project name, the tools it gets, and the ports this machine should reach. It shows what is about to happen before anything is built.',
    'It then builds the image, creates the container, copies your dotfiles and each tool’s config in, sets up the tools, git and SSH, and fetches the code into ~/Project. Every step shows its progress, and the full output is kept in a log file.',
    'Repositories that need a password or passphrase are cloned afterwards in the terminal, where git can ask for it.',
    'The code lives only in the container. Push your work before dev rebuild or dev rm, which both throw ~/Project away.',
  ],
  examples: [
    { command: 'dev new', explanation: 'Create a project, choosing everything in the form.' },
    { command: 'dev new api', explanation: 'Create a project called api.' },
  ],
  seeAlso: ['start', 'config', 'rebuild'],
  run,
}
