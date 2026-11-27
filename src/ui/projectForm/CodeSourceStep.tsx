import type { CodeSource } from '../../projects/ProjectSettings.ts'
import { Question } from '../components/Question.tsx'
import { SelectList, type SelectOption } from '../components/SelectList.tsx'
import type { StepControls } from '../components/Wizard.tsx'
import type { ProjectDraft } from './ProjectDraft.ts'

const codeSourceOptions: SelectOption<CodeSource['kind']>[] = [
  {
    value: 'repositories',
    label: 'Clone git repositories',
    description:
      'One or more repositories, HTTPS or SSH, cloned side by side into ~/home. The clones live only in the container and are cloned fresh on every rebuild. Your git credentials and SSH keys are available inside the container.',
  },
  {
    value: 'folders',
    label: 'Mount folders from this machine',
    description:
      'One or more folders, such as repositories you already have, mounted side by side into ~/home. The container works on the folders themselves, so nothing is lost on a rebuild.',
  },
  {
    value: 'pass-through',
    label: 'Pass through your home folder',
    description:
      'Your home folder on this machine is mounted at ~/home, so all your own folders are there. Your ampul dotfiles are linked into the container’s own home folder, ~.',
  },
]

export function CodeSourceStep({ draft, submit, back }: StepControls<ProjectDraft>) {
  return (
    <Question
      title="Where does the code come from?"
      explanation="The code is in ~/home inside the container, where every shell starts."
    >
      <SelectList<CodeSource['kind']>
        initialValue={draft.codeSourceKind}
        options={codeSourceOptions}
        onSelect={(codeSourceKind) => submit({ codeSourceKind })}
        onCancel={back}
        cancelLabel="quit"
      />
    </Question>
  )
}

export function describeCodeSourceKind(draft: ProjectDraft): string {
  return codeSourceOptions.find((option) => option.value === draft.codeSourceKind)?.label ?? ''
}
