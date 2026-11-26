export interface FlagDefinition {
  name: string
  short?: string | undefined
  description: string
}

export interface ArgumentDefinition {
  name: string
  required: boolean
  description: string
}

export interface Example {
  command: string
  explanation: string
}

export interface Invocation {
  positionals: string[]
  flags: Set<string>
  interactive: boolean
}

export interface CommandDefinition {
  name: string
  aliases?: string[] | undefined
  summary: string
  arguments: ArgumentDefinition[]
  flags: FlagDefinition[]
  description: string[]
  examples: Example[]
  seeAlso: string[]
  run: (invocation: Invocation) => Promise<number> | number
}

export const helpFlag: FlagDefinition = {
  name: 'help',
  short: 'h',
  description: 'Show this manual.',
}

export const yesFlag: FlagDefinition = {
  name: 'yes',
  short: 'y',
  description:
    'Skip the confirmation. Needed when no terminal is attached, for example in scripts.',
}
