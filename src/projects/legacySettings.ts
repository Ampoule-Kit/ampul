import type { ProjectSettings } from './ProjectSettings.js'

const nonDependencySettings = new Set([
  'PROJECT_NAME',
  'CODE_SOURCE',
  'REPOSITORIES',
  'COPY_FOLDER',
  'COPY_GIT_FILES_ONLY',
  'DOTNET_SDKS',
  'PORTS',
])

export function parseLegacySettings(fileContent: string): ProjectSettings {
  const values = new Map<string, string>()
  for (const line of fileContent.split('\n')) {
    const assignment = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (assignment) values.set(assignment[1]!, unquoteBashValue(assignment[2]!))
  }

  const words = (name: string) => (values.get(name) ?? '').split(/\s+/).filter(Boolean)
  const optionalDependencies: Record<string, string> = {}
  for (const [name, value] of values) {
    if (!nonDependencySettings.has(name) && value) optionalDependencies[name] = value
  }

  return {
    name: values.get('PROJECT_NAME') ?? '',
    codeSource:
      values.get('CODE_SOURCE') === 'copy'
        ? {
            kind: 'folder',
            folder: values.get('COPY_FOLDER') ?? '',
            onlyGitFiles: Boolean(values.get('COPY_GIT_FILES_ONLY')),
          }
        : { kind: 'repositories', repositories: words('REPOSITORIES') },
    dotnetSdks: words('DOTNET_SDKS'),
    optionalDependencies,
    ports: words('PORTS').map(Number),
  }
}

function unquoteBashValue(rawValue: string): string {
  if (rawValue.startsWith("$'") && rawValue.endsWith("'")) {
    return rawValue.slice(2, -1).replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\(.)/g, '$1')
  }
  let value = ''
  let insideSingleQuotes = false
  for (let index = 0; index < rawValue.length; index++) {
    const character = rawValue[index]!
    if (character === "'") {
      insideSingleQuotes = !insideSingleQuotes
    } else if (character === '\\' && !insideSingleQuotes && index + 1 < rawValue.length) {
      index++
      value += rawValue[index]
    } else {
      value += character
    }
  }
  return value
}
