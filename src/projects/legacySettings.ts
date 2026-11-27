import { type SettingsBeforeModules, settingsBeforeModulesSchema } from './ProjectSettings.ts'

const assignmentPattern = /^([A-Z0-9_]+)=(.*)$/
const settingsThatAreNotDependencies = new Set([
  'PROJECT_NAME',
  'CODE_SOURCE',
  'REPOSITORIES',
  'COPY_FOLDER',
  'COPY_GIT_FILES_ONLY',
  'PORTS',
])

function unquoteAnsiCQuotedValue(rawValue: string): string {
  return rawValue
    .slice(2, -1)
    .replaceAll(String.raw`\n`, '\n')
    .replaceAll(String.raw`\t`, '\t')
    .replaceAll(/\\(.)/g, '$1')
}

function unquoteBashValue(rawValue: string): string {
  if (rawValue.startsWith("$'") && rawValue.endsWith("'")) return unquoteAnsiCQuotedValue(rawValue)
  let value = ''
  let isInsideSingleQuotes = false
  for (let index = 0; index < rawValue.length; index++) {
    const character = rawValue.charAt(index)
    if (character === "'") {
      isInsideSingleQuotes = !isInsideSingleQuotes
    } else if (character === '\\' && !isInsideSingleQuotes && index + 1 < rawValue.length) {
      index++
      value += rawValue.charAt(index)
    } else {
      value += character
    }
  }
  return value
}

function bashAssignments(fileContent: string): Map<string, string> {
  const assignments = new Map<string, string>()
  for (const line of fileContent.split('\n')) {
    const match = assignmentPattern.exec(line)
    const [, name, rawValue] = match ?? []
    if (name !== undefined && rawValue !== undefined) {
      assignments.set(name, unquoteBashValue(rawValue))
    }
  }
  return assignments
}

export function parseLegacySettings(
  fileContent: string,
  projectName: string,
): SettingsBeforeModules {
  const assignments = bashAssignments(fileContent)
  const words = (name: string) => (assignments.get(name) ?? '').split(/\s+/).filter(Boolean)
  const optionalDependencies = Object.fromEntries(
    [...assignments].filter(
      ([name, value]) => !settingsThatAreNotDependencies.has(name) && value !== '',
    ),
  )
  const codeSource =
    assignments.get('CODE_SOURCE') === 'copy'
      ? { kind: 'folder', folder: assignments.get('COPY_FOLDER') ?? '' }
      : { kind: 'repositories', repositories: words('REPOSITORIES') }

  return settingsBeforeModulesSchema.parse({
    name: projectName,
    codeSource,
    optionalDependencies,
    ports: words('PORTS').map(Number),
  })
}
