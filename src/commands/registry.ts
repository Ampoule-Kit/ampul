import type { CommandDefinition } from '../cli/CommandDefinition.js'
import { closestMatch } from '../cli/suggestions.js'
import { Problem } from '../problems/Problem.js'
import { configCommand } from './config.js'
import { doctorCommand } from './doctor/doctor.js'
import { helpCommand } from './help.js'
import { listCommand } from './list.js'
import { newProjectCommand } from './newProject.js'
import { purgeCommand } from './purge.js'
import { rebuildCommand } from './rebuild.js'
import { removeCommand } from './remove.js'
import { setupCommand } from './setup.js'
import { startCommand } from './start.js'
import { stopCommand } from './stop.js'

export function allCommands(): CommandDefinition[] {
  return [
    newProjectCommand,
    startCommand,
    stopCommand,
    listCommand,
    configCommand,
    rebuildCommand,
    setupCommand,
    removeCommand,
    purgeCommand,
    doctorCommand,
    helpCommand,
  ]
}

function namesOf(command: CommandDefinition): string[] {
  return [command.name, ...(command.aliases ?? [])]
}

export function findCommand(name: string): CommandDefinition | undefined {
  return allCommands().find((command) => namesOf(command).includes(name))
}

export function unknownCommand(name: string): Problem {
  const suggestion = closestMatch(name, allCommands().flatMap(namesOf))
  return new Problem(`'${name}' is not a dev command`, {
    explanation: suggestion ? `Did you mean dev ${suggestion}?` : undefined,
    fixes: [{ description: 'See every command', command: 'dev help' }],
  })
}
