import { Text } from 'ink'
import { commandManualPage, overviewManualPage } from './cli/manualPages.ts'
import { parseArguments } from './cli/parseArguments.ts'
import { runHome } from './commands/home.tsx'
import { allCommands, commandNamed, unknownCommand } from './commands/registry.ts'
import { forwarderCommandName, runPortForwarder } from './forwarding/forwarderProcess.ts'
import { asProblem } from './problems/Problem.ts'
import { UserCancelled } from './problems/UserCancelled.ts'
import { ensureSettings } from './settings/onboarding.tsx'
import { ProblemView } from './ui/components/ProblemView.tsx'
import { isInteractiveTerminal, printElement, printErrorElement } from './ui/terminal.tsx'
import { colors } from './ui/theme.ts'
import { ampulVersion } from './version.ts'

const cancelledExitCode = 130
const failureExitCode = 1
const versionFlags = new Set(['--version', '-v', 'version'])
const helpFlags = new Set(['--help', '-h'])
const commandsThatNeedNoSettings = new Set(['help'])

async function dispatch(args: string[]): Promise<number> {
  const [commandName, ...rest] = args
  if (commandName === forwarderCommandName) return runPortForwarder(rest)
  const interactive = isInteractiveTerminal()
  if (!commandName) {
    if (!interactive) {
      process.stdout.write(overviewManualPage(allCommands()))
      return 0
    }
    await ensureSettings(interactive)
    return runHome()
  }
  if (versionFlags.has(commandName)) {
    process.stdout.write(`ampul ${ampulVersion}\n`)
    return 0
  }
  if (helpFlags.has(commandName)) {
    process.stdout.write(overviewManualPage(allCommands()))
    return 0
  }

  const command = commandNamed(commandName)
  if (!command) throw unknownCommand(commandName)
  const { positionals, flags } = parseArguments(command, rest)
  if (flags.has('help')) {
    process.stdout.write(commandManualPage(command))
    return 0
  }
  if (!commandsThatNeedNoSettings.has(command.name)) await ensureSettings(interactive)
  return command.run({ positionals, flags, interactive })
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
