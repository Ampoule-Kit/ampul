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
  return new Problem(`'${name}' is not an ampul command`, {
    explanation: suggestion ? `Did you mean ampul ${suggestion}?` : undefined,
    fixes: [{ description: 'See every command', command: 'ampul help' }],
  })
}
