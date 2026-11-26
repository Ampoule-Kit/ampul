import { Text } from 'ink'
import { commandManualPage, overviewManualPage } from './cli/manualPages.js'
import { parseArguments } from './cli/parseArguments.js'
import { runHome } from './commands/home.js'
import { allCommands, findCommand, unknownCommand } from './commands/registry.js'
import { asProblem, UserCancelled } from './problems/Problem.js'
import { ProblemView } from './ui/components/ProblemView.js'
import { isInteractiveTerminal, printElement, printErrorElement } from './ui/terminal.js'
import { colors } from './ui/theme.js'
import { devenvVersion } from './version.js'

const cancelledExitCode = 130
const failureExitCode = 1
const versionFlags = new Set(['--version', '-v', 'version'])
const helpFlags = new Set(['--help', '-h'])

async function dispatch(args: string[]): Promise<number> {
  const [commandName, ...rest] = args
  if (!commandName) {
    if (isInteractiveTerminal()) return runHome()
    process.stdout.write(overviewManualPage(allCommands()))
    return 0
  }
  if (versionFlags.has(commandName)) {
    process.stdout.write(`devenv ${devenvVersion}\n`)
    return 0
  }
  if (helpFlags.has(commandName)) {
    process.stdout.write(overviewManualPage(allCommands()))
    return 0
  }

  const command = findCommand(commandName)
  if (!command) throw unknownCommand(commandName)
  const { positionals, flags } = parseArguments(command, rest)
  if (flags.has('help')) {
    process.stdout.write(commandManualPage(command))
    return 0
  }
  return (await command.run({ positionals, flags, interactive: isInteractiveTerminal() })) ?? 0
}

async function main(): Promise<void> {
  try {
    process.exitCode = await dispatch(process.argv.slice(2))
  } catch (error) {
    if (error instanceof UserCancelled) {
      printElement(<Text color={colors.muted}>Cancelled. Nothing was changed.</Text>)
      process.exitCode = cancelledExitCode
      return
    }
    printErrorElement(<ProblemView problem={asProblem(error)} />)
    process.exitCode = failureExitCode
  }
}

await main()
