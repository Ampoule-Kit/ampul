import { Problem } from '../problems/Problem.ts'
import { type CommandDefinition, type FlagDefinition, helpFlag } from './CommandDefinition.ts'
import { closestMatch } from './suggestions.ts'

export interface ParsedArguments {
  positionals: string[]
  flags: Set<string>
}

function knownFlags(command: CommandDefinition): FlagDefinition[] {
  return [...command.flags, helpFlag]
}

function unknownFlag(command: CommandDefinition, written: string): Problem {
  const flagNames = knownFlags(command).map((flag) => `--${flag.name}`)
  const suggestion = closestMatch(written, flagNames)
  return new Problem(`dev ${command.name} has no option ${written}`, {
    explanation: suggestion ? `Did you mean ${suggestion}?` : undefined,
    fixes: [{ description: 'See what it accepts', command: `dev ${command.name} --help` }],
  })
}

function tooManyArguments(command: CommandDefinition, extra: string[]): Problem {
  return new Problem(`dev ${command.name} got more arguments than it takes`, {
    explanation: `It does not know what to do with: ${extra.join(' ')}`,
    fixes: [{ description: 'See how to use it', command: `dev ${command.name} --help` }],
  })
}

export function parseArguments(command: CommandDefinition, args: string[]): ParsedArguments {
  const flags = new Set<string>()
  const positionals: string[] = []
  const flagsByShortName = new Map(knownFlags(command).map((flag) => [flag.short, flag.name]))
  const flagNames = new Set(knownFlags(command).map((flag) => flag.name))
  let optionsEnded = false

  for (const argument of args) {
    if (optionsEnded || !argument.startsWith('-') || argument === '-') {
      positionals.push(argument)
    } else if (argument === '--') {
      optionsEnded = true
    } else if (argument.startsWith('--')) {
      const name = argument.slice(2)
      if (!flagNames.has(name)) throw unknownFlag(command, argument)
      flags.add(name)
    } else {
      for (const shortName of argument.slice(1)) {
        const name = flagsByShortName.get(shortName)
        if (!name) throw unknownFlag(command, `-${shortName}`)
        flags.add(name)
      }
    }
  }

  if (!flags.has(helpFlag.name) && positionals.length > command.arguments.length) {
    throw tooManyArguments(command, positionals.slice(command.arguments.length))
  }
  return { positionals, flags }
}
