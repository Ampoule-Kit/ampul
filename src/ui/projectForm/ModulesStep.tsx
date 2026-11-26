import { moduleCatalog } from '../../modules/moduleCatalog.js'
import {
  describeModuleSelection,
  joinInProse,
  moduleVersionText,
  requiringModules,
} from '../../modules/moduleSelection.js'
import type { ModuleCatalog } from '../../modules/ModuleDefinition.js'
import { MultiSelectList, type MultiSelectOption } from '../components/MultiSelectList.js'
import { Question } from '../components/Question.js'
import type { StepControls } from '../components/Wizard.js'
import type { ProjectDraft } from './ProjectDraft.js'

const alwaysIncluded = 'git, curl, ssh, sudo, jq and the Ubuntu basics'

function moduleOptions(catalog: ModuleCatalog): MultiSelectOption<string>[] {
  return catalog.modules.map((module) => ({
    value: module.id,
    label: module.label,
    hint: moduleVersionText(module) || undefined,
    section: module.section,
    description: module.description,
    exclusiveGroup: module.group,
  }))
}

function requiredModuleReasons(selection: string[], catalog: ModuleCatalog): Map<string, string> {
  const reasons = new Map<string, string>()
  for (const [id, requiredBy] of requiringModules(selection, catalog)) {
    reasons.set(id, `needed by ${joinInProse(requiredBy)}`)
  }
  return reasons
}

export function ModulesStep({ draft, submit, back }: StepControls<ProjectDraft>) {
  const catalog = moduleCatalog()
  return (
    <Question
      title="Which tools should the container have?"
      explanation={`The everyday tools are selected to start with. A tool that another one needs stays selected while that one is. Always included: ${alwaysIncluded}.`}
    >
      <MultiSelectList
        options={moduleOptions(catalog)}
        initialSelection={draft.modules}
        requiredOptions={(selection) => requiredModuleReasons(selection, catalog)}
        onSubmit={(modules) => submit({ modules })}
        onCancel={back}
      />
    </Question>
  )
}

export function describeModulesAnswer(draft: ProjectDraft): string {
  return describeModuleSelection(draft.modules, moduleCatalog())
}
