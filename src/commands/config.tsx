import { Text } from 'ink'
import type { CommandDefinition, Invocation } from '../cli/CommandDefinition.ts'
import { Problem } from '../problems/Problem.ts'
import { UserCancelled } from '../problems/UserCancelled.ts'
import { saveProject } from '../projects/projectStore.ts'
import { draftFromSettings, settingsFromDraft } from '../ui/projectForm/ProjectDraft.ts'
import {
  ProjectForm,
  type ProjectFormResult,
  ProjectFormSummary,
} from '../ui/projectForm/ProjectForm.tsx'
import { printElement, showInteractiveScreen } from '../ui/terminal.tsx'
import { colors, symbols } from '../ui/theme.ts'
import { confirmAndRebuild } from './rebuild.tsx'
import { connectToEngine } from './shared/engineConnection.tsx'
import { selectProject } from './shared/projectSelection.tsx'
import { describeRuntime } from './shared/runtimeDescription.ts'

async function run(invocation: Invocation): Promise<number> {
  if (!invocation.interactive) {
    throw new Problem('ampul config needs an interactive terminal', {
      explanation:
        'It walks through the project’s settings, and no terminal is attached to answer.',
    })
  }
  const engine = await connectToEngine(true)
  const original = await selectProject({
    invocation,
    engine,
    commandName: 'config',
    question: 'Which project do you want to change?',
  })
  const runtimeDescription = await describeRuntime(engine)

  const result = await showInteractiveScreen<ProjectFormResult | undefined>(
    (finish) => (
      <ProjectForm
        initialDraft={draftFromSettings(original)}
        askForName={false}
        review={{ mode: 'config', runtimeDescription, originalSettings: original }}
        finish={finish}
      />
    ),
    (answer) => (answer ? <ProjectFormSummary draft={answer.draft} askForName={false} /> : null),
  )
  if (!result) throw new UserCancelled()

  const updated = settingsFromDraft(result.draft)
  saveProject(updated)
  if (result.action === 'save-and-rebuild') {
    return confirmAndRebuild(engine, updated, { ...invocation, flags: new Set(['yes']) })
  }
  printElement(
    <Text>
      <Text color={colors.success}>{symbols.success}</Text> Saved.{' '}
      <Text color={colors.muted}>
        Apply the changes with <Text color={colors.accent}>ampul rebuild {updated.name}</Text>
      </Text>
    </Text>,
  )
  return 0
}

export const configCommand: CommandDefinition = {
  name: 'config',
  summary: 'Change where a project’s code comes from, its tools or its ports',
  arguments: [
    {
      name: 'project',
      required: false,
      description: 'The project to change. When left out, ampul config lets you pick one.',
    },
  ],
  flags: [],
  description: [
    'Opens the same form as ampul new, filled in with the project’s current settings. The review at the end marks what changed.',
    'Changes apply when the container is rebuilt. You can rebuild right away from the review, or later with ampul rebuild.',
  ],
  examples: [
    { command: 'ampul config api', explanation: 'Add a .NET SDK to api, or change its ports.' },
  ],
  seeAlso: ['rebuild', 'new'],
  run,
}
