import type { CommandDefinition, Invocation } from '../cli/CommandDefinition.js'
import { allContainerStates } from '../containers/containerState.js'
import { listProjects } from '../projects/projectStore.js'
import { HomeScreen, type HomeAction, type HomeChoice } from '../ui/screens/HomeScreen.js'
import { showInteractiveScreen } from '../ui/terminal.js'
import { configCommand } from './config.js'
import { newProjectCommand } from './newProject.js'
import { rebuildCommand } from './rebuild.js'
import { removeCommand } from './remove.js'
import { connectToEngine } from './shared/engineConnection.js'
import { describeRuntime } from './shared/runtimeDescription.js'
import { startCommand } from './start.js'
import { stopCommand } from './stop.js'

const commandsByAction: Record<Exclude<HomeAction, 'quit'>, CommandDefinition> = {
  start: startCommand,
  stop: stopCommand,
  rebuild: rebuildCommand,
  config: configCommand,
  rm: removeCommand,
  new: newProjectCommand,
}

const actionsThatReturnHome = new Set<HomeAction>(['stop'])

export async function runHome(): Promise<number> {
  const engine = await connectToEngine(true)
  const runtimeDescription = await describeRuntime(engine)

  while (true) {
    const projects = listProjects()
    const states = await allContainerStates(engine)
    const choice = await showInteractiveScreen<HomeChoice>(
      (finish) => (
        <HomeScreen
          projects={projects}
          states={states}
          runtimeDescription={runtimeDescription}
          finish={finish}
        />
      ),
      () => null,
    )
    if (choice.action === 'quit') return 0

    const invocation: Invocation = {
      positionals: choice.projectName ? [choice.projectName] : [],
      flags: new Set(),
      interactive: true,
    }
    const exitCode = (await commandsByAction[choice.action].run(invocation)) ?? 0
    if (!actionsThatReturnHome.has(choice.action)) return exitCode
  }
}
