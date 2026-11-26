import type { CommandDefinition } from '../cli/CommandDefinition.ts'
import { findCommand, unknownCommandProblem } from '../cli/commandLookup.ts'
import type { Problem } from '../problems/Problem.ts'
import { configCommand } from './config.tsx'
import { doctorCommand } from './doctor/doctor.tsx'
import { createHelpCommand } from './help.ts'
import { listCommand } from './list.tsx'
import { newProjectCommand } from './newProject.tsx'
import { purgeCommand } from './purge.tsx'
import { rebuildCommand } from './rebuild.tsx'
import { removeCommand } from './remove.tsx'
import { setupCommand } from './setup.tsx'
import { startCommand } from './start.tsx'
import { stopCommand } from './stop.tsx'

const helpCommand = createHelpCommand(allCommands)

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

export function commandNamed(name: string): CommandDefinition | undefined {
  return findCommand(allCommands(), name)
}

export function unknownCommand(name: string): Problem {
  return unknownCommandProblem(allCommands(), name)
}
