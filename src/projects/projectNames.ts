const validProjectName = /^[a-z0-9][a-z0-9-]*$/

function isValidProjectName(name: string): boolean {
  return validProjectName.test(name)
}

export function projectNameFormatProblem(name: string): string | undefined {
  if (!name) return 'Enter a name.'
  if (isValidProjectName(name)) return undefined
  return 'Use lowercase letters, digits and dashes, starting with a letter or digit.'
}

export function toProjectName(text: string): string {
  return text
    .toLowerCase()
    .replaceAll(/[^a-z0-9-]/g, '-')
    .replaceAll(/-+/g, '-')
    .replaceAll(/^-|-$/g, '')
}
