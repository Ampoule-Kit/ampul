import { Problem } from '../problems/Problem.ts'
import type { CommandDefinition } from './CommandDefinition.ts'
import { closestMatch } from './suggestions.ts'

function namesOf(command: CommandDefinition): string[] {
  return [command.name, ...(command.aliases ?? [])]
}

export function findCommand(
  commands: CommandDefinition[],
  name: string,
): CommandDefinition | undefined {
  return commands.find((command) => namesOf(command).includes(name))
}

export function unknownCommandProblem(commands: CommandDefinition[], name: string): Problem {
  const suggestion = closestMatch(name, commands.flatMap(namesOf))
  return new Problem(`'${name}' is not a dev command`, {
    explanation: suggestion ? `Did you mean dev ${suggestion}?` : undefined,
    fixes: [{ description: 'See every command', command: 'dev help' }],
  })
}
