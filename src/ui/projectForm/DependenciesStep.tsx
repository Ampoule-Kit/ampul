import { Text } from 'ink'
import { dependencyCatalog, type DependencyCatalog } from '../../resources/dependencyCatalog.js'
import { selectedToolNames } from '../../projects/projectSummary.js'
import type { DependencySelection } from '../../projects/ProjectSettings.js'
import { MultiSelectList, type MultiSelectOption } from '../components/MultiSelectList.js'
import { Question } from '../components/Question.js'
import type { StepControls } from '../components/Wizard.js'
import { colors, symbols } from '../theme.js'
import type { ProjectDraft } from './ProjectDraft.js'

const alwaysIncluded =
  'Neovim, Node.js, git, Claude Code, lazygit, yazi, zellij, ripgrep, fd, fzf and build-essential'

const dotnetPrefix = 'dotnet:'
const choiceSeparator = '='

function dependencyOptions(catalog: DependencyCatalog): MultiSelectOption<string>[] {
  const dotnetOptions = catalog.dotnetSdks.map((sdk) => ({
    value: dotnetPrefix + sdk.channel,
    label: `.NET ${sdk.channel} SDK`,
    hint: sdk.version,
    section: '.NET',
    description:
      'The .NET SDK, installed side by side with any other version you pick, with NuGet packages cached across rebuilds.',
  }))
  const optionalOptions = catalog.optionalDependencies.flatMap((dependency) => {
    const common = { section: 'Languages and tools', description: dependency.description }
    if (dependency.kind === 'yes-no') {
      return [
        { ...common, value: dependency.setting, label: dependency.label, hint: dependency.version },
      ]
    }
    return dependency.choices.map((choice) => ({
      ...common,
      value: dependency.setting + choiceSeparator + choice,
      label: `${dependency.label} (${choice})`,
      hint: dependency.version,
      exclusiveGroup: dependency.setting,
    }))
  })
  return [...dotnetOptions, ...optionalOptions]
}

function selectionValues(draft: ProjectDraft, catalog: DependencyCatalog): string[] {
  const dotnet = draft.dotnetSdks.map((channel) => dotnetPrefix + channel)
  const optional = catalog.optionalDependencies.flatMap((dependency) => {
    const value = draft.optionalDependencies[dependency.setting]
    if (!value) return []
    return [
      dependency.kind === 'yes-no'
        ? dependency.setting
        : dependency.setting + choiceSeparator + value,
    ]
  })
  return [...dotnet, ...optional]
}

function selectionFromValues(values: string[], catalog: DependencyCatalog): DependencySelection {
  const dotnetSdks = values
    .filter((value) => value.startsWith(dotnetPrefix))
    .map((value) => value.slice(dotnetPrefix.length))
  const optionalDependencies: Record<string, string> = {}
  for (const dependency of catalog.optionalDependencies) {
    const selected = values.find(
      (value) =>
        value === dependency.setting || value.startsWith(dependency.setting + choiceSeparator),
    )
    if (selected) {
      optionalDependencies[dependency.setting] =
        selected === dependency.setting ? 'yes' : selected.slice(dependency.setting.length + 1)
    }
  }
  return { dotnetSdks, optionalDependencies }
}

function SelectionWarnings({ values, catalog }: { values: string[]; catalog: DependencyCatalog }) {
  const selection = selectionFromValues(values, catalog)
  if (selection.optionalDependencies.GODOT === 'dotnet' && selection.dotnetSdks.length === 0) {
    return (
      <Text color={colors.warning}>
        {symbols.warning} Godot (dotnet) builds C# scripts with a .NET SDK, and none is selected.
      </Text>
    )
  }
  return null
}

export function DependenciesStep({ draft, submit, back }: StepControls<ProjectDraft>) {
  const catalog = dependencyCatalog()
  return (
    <Question
      title="Which extra tools does the project need?"
      explanation={`Always included: ${alwaysIncluded}.`}
    >
      <MultiSelectList
        options={dependencyOptions(catalog)}
        initialSelection={selectionValues(draft, catalog)}
        onSubmit={(values) => submit(selectionFromValues(values, catalog))}
        onCancel={back}
        footer={(values) => <SelectionWarnings values={values} catalog={catalog} />}
      />
    </Question>
  )
}

export function describeDependencies(draft: ProjectDraft): string {
  const names = selectedToolNames(draft)
  return names.length > 0 ? names.join(', ') : 'Only the standard tools'
}
