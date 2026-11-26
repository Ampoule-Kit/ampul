import type { CommandDefinition, Invocation } from '../cli/CommandDefinition.ts'
import { findCommand, unknownCommandProblem } from '../cli/commandLookup.ts'
import { commandManualPage, overviewManualPage } from '../cli/manualPages.ts'

export function createHelpCommand(availableCommands: () => CommandDefinition[]): CommandDefinition {
  const showManual = ({ positionals }: Invocation): number => {
    const [commandName] = positionals
    const commands = availableCommands()
    if (!commandName) {
      process.stdout.write(overviewManualPage(commands))
      return 0
    }
    const command = findCommand(commands, commandName)
    if (!command) throw unknownCommandProblem(commands, commandName)
    process.stdout.write(commandManualPage(command))
    return 0
  }

  return {
    name: 'help',
    summary: 'Show the manual for ampul, or for one command',
    arguments: [{ name: 'command', required: false, description: 'The command to explain.' }],
    flags: [],
    description: [
      'Without a command, shows the overview of every command, the files ampul uses and its environment variables. With a command, shows that command’s full manual. ampul <command> --help does the same.',
    ],
    examples: [
      { command: 'ampul help', explanation: 'The overview.' },
      { command: 'ampul help start', explanation: 'Everything about ampul start.' },
    ],
    seeAlso: [],
    run: showManual,
  }
}
