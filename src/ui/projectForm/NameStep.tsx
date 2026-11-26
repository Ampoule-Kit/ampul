import { Text } from 'ink'
import { containerName } from '../../containers/naming.js'
import { projectNameFormatProblem, toProjectName } from '../../projects/projectNames.js'
import { projectExists } from '../../projects/projectStore.js'
import { suggestedProjectName } from '../../projects/codeSources.js'
import { Question } from '../components/Question.js'
import { TextPrompt } from '../components/TextPrompt.js'
import type { StepControls } from '../components/Wizard.js'
import { colors } from '../theme.js'
import { settingsFromDraft, type ProjectDraft } from './ProjectDraft.js'

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
      explanation="You type it in every command, like dev start <name>, so short is good."
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
