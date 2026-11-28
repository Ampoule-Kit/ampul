import type { ModuleCatalog } from '../../modules/ModuleDefinition.ts'
import { moduleCatalog } from '../../modules/moduleCatalog.ts'
import {
  describeConflict,
  describeModuleSelection,
  moduleVersionText,
  mutuallyExclusiveIds,
  requiringModuleLabels,
  selectionConflicts,
  selectionOf,
} from '../../modules/moduleSelection.ts'
import { joinInProse } from '../../text/prose.ts'
import { MultiSelectList, type MultiSelectOption } from '../components/MultiSelectList.tsx'
import { Question } from '../components/Question.tsx'
import type { StepControls } from '../components/Wizard.tsx'
import type { ProjectDraft } from './ProjectDraft.ts'

const alwaysIncluded = 'git, curl, ssh, sudo, jq and the Ubuntu basics'

function moduleOptions(catalog: ModuleCatalog): MultiSelectOption<string>[] {
  return catalog.modules.map((module) => ({
    value: module.id,
    label: module.label,
    hint: moduleVersionText(module) || undefined,
    section: module.section,
    description: module.description,
    exclusiveWith: mutuallyExclusiveIds(module, catalog),
  }))
}

function requiredModuleReasons(
  selection: string[],
  draft: ProjectDraft,
  catalog: ModuleCatalog,
): Map<string, string> {
  const reasons = new Map<string, string>()
  for (const [id, requiredBy] of requiringModuleLabels(
    selectionOf(selection, draft.moduleVersions),
    catalog,
  )) {
    reasons.set(id, `needed by ${joinInProse(requiredBy)}`)
  }
  return reasons
}

function selectionProblem(
  selection: string[],
  draft: ProjectDraft,
  catalog: ModuleCatalog,
): string | undefined {
  const [conflict] = selectionConflicts(selectionOf(selection, draft.moduleVersions), catalog)
  return conflict && `${describeConflict(conflict)}, and one is needed by another selected tool`
}

export function ModulesStep({ draft, submit, back }: StepControls<ProjectDraft>) {
  const catalog = moduleCatalog()
  return (
    <Question
      title="Which tools should the container have?"
      explanation={`The everyday tools are selected to start with. A tool that another one needs stays selected while that one is. You pick versions next. Always included: ${alwaysIncluded}.`}
    >
      <MultiSelectList
        options={moduleOptions(catalog)}
        initialSelection={draft.modules}
        requiredOptions={(selection) => requiredModuleReasons(selection, draft, catalog)}
        selectionProblem={(selection) => selectionProblem(selection, draft, catalog)}
        onSubmit={(modules) => submit({ modules })}
        onCancel={back}
      />
    </Question>
  )
}

export function describeModulesAnswer(draft: ProjectDraft): string {
  return describeModuleSelection(draft, moduleCatalog())
}
