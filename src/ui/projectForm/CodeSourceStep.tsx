import { Question } from '../components/Question.js'
import { SelectList } from '../components/SelectList.js'
import type { StepControls } from '../components/Wizard.js'
import type { ProjectDraft } from './ProjectDraft.js'

export function CodeSourceStep({ draft, submit, back }: StepControls<ProjectDraft>) {
  return (
    <Question
      title="Where does the code come from?"
      explanation="The code lives only inside the container, in ~/Project. It is fetched fresh every time the project is rebuilt."
    >
      <SelectList<ProjectDraft['codeSourceKind']>
        initialValue={draft.codeSourceKind}
        options={[
          {
            value: 'repositories',
            label: 'Clone git repositories',
            description:
              'One or more repositories, HTTPS or SSH, cloned side by side into ~/Project. Your git credentials and SSH keys are available inside the container.',
          },
          {
            value: 'folder',
            label: 'Copy a folder from this machine',
            description:
              'A one-time copy of a local folder. Changes inside the container never touch the original, and a rebuild copies it again.',
          },
        ]}
        onSelect={(codeSourceKind) => submit({ codeSourceKind })}
        onCancel={back}
        cancelLabel="quit"
      />
    </Question>
  )
}

export function describeCodeSourceKind(draft: ProjectDraft): string {
  return draft.codeSourceKind === 'repositories' ? 'Clone git repositories' : 'Copy a folder'
}
