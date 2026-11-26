import type { CommandDefinition, Invocation } from '../cli/CommandDefinition.js'
import { commandManualPage, overviewManualPage } from '../cli/manualPages.js'
import { allCommands, findCommand, unknownCommand } from './registry.js'

async function run(invocation: Invocation): Promise<number> {
  const [commandName] = invocation.positionals
  if (!commandName) {
    process.stdout.write(overviewManualPage(allCommands()))
    return 0
  }
  const command = findCommand(commandName)
  if (!command) throw unknownCommand(commandName)
  process.stdout.write(commandManualPage(command))
  return 0
}

export const helpCommand: CommandDefinition = {
  name: 'help',
  summary: 'Show the manual for dev, or for one command',
  arguments: [{ name: 'command', required: false, description: 'The command to explain.' }],
  flags: [],
  description: [
    'Without a command, shows the overview of every command, the files devenv uses and its environment variables. With a command, shows that command’s full manual. dev <command> --help does the same.',
  ],
  examples: [
    { command: 'dev help', explanation: 'The overview.' },
    { command: 'dev help start', explanation: 'Everything about dev start.' },
  ],
  seeAlso: [],
  run,
}
