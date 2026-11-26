import { Question } from '../components/Question.tsx'
import { SelectList } from '../components/SelectList.tsx'
import type { StepControls } from '../components/Wizard.tsx'
import type { ProjectDraft } from './ProjectDraft.ts'

export function GitFilesStep({ draft, submit, back }: StepControls<ProjectDraft>) {
  return (
    <Question
      title="The folder is a git repository. What should be copied?"
      explanation="Ignored files are usually build output, dependencies and secrets that belong to this machine."
    >
      <SelectList<boolean>
        initialValue={draft.onlyGitFiles}
        options={[
          {
            value: true,
            label: 'Only what git tracks or does not ignore',
            hint: 'recommended',
            description:
              'Copies .git and every file git knows about or would pick up. Leaves out node_modules, bin, obj, .env and anything else in .gitignore, so the copy is small and clean.',
          },
          {
            value: false,
            label: 'Everything in the folder',
            description:
              'An exact copy, ignored files included. Useful when the project needs local files that are not committed, but it can be large and slow.',
          },
        ]}
        onSelect={(onlyGitFiles) => submit({ onlyGitFiles })}
        onCancel={back}
      />
    </Question>
  )
}

export function describeGitFiles(draft: ProjectDraft): string {
  return draft.onlyGitFiles ? 'Only what git tracks or does not ignore' : 'Everything'
}
