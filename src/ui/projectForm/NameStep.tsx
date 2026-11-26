import { Text } from 'ink'
import { containerName } from '../../containers/naming.ts'
import { suggestedProjectName } from '../../projects/codeSources.ts'
import { projectNameFormatProblem, toProjectName } from '../../projects/projectNames.ts'
import { projectExists } from '../../projects/projectStore.ts'
import { Question } from '../components/Question.tsx'
import { TextPrompt } from '../components/TextPrompt.tsx'
import type { StepControls } from '../components/Wizard.tsx'
import { colors } from '../theme.ts'
import { type ProjectDraft, settingsFromDraft } from './ProjectDraft.ts'

function projectNameProblem(name: string): string | undefined {
  const formatProblem = projectNameFormatProblem(name)
  if (formatProblem) return formatProblem
  if (projectExists(name)) return `A project named '${name}' already exists. Pick another name.`
  return undefined
}

export function NameStep({ draft, submit, back }: StepControls<ProjectDraft>) {
  const suggestion =
    draft.name || toProjectName(suggestedProjectName(settingsFromDraft(draft).codeSource))
  return (
    <Question
      title="What should the project be called?"
      explanation="You type it in every command, like ampul start <name>, so short is good."
    >
      <TextPrompt
        initialValue={suggestion}
        validate={projectNameProblem}
        preview={(value) =>
          value && !projectNameFormatProblem(value) ? (
            <Text color={colors.muted}>Container and image: {containerName(value)}</Text>
          ) : null
        }
        onSubmit={(name) => submit({ name })}
        onCancel={back}
      />
    </Question>
  )
}
